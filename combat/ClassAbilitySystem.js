import { abilityPower, linkedHealing } from '../game/CharacterStats.js';

import { arenaDistance, ADJACENT_DISTANCE } from '../config/combatRanges.js';

export function abilityDistance(scene, a, b) {
  return arenaDistance(a, b) / ADJACENT_DISTANCE;
}

export function zoneContains(scene, point, anchor, zone) {
  return arenaDistance(point, anchor) <= zone * ADJACENT_DISTANCE;
}

export function beamContains(scene, caster, target, point, range) {
  const dx = target.arenaX - caster.arenaX, dy = target.arenaY - caster.arenaY;
  const length = Math.hypot(dx, dy);
  if (!length) return false;
  const px = (point.arenaX ?? point.x) - caster.arenaX;
  const py = (point.arenaY ?? point.y) - caster.arenaY;
  const along = (px * dx + py * dy) / length;
  return along > 0 && along <= range * ADJACENT_DISTANCE
    && Math.abs(px * dy - py * dx) / length <= ADJACENT_DISTANCE / 2;
}

export default class ClassAbilitySystem {
  constructor(scene) { this.scene = scene; this.traps = []; this.chargeTweens = new Set(); }
  syncChargeTweens(paused) {
    for (const tween of this.chargeTweens) tween.timeScale = paused ? 0 : 1;
  }
  allies() { return this.scene.partyUnits.filter(u => u.alive); }
  enemies(unit) { return this.scene.getLivingEnemies().filter(e => unit.role === 'Tank' || this.scene.isEnemyEngaged(e)); }
  distance(a, b) { return abilityDistance(this.scene, a, b); }
  canSacrifice(unit) {
    const scene = this.scene, wave = scene.waves?.[scene.currentWaveIndex];
    const others = scene.partyUnits.filter(ally => ally !== unit);
    const survivors = others.filter(ally => ally.alive);
    return unit.alive && !unit.delvesUsed?.honorSacrifice && !scene.battleOver
      && scene.currentWaveIndex === scene.waves?.length - 1 && wave?.boss === true
      && scene.getLivingEnemies().length > 0 && others.some(ally => !ally.alive)
      && survivors.length === 1;
  }
  sacrifice(unit, ability, time) {
    if (!this.canSacrifice(unit)) return false;
    const scene = this.scene;
    unit.delvesUsed ??= {};
    unit.delvesUsed.honorSacrifice = true;
    unit.defeat(); // A sacrifice bypasses armor, immunity, parry and temporary HP.
    for (const ally of scene.partyUnits.filter(ally => ally !== unit)) {
      if (!ally.alive) ally.revive(1, 1);
      ally.hp = ally.maxHp;
      ally.mana = ally.maxMana;
      ally.updateHealthBar();
      scene.manualTargets?.delete(ally.id);
      scene.attackTargets?.delete(ally.id);
      scene.heldUnitIds?.delete(ally.id);
      if (ally.role.endsWith('DPS')) {
        ally.status.honorDamageBoost = ability.damageBoost;
        ally.status.honorDamageUntil = time + ability.duration;
      }
      if (ally.role === 'Healer') {
        ally.status.honorHealingBoost = ability.healingBoost;
        ally.status.honorHealingUntil = time + ability.duration;
      }
    }
    scene.awaitingRevive = false;
    scene.updateHud?.();
    return true;
  }
  tryParry(unit, attacker, damage, time) {
    const ability = unit.abilities?.parry;
    if (!unit.alive || !attacker?.isEnemy || !ability?.reactive || damage <= 0
      || time < (unit.status.stunnedUntil ?? 0)
      || time - (unit.lastAbilityAt.parry ?? -Infinity) < ability.cooldown) return false;
    // Reactive abilities are independent of the Oathwarden's current action.
    unit.lastAbilityAt.parry = time;
    if (Math.random() >= ability.chance) return false;
    unit.spriteVisual?.play('block', attacker);
    this.scene.announceAbility(unit, ability.name, '#cbd5e1');
    this.scene.resolveDamage(unit, attacker, damage, 'reflection', 1, ability.name, false);
    return true;
  }
  tick(unit, time) {
    const s = unit.status;
    if (unit.stealthed && s.stealthUntil && s.stealthUntil <= time) unit.setStealthed(false);
    if (s.refugeNext && s.refugeNext <= time && s.refugeNext <= s.refugeUntil) {
      this.scene.resolveHeal(unit, unit, s.refugePower, 'Scripted Refuge', false);
      s.refugeNext += s.refugeInterval;
    }
  }
  tickWorld(time) {

    // Apply overdue poison ticks so frame timing cannot skip damage.
    for (const enemy of this.scene.getLivingEnemies()) {
      const poison = enemy.status.poison;
      while (poison && enemy.alive && poison.next <= time && poison.next <= poison.until) {
        this.scene.resolveDamage(poison.caster, enemy, poison.power, 'spell', 1, 'Poison', false);
        poison.next += poison.interval;
      }
    }
    this.traps = this.traps.filter(trap => {
      if (trap.wave !== this.scene.currentWaveIndex) return false;
      const target = this.scene.getLivingEnemies().find(e => this.distance(e, trap.point) <= 0.6);
      if (!target) return true;
      this.resolve(trap.owner, target, { ...trap.ability, effect: 'damage' }, time);
      return false;
    });
  }
  surroundingPoints(center, radius) {
    return Array.from({ length: 16 }, (_, index) => {
      const angle = index * Math.PI / 8;
      return { x: (center.arenaX ?? center.x) + Math.cos(angle) * radius,
        y: (center.arenaY ?? center.y) + Math.sin(angle) * radius };
    });
  }
  adjacentPoint(unit, target, behind = false) {
    const facing = this.allies().find(a => a.id === target.currentTargetId);
    const points = this.surroundingPoints(target, 70).filter(p => this.canTeleport(unit, p));
    const score = p => behind && facing
      ? (p.x - target.arenaX) * (facing.arenaX - target.arenaX) + (p.y - target.arenaY) * (facing.arenaY - target.arenaY)
      : arenaDistance(p, unit);
    return points.sort((a, b) => score(a) - score(b))[0];
  }
  trapPoint(unit, enemies) {
    const points = this.surroundingPoints(unit, ADJACENT_DISTANCE).filter(p => this.canTeleport(unit, p));
    const score = p => Math.min(...enemies.map(e => arenaDistance(e, p)));
    const point = points.sort((a, b) => score(a) - score(b))[0];
    return point ? { arenaX: point.x, arenaY: point.y, alive: true } : null;
  }
  canTeleport(unit, point) {
    const scene = this.scene, g = scene.battlefield;
    if (point.x < 0 || point.y < 0 || point.x > g.logicalWidth || point.y > g.logicalHeight) return false;
    if ([...scene.partyUnits.filter(other => other.container?.active !== false), ...scene.getLivingEnemies()].some(other => other !== unit && arenaDistance(other, point) < 52)) return false;
    const safe = scene.terrain?.nearestSafeUnitPoint(unit, point.x, point.y, 12) ?? point;
    return Math.hypot(safe.x - point.x, safe.y - point.y) < 1;
  }
  move(unit, point, time) {
    if (!unit.classAbilities || !unit.canStartAction(time) || !unit.canCast(time) || !this.canTeleport(unit, point)) return false;
    const entry = Object.entries(unit.abilities).find(([, a]) => a.effect === 'teleport');
    if (entry && this.distance(unit, point) > entry[1].moveThreshold && unit.abilityReady(entry[0], time)) {
      unit.markAbilityUsed(entry[0], time);
      this.scene.announceAbility(unit, entry[1].name, '#c4b5fd');
    } else if (unit.status.teleportUntil > time && this.distance(unit, point) <= unit.status.teleportRange) {
      unit.status.teleportUntil = 0;
    } else return false;
    unit.setArenaPosition(point.x, point.y);
    return true;
  }
  escapePoint(unit, range, minRange = 0) {
    const enemies = this.scene.getLivingEnemies();
    const points = [];
    for (let radius = Math.max(1, minRange + 0.5); radius <= range; radius += 0.5) {
      points.push(...this.surroundingPoints(unit, radius * ADJACENT_DISTANCE).filter(p => this.canTeleport(unit, p)));
    }
    const safety = p => Math.min(...enemies.map(e => arenaDistance(e, p)));
    return points.sort((a, b) => safety(b) - safety(a))[0];
  }
  update(unit, time, delta) {
    const scene = this.scene;
    if (!unit.canStartAction(time) || !unit.canCast(time)) return;

    // Ability order follows the class data; healing takes priority for injured allies.
    const enemies = this.enemies(unit), allies = this.allies();
    const injured = allies.filter(a => a.hp < a.maxHp).sort((a,b) => a.hp/a.maxHp - b.hp/b.maxHp);
    const healingPriority = unit.role === 'Healer' ? scene.getHealerPriorityTarget?.(unit) : null;
    const healingNeeded = unit.role === 'Healer' && (Boolean(healingPriority) || allies.some(a => a.hp / a.maxHp < 0.8));
    if (healingPriority) {
      const index = injured.indexOf(healingPriority);
      if (index >= 0) injured.unshift(...injured.splice(index, 1));
    }
    if (!scene.getLivingEnemies().some(e => e.id === scene.attackTargets.get(unit.id))) scene.attackTargets.delete(unit.id);
    const ordered = !healingNeeded && scene.attackTargets.get(unit.id);
    const preferred = scene.getPrimaryTarget(unit);
    for (const [key, a] of Object.entries(unit.abilities)) {
      if (a.reactive || !unit.abilityReady(key, time)) continue;
      let target = unit;
      if (a.effect === 'sacrifice') {
        if (!this.canSacrifice(unit)) continue;
        scene.announceAbility(unit, a.name, '#fde68a');
        this.sacrifice(unit, a, time);
        return;
      }
      if (a.effect === 'vow') {
        target = allies.filter(ally => this.distance(unit, ally) <= a.range
          && enemies.some(enemy => enemy.currentTargetId === ally.id))
          .sort((x,y) => x.hp/x.maxHp-y.hp/y.maxHp)[0];
        if (!target) continue;
        this.cast(unit, target, key, time);
        return;
      }
      if (a.effect === 'teleport') {
        if (scene.isPositionLocked(unit) || !enemies.some(e => this.distance(unit, e) <= 1)) continue;
        const point = this.escapePoint(unit, a.moveThreshold + 1, a.moveThreshold);
        if (point && this.distance(unit, point) > a.moveThreshold && this.move(unit, point, time)) return;
        continue;
      }
      if (a.effect === 'taunt') {
        let eligible = enemies.filter(e => this.distance(unit,e) <= a.range);
        if (a.farthest) eligible.sort((x,y) => this.distance(unit,y)-this.distance(unit,x));
        else eligible.sort((x,y) => Number(x.currentTargetId === unit.id)-Number(y.currentTargetId === unit.id) || this.distance(unit,x)-this.distance(unit,y));
        if (!eligible.length || eligible.every(e => e.status.forcedTargetUntil > time && e.status.forcedTargetId === unit.id)) continue;
        scene.applyTankTaunt(unit, eligible.slice(0,a.targets), key,time);
        if (a.reduction) { unit.status.damageReduction = a.reduction; unit.status.damageReductionUntil = time+a.duration; }
        return;
      }
      if (a.effect === 'heal') {
        if (ordered && a.target !== 'self') continue;
        target = a.target === 'self' ? (unit.hp < unit.maxHp ? unit : null)
          : (healingPriority ? [healingPriority] : injured).find(t => this.distance(unit,t) <= a.range);
        if (a.zone) target = this.bestZone(unit, a, injured);
        if (!target) continue;
      } else if (a.effect === 'protect') {
        if (!enemies.length) continue;
        target = a.target === 'ally' ? allies.filter(t => this.distance(unit, t) <= a.range)
          .sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0] : unit;
        if (!target) continue;
        if (a.target !== 'allies' && target.status.abilityProtectionUntil > time) continue;
      } else if (a.effect === 'prepare') {
        if (!enemies.length || unit.status.abilityPreparationUntil > time) continue;
      } else if (a.effect === 'trap') {
        if (!enemies.length) continue;
        target = this.trapPoint(unit, enemies);
        if (!target) continue;
      } else if (a.effect === 'damage' || a.effect === 'mark') {
        if (healingNeeded) continue;
        if (a.requiresStealth && !unit.stealthed) continue;
        if (unit.stealthed && !a.requiresStealth) continue;
        if ((a.charge || a.behind) && scene.isPositionLocked(unit)) continue;
        const inRange = enemies.filter(e => this.distance(unit,e) <= (a.radius ?? (a.range + (unit.status.nextRangeBonus ?? 0))));
        if (a.farthest) inRange.sort((x,y) => this.distance(unit,y)-this.distance(unit,x));
        target = !a.farthest && inRange.includes(preferred) ? preferred : inRange[0];
        if (a.zone) target = this.bestZone(unit, a, enemies);
        if (a.endpoint) target = this.bestLine(unit, a, enemies);
        if (!target) continue;
      } else {
        const threatened = scene.getLivingEnemies().some(e => e.currentTargetId === unit.id);
        if (a.effect === 'stealth' && (threatened || unit.stealthed || !enemies.length || !unit.abilityReady('surprise', time))) continue;
        if (a.effect === 'enrage' && !enemies.some(e => this.distance(unit,e) <= 6)) continue;
        if (a.effect === 'aegis' && (!injured.length || unit.status.solarAegis || ordered)) continue;
        if (a.effect === 'stabilize' && !enemies.length) continue;
        if (a.effect === 'refuge' && unit.hp === unit.maxHp && !threatened) continue;
        if (a.effect === 'armor' && !threatened) continue;
        if (a.effect === 'ascendance' && !injured.length && !threatened) continue;
      }
      this.cast(unit, target, key, time);
      return;
    }
    const basicHealTarget = unit.role === 'Healer' && !ordered
      ? (healingPriority ? [healingPriority] : injured).find(target => this.distance(unit, target) <= unit.basicHealRange) : null;
    if (basicHealTarget && unit.canHeal(time)) {
      scene.beginBasicHeal(unit, basicHealTarget, time);
      return;
    }
    if (!healingNeeded && !unit.stealthed && preferred && scene.isWithinAttackReach(unit, preferred) && unit.canAttack(time)) {
      scene.beginBasicAttack(unit, preferred, time, ['Tank', 'Melee DPS'].includes(unit.role) ? 'melee' : unit.className === 'Ranger' ? 'ranged' : 'spell');
    }
    if (scene.isPositionLocked(unit)) return;
    const healTarget = unit.role === 'Healer' && !ordered ? injured[0] : null;
    if (healTarget) {
      if (this.distance(unit,healTarget)>unit.basicHealRange) unit.moveToward(healTarget.arenaX,healTarget.arenaY,delta,100);
      else if (preferred) scene.movement.maintainPreferredRange(unit, preferred, delta, true);
    } else if (preferred) scene.movement.moveToCombatPosition(unit,preferred,time,delta);
  }
  bestLine(unit, ability, candidates) {
    let best = null, score = 0;
    for (const target of candidates) {
      const length = this.distance(unit, target);
      if (!length || length > ability.range) continue;
      const count = candidates.filter(t => beamContains(this.scene, unit, target, t, length + 0.001)).length;
      if (count > score) { best = { arenaX: target.arenaX, arenaY: target.arenaY, alive: true }; score = count; }
    }
    return best;
  }
  bestZone(unit, ability, candidates) {
    let best = null, score = 0;
    for (const target of candidates) {
      if (this.distance(unit, target) > ability.range) continue;
      const count = candidates.filter(t => zoneContains(this.scene, t, target, ability.zone)).length;
      if (count > score) { best = { arenaX: target.arenaX, arenaY: target.arenaY, alive: true }; score = count; }
    }
    return best;
  }
  cast(unit,target,key,time) {
    const scene=this.scene, base=unit.abilities[key];
    const a=unit.status.nextRangeBonus && base.effect === 'damage'
      ? { ...base, range: base.range + unit.status.nextRangeBonus } : base;
    const useWindupBonus = !unit.status.nextWindupProtectOnly || a.effect === 'protect';
    const windup = Math.max(100, Math.round(a.windup * (1 - (useWindupBonus ? unit.status.nextWindupReduction ?? 0 : 0))));
    if(!unit.startAction(a.name,time,windup)) return;
    if (useWindupBonus) { unit.status.nextWindupReduction = 0; unit.status.nextWindupProtectOnly = false; }
    unit.spriteVisual?.play(a.effect === 'damage' ? 'attack' : 'block', target);
    unit.markAbilityUsed(key,time);
    if (base.effect === 'damage') unit.status.nextRangeBonus = 0;
    scene.announceAbility(unit,a.name,'#fde68a');
    scene.logActionStart(unit,target===unit||a.zone?null:target,a.name);
    const action=unit.pendingAction;

    // Recheck action identity and range after windup because targets may move or die.
    const schedule = scene.scheduleBattleEvent?.bind(scene) ?? ((delay, data, callback) => scene.time.delayedCall(delay, callback));
    schedule(windup, scene.actionEvent?.('classAbility', unit, target, { ability: a }),
      () => this.resolveCast(unit, action, target, a));
  }

  resolveCast(unit, action, target, a) {
    const scene = this.scene;
    if(!scene.isActionCurrent(unit,action)) return;
    if(unit.role === 'Healer' && (a.effect === 'damage' || a.effect === 'mark')
      && this.allies().some(ally => ally.hp / ally.maxHp < 0.8)) {
      unit.finishAction();
      return;
    }
    if (target.alive && (target === unit || this.distance(unit, target) <= (a.radius ?? a.range))) {
      if (a.charge) {
        if (!this.startCharge(unit, target, a, action)) unit.finishAction();
        return;
      }
      this.resolve(unit,target,a,scene.time.now);
    }
    unit.finishAction();
  }
  startCharge(unit, target, ability, action, saved = null) {
    const scene = this.scene;
    if (scene.isPositionLocked(unit) || unit.status.rootedUntil > scene.time.now) return false;
    const point = saved?.point ?? this.adjacentPoint(unit, target);
    if (!point) return false;
    const startX = unit.arenaX, startY = unit.arenaY;
    const distance = Math.hypot(point.x - startX, point.y - startY);
    const duration = saved ? Math.max(1, saved.duration - saved.elapsed)
      : Math.max(180, Math.min(900, distance / 1100 * 1000));
    unit.charge = { point, startX, startY, duration, elapsed: 0, targetId: target.id, ability };
    unit.busyUntil = scene.time.now + duration;
    unit.spriteVisual?.play('walk', target);
    const tween = scene.tweens.addCounter({
      from: 0, to: 1, duration,
      onUpdate: tween => {
        if (!scene.isActionCurrent(unit, action, target)) {
          tween.stop();
          this.chargeTweens.delete(tween);
          unit.charge = null;
          return;
        }
        const progress = tween.getValue();
        unit.charge.elapsed = progress * duration;
        const x = startX + (point.x - startX) * progress;
        const y = startY + (point.y - startY) * progress;
        if (scene.terrain?.isUnitBlocked(unit, x, y, 12)) {
          tween.stop();
          this.chargeTweens.delete(tween);
          unit.charge = null;
          unit.finishAction();
          return;
        }
        unit.setArenaPosition(x, y);
      },
      onComplete: () => {
        this.chargeTweens.delete(tween);
        unit.charge = null;
        if (!scene.isActionCurrent(unit, action, target)) return;
        unit.setArenaPosition(point.x, point.y);
        if (this.distance(unit, target) <= 1) {
          unit.spriteVisual?.play('attack', target);
          this.resolve(unit, target, ability, scene.time.now, true);
        }
        unit.finishAction();
      }
    });
    this.chargeTweens.add(tween);
    tween.timeScale = scene.combatPaused ? 0 : 1;
    return true;
  }
  resolve(unit,target,a,time,skipChargeMove=false) {
    const scene=this.scene,s=unit.status,allies=this.allies();

    // Movement effects resolve before damage so range and terrain use the landing point.
    if(a.requiresStealth && !unit.stealthed) return;
    if((a.charge && !skipChargeMove) || a.behind) {
      if(scene.isPositionLocked(unit) || s.rootedUntil > time) return;
      const point=this.adjacentPoint(unit,target,a.behind);
      if(!point) return;
      unit.setArenaPosition(point.x,point.y);
    }
    if(a.effect==='vow' && target.alive && this.distance(unit,target)<=a.range) {
      const attackers=scene.getLivingEnemies().filter(enemy=>enemy.currentTargetId===target.id);
      scene.applyTankTaunt(unit,attackers,'vow',time,false);
      target.status.damageReduction=a.reduction;
      target.status.damageReductionUntil=time+a.immunityDuration;
    }
    if(a.effect==='stealth') {
      if(!scene.getLivingEnemies().some(e=>e.currentTargetId===unit.id)) {
        unit.setStealthed(true);
        s.stealthUntil=time+a.duration;
      }
    }
    if(a.effect==='enrage') {
      s.enrageUntil=time+a.duration; s.exhaustedUntil=s.enrageUntil+a.recovery;
      s.enrageDamage=a.damageMultiplier; s.enrageIncoming=a.incomingMultiplier; s.exhaustedDamage=a.recoveryMultiplier;
    }
    if(a.effect==='mark') { target.status.damageTakenBoost=a.damageTakenBoost; target.status.damageTakenBoostUntil=time+a.duration; }
    if(a.effect==='trap') {
      this.traps=this.traps.filter(t=>t.owner!==unit);
      this.traps.push({owner:unit,point:target,ability:a,wave:scene.currentWaveIndex});
    }
    if(a.effect==='stabilize') { s.damageReduction= a.reduction; s.damageReductionUntil=time+a.duration; s.nextSpellBoost=a.spellBoost; }
    if(a.effect==='aegis') s.solarAegis=true;
    if(a.effect==='armor') { s.armorMultiplier=a.armorMultiplier; s.armorUntil=time+a.duration; }
    if(a.effect==='refuge') { s.nextHitReduction=0.5; s.refugeUntil=time+a.duration; s.refugeNext=time+a.interval; s.refugePower=abilityPower(unit, a, a.power, true); s.refugeInterval=a.interval; }
    if(a.effect==='ascendance') {
      s.healingBoost=a.healingBoost; s.healingBoostUntil=time+a.duration;
      s.teleportUntil=time+a.duration; s.teleportRange=a.teleportRange;
      if(!scene.isPositionLocked(unit) && scene.getLivingEnemies().some(e=>this.distance(unit,e)<=1)) {
        const p=this.escapePoint(unit,a.teleportRange);
        if(p) { unit.setArenaPosition(p.x,p.y); s.teleportUntil=0; }
      }
    }
    if(a.effect==='protect') {
      const protectionBonus = 1 + (s.nextProtectionBonus ?? 0);
      const protectionDuration = Math.round(a.duration * (1 + (s.nextProtectionDurationBonus ?? 0)));
      s.nextProtectionBonus = 0;
      s.nextProtectionDurationBonus = 0;
      const recipients = a.target === 'allies' ? allies.filter(t => this.distance(unit, t) <= (a.radius ?? 2)) : [target];
      for (const ally of recipients) {
        if (a.powerUnit === 'shield HP') {
          ally.status.temporaryHp = (ally.status.temporaryHp ?? 0) + Math.round(a.power * protectionBonus);
          ally.status.temporaryHpUntil = time + protectionDuration;
        } else if (a.powerUnit.includes('dodge')) {
          ally.status.abilityDodgeChance = Math.min(0.75, a.power * protectionBonus / 100);
          ally.status.abilityDodgeUntil = time + protectionDuration;
          ally.status.abilityDodgeRangedOnly = a.rangedOnlyDodge === true;
        } else {
          ally.status.damageReduction = Math.min(0.75, a.power * protectionBonus / 100);
          ally.status.damageReductionUntil = time + protectionDuration;
        }
        ally.status.abilityProtectionUntil = time + protectionDuration;
        if (a.targetThreatReduction) {
          ally.status.threatReduction = a.targetThreatReduction;
          ally.status.threatReductionUntil = time + protectionDuration;
        }
        if (a.intercept && ally !== unit) {
          ally.status.interceptSource = unit;
          ally.status.interceptUntil = time + protectionDuration;
          unit.status.damageReduction = Math.min(0.75, a.power / 100);
          unit.status.damageReductionUntil = time + protectionDuration;
        }
      }
    }
    if(a.effect==='prepare') {
      const bonus = a.power / 100;
      s.abilityPreparationUntil = time + a.duration;
      if (a.powerUnit.includes('heal')) s.nextHealBoost = bonus;
      else if (a.powerUnit.includes('windup')) s.nextWindupReduction = bonus;
      else if (a.powerUnit.includes('critical')) { s.abilityCritBonus = bonus; s.abilityCritUntil = time + a.duration; }
      else if (a.powerUnit.includes('movement')) { s.moveSpeedBonus = bonus; s.moveSpeedBonusUntil = time + a.duration; }
      else if (a.powerUnit.includes('threat reduction')) { s.threatReduction = bonus; s.threatReductionUntil = time + a.duration; }
      else if (a.powerUnit.includes('poison')) s.nextPoisonPower = abilityPower(unit, a);
      else if (a.powerUnit.includes('next-hit')) s.nextAttackBoost = bonus;
      else if (a.powerUnit.includes('spell bonus')) s.nextSpellBoost = Math.max(s.nextSpellBoost ?? 0, bonus);
      else if (a.powerUnit.includes('attack bonus')) { s.damageBoost = bonus; s.damageBoostUntil = time + a.duration; }
      if (a.powerUnit.includes('damage reduction')) { s.damageReduction = bonus; s.damageReductionUntil = time + a.duration; }
      if (a.selfReduction) { s.damageReduction = a.selfReduction; s.damageReductionUntil = time + a.duration; }
      if (a.extraMoveBonus) { s.moveSpeedBonus = a.extraMoveBonus; s.moveSpeedBonusUntil = time + a.duration; }
      if (a.nextProtectionBonus) s.nextProtectionBonus = a.nextProtectionBonus;
      if (a.nextProtectionDurationBonus) s.nextProtectionDurationBonus = a.nextProtectionDurationBonus;
      if (a.nextThreatBonus) s.nextThreatBonus = a.nextThreatBonus;
      if (a.nextRangeBonus) s.nextRangeBonus = a.nextRangeBonus;
      if (a.nextLinkedHealRatio) s.nextLinkedHealRatio = a.nextLinkedHealRatio;
      if (a.nextCritOnly) s.abilityCritOnce = true;
      if (a.protectiveOnlyWindup) s.nextWindupProtectOnly = true;
      if (a.targetThreatReduction) { s.threatReduction = a.targetThreatReduction; s.threatReductionUntil = time + a.duration; }
    }
    if(a.effect==='heal') {
      const targets=a.zone?allies.filter(t=>zoneContains(scene,t,target,a.zone)):[target];
      let power=a.lowHealthPower && unit.hp/unit.maxHp<0.5?a.lowHealthPower:a.power;
      power = abilityPower(unit, a, power, true);
      if (a.lowHealthBoost && unit.hp / unit.maxHp < 0.5) power = Math.round(power * (1 + a.lowHealthBoost));
      power = Math.round(power * (1 + (s.nextHealBoost ?? 0)));
      s.nextHealBoost = 0;
      if(s.solarAegis&&!a.zone) {
        s.solarAegis=false;
        power=Math.round(power*(1+(unit.abilities.aegis?.healBonus ?? 0.25)));
        if(target!==unit) targets.push(unit);
      }
      for(const t of targets) {
        const before=t.hp;
        scene.resolveHeal(unit,t,power,a.name);
        if(a.temporaryHp && t.hp>before) t.status.temporaryHp=(t.status.temporaryHp??0)+a.temporaryHp;
        if(a.retaliation) t.status.bramble={caster:unit,power:abilityPower(unit, { ...a, damageType: 'nature' }, a.retaliation)};
      }
      if(a.selfDamage && target !== unit) scene.resolveDamage(unit,unit,a.selfDamage,'spell',0,a.name,false);
    }
    if(a.effect!=='damage') return;

    // Select targets from the ability shape before applying shared damage modifiers.
    let targets=this.enemies(unit);
    if(a.zone) targets=targets.filter(t=>zoneContains(scene,t,target,a.zone));
    else if(a.radius) targets=targets.filter(t=>this.distance(unit,t)<=a.radius);
    else if(a.splash) targets=targets.filter(t=>this.distance(target,t)<=a.splash);
    else if(a.beam) {
      const length = a.endpoint ? Math.min(a.range, this.distance(unit, target)) + 0.001 : a.range;
      targets=[...targets,...(a.friendlyFire?allies.filter(t=>t!==unit):[])]
        .filter(t=>beamContains(scene,unit,target,t,length));
    }
    else if(a.targets) targets=[target,...targets.filter(t=>t!==target&&this.distance(unit,t)<=a.range)].slice(0,a.targets);
    else targets=[target];
    let power=a.power;
    if(a.judgement && !allies.some(t=>t.id===target.currentTargetId&&t.role==='Tank')) power=a.highPower;
    if(a.missingHealthBonus) power*=1+(1-unit.hp/unit.maxHp);
    if(a.rearBonus && target.currentTargetId !== unit.id) power*=1+a.rearBonus;
    if (!a.poison) power = abilityPower(unit, a, power);
    power*=1+(s.nextSpellBoost??0); s.nextSpellBoost=0;
    if (unit.stealthed) unit.setStealthed(false);
    let total=0;
    for(const t of targets) {
      const dealt=a.poison ? 0 : scene.resolveDamage(unit,t,power,a.damageType==='physical'?'melee':['holy','radiant'].includes(a.damageType)?'holy':'spell',a.totalThreat?0:(a.threatMultiplier ?? 1),a.name);
      total+=dealt??0;
      if (dealt === undefined && !a.poison) continue;
      if(a.stun&&t.alive) {
        t.status.stunnedUntil=Math.max(t.status.stunnedUntil??0,time+a.stun);
        t.status.hardStunUntil=Math.max(t.status.hardStunUntil??0,time+a.stun);
        t.finishAction?.();
      }
      if(a.blind&&t.alive) { t.status.blindUntil=time+a.blind; t.status.blindChance=a.blindChance; }
      if(a.poison&&t.alive) {
        t.status.poison={caster:unit,power:abilityPower(unit, a, a.poison.power),interval:a.poison.interval,next:time+a.poison.interval,until:time+a.poison.duration};
        t.status.attackSlowUntil=time+a.poison.duration; t.status.attackSlow=a.attackSlow;
      }
      if(a.root&&t.alive) t.status.rootedUntil=time+a.root;
      if(a.healingReduction&&t.alive) { t.status.healingReduction=a.healingReduction; t.status.healingReductionUntil=time+a.duration; }
      if(a.damageTakenBoost&&t.alive) { t.status.damageTakenBoost=a.damageTakenBoost; t.status.damageTakenBoostUntil=time+a.duration; }
      if(a.slow&&t.alive) { t.status.moveSpeedSlow=a.slow; t.status.moveSpeedSlowUntil=time+Math.max(2000,a.duration); }
    }
    if(a.totalThreat) for(const t of targets) scene.addThreat(t,unit,total*a.totalThreat);
    if(a.healRatio&&total>0) {
      let recipients=allies;
      if(a.healScope==='lowest') recipients=[...allies].sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp).slice(0,1);
      if(a.healScope==='near') recipients=allies.filter(t=>this.distance(t,target)<=1);
      for(const t of recipients) scene.resolveHeal(unit,t,linkedHealing(unit, a, total),a.name,false);
    }
    if(s.nextLinkedHealRatio&&total>0) {
      const recipient=[...allies].sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp)[0];
      if(recipient) scene.resolveHeal(unit,recipient,Math.round(linkedHealing(unit, a, total, s.nextLinkedHealRatio)),a.name,false);
      s.nextLinkedHealRatio=0;
    }
  }
}
