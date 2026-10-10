// We resolve class skills here using the same living units, timing and damage rules as
// ordinary combat. Skill data describes the effect; this code carries it out. Ranges
// expressed in workbook measures are converted through ADJACENT_DISTANCE. Status values
// ending in Until are expiry times on the combat clock, not remaining seconds. Charge
// tweens affect movement and must keep running during background simulation even when
// drawing is deferred.

import { abilityPower, linkedHealing } from '../game/CharacterStats.js';

import { arenaDistance, ADJACENT_DISTANCE } from '../config/combatRanges.js';
import { findAbilityEffect } from '../data/abilityEffects.js';

// Convert logical arena distance into the skill system's 100-unit reach measures. scene is
// the Phaser screen that owns the objects, clock and input used here.
export function abilityDistance(scene, a, b) {
  return arenaDistance(a, b) / ADJACENT_DISTANCE;
}

// Check whether the point lies within the skill's circular area around its anchor. scene
// is the Phaser screen that owns the objects, clock and input used here.
export function zoneContains(scene, point, anchor, zone) {
  return arenaDistance(point, anchor) <= zone * ADJACENT_DISTANCE;
}

// We treat caster-to-target as a direction vector. The dot product measures how far along
// that line the point sits; the cross product gives its sideways distance after dividing
// by the line length. Both checks are needed: a point can be near the line but behind the
// caster or beyond the skill's reach. scene is the Phaser screen that owns the objects,
// clock and input used here. target is the object this operation is aimed at; it is
// supplied by the caller.
export function beamContains(scene, caster, target, point, range) {
  const dx = target.arenaX - caster.arenaX, dy = target.arenaY - caster.arenaY;

  // Math.hypot calculates straight-line length from the x/y differences: square each, add
  // them, then take the square root.
  const length = Math.hypot(dx, dy);
  if (!length) return false;

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  const px = (point.arenaX ?? point.x) - caster.arenaX;
  const py = (point.arenaY ?? point.y) - caster.arenaY;

  // This dot product measures the point's distance along the caster-to-target line. The
  // cross product in the return measures sideways distance. Half ADJACENT_DISTANCE is the
  // beam's half-width, not its total reach.
  const along = (px * dx + py * dy) / length;

  return along > 0 && along <= range * ADJACENT_DISTANCE
    && Math.abs(px * dy - py * dx) / length <= ADJACENT_DISTANCE / 2;
}

export default class ClassAbilitySystem {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods. scene is the Phaser screen that owns
  // the objects, clock and input used here.
  constructor(scene) {
    this.scene = scene;
    this.traps = [];
    this.chargeTweens = new Set();
  }

  // Set gameplay charge tween speed to zero while paused and one while running.
  syncChargeTweens(paused) {
    for (const tween of this.chargeTweens) tween.timeScale = paused ? 0 : 1;
  }

  // Return only the living party members eligible for this skill decision.
  allies() { return this.scene.partyUnits.filter(u => u.alive); }

  // Return living enemies that this unit is allowed to engage under the role rules.
  enemies(unit) {
    return this.scene.getLivingEnemies().filter(e => unit.role === 'Tank' || this.scene.isEnemyEngaged(e));
  }

  // Read the shared logical arena distance in the skill system's reach measures.
  distance(a, b) { return abilityDistance(this.scene, a, b); }

  // Check the special final-boss survivor and once-per-Delve requirements before
  // sacrifice. unit is the live combatant, with current resources and arena position.
  canSacrifice(unit) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const scene = this.scene, wave = scene.waves?.[scene.currentWaveIndex];

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const others = scene.partyUnits.filter(ally => ally !== unit);
    const survivors = others.filter(ally => ally.alive);

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    return unit.alive && !unit.delvesUsed?.honorSacrifice && !scene.battleOver
      && scene.currentWaveIndex === scene.waves?.length - 1 && wave?.boss === true
      && scene.getLivingEnemies().length > 0 && others.some(ally => !ally.alive)
      && survivors.length === 1;
  }

  // Apply the valid sacrifice, revive allies and record its actual death and bonuses. unit
  // is the live combatant, with current resources and arena position. ability is the
  // selected skill data, including its current rank values.
  sacrifice(unit, ability, time) {
    if (!this.canSacrifice(unit)) return false;
    const scene = this.scene;

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone.
    unit.delvesUsed ??= {};
    unit.delvesUsed.honorSacrifice = true;
    unit.defeat(); // A sacrifice bypasses armor, immunity, parry and temporary HP.
    scene.combatLog?.add('death', `${unit.name} sacrificed themself with ${ability.name}`, {
      wave: scene.currentWaveIndex + 1, actor: unit.name, target: unit.name,
      ability: ability.name, targetSide: 'party', reason: 'sacrifice'
    });

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    for (const ally of scene.partyUnits.filter(ally => ally !== unit)) {
      if (!ally.alive) ally.revive(1, 1);
      ally.hp = ally.maxHp;
      ally.mana = ally.maxMana;
      ally.updateHealthBar();

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
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

  // Check the reactive parry cooldown and chance before reflecting the incoming hit. unit
  // is the live combatant, with current resources and arena position.
  tryParry(unit, attacker, damage, time) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const ability = unit.abilities?.parry;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    if (!unit.alive || !attacker?.isEnemy || !ability?.reactive || damage <= 0
      || time < (unit.status.stunnedUntil ?? 0)
      || time - (unit.lastAbilityAt.parry ?? -Infinity) < ability.cooldown) return false;

    // Reactive abilities are independent of the Oathwarden's current action.
    unit.lastAbilityAt.parry = time;
    if ((this.scene.combatRandom?.() ?? Math.random()) >= ability.chance) return false;
    unit.spriteVisual?.play('block', attacker);
    this.scene.announceAbility(unit, ability.name, '#cbd5e1');
    this.scene.resolveDamage(unit, attacker, damage, 'reflection', 1, ability.name, false);

    return true;
  }

  // Apply this unit's due timed effects and expire statuses on the combat clock. unit is
  // the live combatant, with current resources and arena position. time is a timestamp on
  // the gameplay clock in milliseconds, not a duration.
  tick(unit, time) {
    const s = unit.status;
    if (unit.stealthed && s.stealthUntil && s.stealthUntil <= time) unit.setStealthed(false);
    if (s.refugeNext && s.refugeNext <= time && s.refugeNext <= s.refugeUntil) {
      this.scene.resolveHeal(unit, unit, s.refugePower, 'Scripted Refuge', false);
      s.refugeNext += s.refugeInterval;
    }
  }

  // Apply all overdue poison ticks and test whether a living enemy triggers a current-wave
  // trap. time is a timestamp on the gameplay clock in milliseconds, not a duration.
  tickWorld(time) {

    // Apply overdue poison ticks so frame timing cannot skip damage.
    for (const enemy of this.scene.getLivingEnemies()) {
      const poison = enemy.status.poison;
      while (poison && enemy.alive && poison.next <= time && poison.next <= poison.until) {
        this.scene.resolveDamage(poison.caster, enemy, poison.power, 'spell', 1, 'Poison', false);
        poison.next += poison.interval;
      }
    }

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    this.traps = this.traps.filter(trap => {
      if (trap.wave !== this.scene.currentWaveIndex) return false;

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const target = this.scene.getLivingEnemies().find(e => this.distance(e, trap.point) <= 0.6);
      if (!target) return true;

      // ... copies the source's own fields into this object; fields listed later replace
      // earlier ones. This is a shallow copy, so nested objects are still shared.
      this.resolve(trap.owner, target, { ...trap.ability, effect: 'damage' }, time);
      return false;
    });
  }

  // Sample evenly spaced points around an arena center using circle offsets.
  surroundingPoints(center, radius) {
    return Array.from({ length: 16 }, (_, index) => {
      const angle = index * Math.PI / 8;

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact. Angles are radians. cos(angle) gives the horizontal part of a circle;
      // sin(angle) gives the vertical part. Multiplying by a radius turns those fractions
      // into offsets.
      return { x: (center.arenaX ?? center.x) + Math.cos(angle) * radius,
        y: (center.arenaY ?? center.y) + Math.sin(angle) * radius };
    });
  }

  // Find a legal nearby position, scoring it for proximity or an approach behind the
  // target. unit is the live combatant, with current resources and arena position.
  adjacentPoint(unit, target, behind = false) {

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const facing = this.allies().find(a => a.id === target.currentTargetId);

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const points = this.surroundingPoints(target, 70).filter(p => this.canTeleport(unit, p));
    const score = p => behind && facing
      ? (p.x - target.arenaX) * (facing.arenaX - target.arenaX) + (p.y - target.arenaY) * (facing.arenaY - target.arenaY)
      : arenaDistance(p, unit);

    // sort rearranges this array in place. A negative comparator result puts a before b;
    // positive puts it after; zero keeps them tied.
    return points.sort((a, b) => score(a) - score(b))[0];
  }

  // Pick a legal trap location near the caster that is close to the relevant enemies. unit
  // is the live combatant, with current resources and arena position.
  trapPoint(unit, enemies) {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const points = this.surroundingPoints(unit, ADJACENT_DISTANCE).filter(p => this.canTeleport(unit, p));
    const score = p => Math.min(...enemies.map(e => arenaDistance(e, p)));

    // sort rearranges this array in place. A negative comparator result puts a before b;
    // positive puts it after; zero keeps them tied.
    const point = points.sort((a, b) => score(a) - score(b))[0];

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    return point ? { arenaX: point.x, arenaY: point.y, alive: true } : null;
  }

  // Check that the requested skill destination is legal for this unit's feet. unit is the
  // live combatant, with current resources and arena position.
  canTeleport(unit, point) {
    const scene = this.scene, g = scene.battlefield;
    if (point.x < 0 || point.y < 0 || point.x > g.logicalWidth || point.y > g.logicalHeight) return false;

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false. ... expands these entries into the new list or call. It does not deep-copy
    // the objects inside. filter keeps entries whose callback returns true. It builds a
    // new list and leaves the original list in place.
    if ([...scene.partyUnits.filter(other => other.container?.active !== false), ...scene.getLivingEnemies()].some(other => other !== unit && arenaDistance(other, point) < 52)) return false;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const safe = scene.terrain?.nearestSafeUnitPoint(unit, point.x, point.y, 12) ?? point;

    // Math.hypot calculates straight-line length from the x/y differences: square each,
    // add them, then take the square root.
    return Math.hypot(safe.x - point.x, safe.y - point.y) < 1;
  }

  // Use a ready teleport skill or temporary teleport status to reach a legal destination.
  move(unit, point, time) {
    if (!unit.classAbilities || !unit.canStartAction(time) || !unit.canCast(time) || !this.canTeleport(unit, point)) return false;

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields. Object.entries turns own fields into
    // [key, value] pairs so we can visit or transform them.
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

  // Choose a legal escape destination based on distance from threatening enemies. unit is
  // the live combatant, with current resources and arena position.
  escapePoint(unit, range, minRange = 0) {
    const enemies = this.scene.getLivingEnemies();
    const points = [];
    for (let radius = Math.max(1, minRange + 0.5); radius <= range; radius += 0.5) {

      // ... expands these entries into the new list or call. It does not deep-copy the
      // objects inside. filter keeps entries whose callback returns true. It builds a new
      // list and leaves the original list in place.
      points.push(...this.surroundingPoints(unit, radius * ADJACENT_DISTANCE).filter(p => this.canTeleport(unit, p)));
    }

    const safety = p => Math.min(...enemies.map(e => arenaDistance(e, p)));

    // sort rearranges this array in place. A negative comparator result puts a before b;
    // positive puts it after; zero keeps them tied.
    return points.sort((a, b) => safety(b) - safety(a))[0];
  }

  // Choose a ready class skill by its effect, targets, range and current combat needs.
  update(unit, time, delta) {
    const scene = this.scene;
    if (!unit.canStartAction(time) || !unit.canCast(time)) return;

    // Ability order follows the class data; healing takes priority for injured allies.
    const enemies = this.enemies(unit), allies = this.allies();

    // sort rearranges this array in place. A negative comparator result puts a before b;
    // positive puts it after; zero keeps them tied. filter keeps entries whose callback
    // returns true. It builds a new list and leaves the original list in place.
    const injured = allies.filter(a => a.hp < a.maxHp).sort((a,b) => a.hp/a.maxHp - b.hp/b.maxHp);

    // The condition before ? chooses the first value when true and the value after : when
    // false. ?. only follows this link when the value exists; a missing optional value
    // gives undefined.
    const healingPriority = unit.role === 'Healer' ? scene.getHealerPriorityTarget?.(unit) : null;

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    const healingNeeded = unit.role === 'Healer' && (Boolean(healingPriority) || allies.some(a => a.hp / a.maxHp < 0.8));
    if (healingPriority) {
      const index = injured.indexOf(healingPriority);
      if (index >= 0) injured.unshift(...injured.splice(index, 1));
    }

    if (!scene.getLivingEnemies().some(e => e.id === scene.attackTargets.get(unit.id))) scene.attackTargets.delete(unit.id);
    const ordered = !healingNeeded && scene.attackTargets.get(unit.id);
    const preferred = scene.getPrimaryTarget(unit);

    // Object.entries turns own fields into [key, value] pairs so we can visit or transform
    // them.
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

        // every requires all entries to pass the check; an empty list gives true.
        if (!eligible.length || eligible.every(e => e.status.forcedTargetUntil > time && e.status.forcedTargetId === unit.id)) continue;
        scene.applyTankTaunt(unit, eligible.slice(0,a.targets), key,time);
        if (a.reduction) {
          unit.status.damageReduction = a.reduction;
          unit.status.damageReductionUntil = time+a.duration;
        }

        return;
      }

      if (a.effect === 'heal') {
        if (ordered && a.target !== 'self') continue;

        // find returns the first matching entry, or undefined when none matches. Check for
        // that missing result before using its fields.
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

  // Score candidate beam directions by which eligible targets lie in the line. unit is the
  // live combatant, with current resources and arena position. ability is the selected
  // skill data, including its current rank values.
  bestLine(unit, ability, candidates) {
    let best = null, score = 0;
    for (const target of candidates) {
      const length = this.distance(unit, target);
      if (!length || length > ability.range) continue;

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
      const count = candidates.filter(t => beamContains(this.scene, unit, target, t, length + 0.001)).length;
      if (count > score) {
        best = { arenaX: target.arenaX, arenaY: target.arenaY, alive: true };
        score = count;
      }
    }

    return best;
  }

  // Score candidate area centers by the eligible targets they contain. unit is the live
  // combatant, with current resources and arena position. ability is the selected skill
  // data, including its current rank values.
  bestZone(unit, ability, candidates) {
    let best = null, score = 0;
    for (const target of candidates) {
      if (this.distance(unit, target) > ability.range) continue;

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
      const count = candidates.filter(t => zoneContains(this.scene, t, target, ability.zone)).length;
      if (count > score) {
        best = { arenaX: target.arenaX, arenaY: target.arenaY, alive: true };
        score = count;
      }
    }

    return best;
  }

  // Commit a chosen ability's cost and timing before scheduling its effect. unit is the
  // live combatant, with current resources and arena position.
  cast(unit,target,key,time) {
    const scene=this.scene, base=unit.abilities[key];

    // The condition before ? chooses the first value when true and the value after : when
    // false. ... copies the source's own fields into this object; fields listed later
    // replace earlier ones. This is a shallow copy, so nested objects are still shared.
    const a=unit.status.nextRangeBonus && base.effect === 'damage'
      ? { ...base, range: base.range + unit.status.nextRangeBonus } : base;
    const useWindupBonus = !unit.status.nextWindupProtectOnly || a.effect === 'protect';

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound. ?? uses the fallback only for null or
    // undefined. A real zero or false stays intact.
    const windup = Math.max(100, Math.round(a.windup * (1 - (useWindupBonus ? unit.status.nextWindupReduction ?? 0 : 0))));
    if(!unit.startAction(a.name,time,windup)) return;
    if (useWindupBonus) {
      unit.status.nextWindupReduction = 0;
      unit.status.nextWindupProtectOnly = false;
    }

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    unit.spriteVisual?.play(a.effect === 'damage' ? 'attack' : 'block', target);
    unit.markAbilityUsed(key,time);
    if (base.effect === 'damage') unit.status.nextRangeBonus = 0;
    scene.announceAbility(unit,a.name,'#fde68a');
    scene.logActionStart(unit,target===unit||a.zone?null:target,a.name);
    const action=unit.pendingAction;

    // Volley warns and supplied projectiles fly during this existing windup. Drawing
    // is optional so saved and headless combat retain the same timing and targeting.
    scene.createAbilityTelegraph?.(unit, target, a, action);

    // Recheck action identity and range after windup because targets may move or die.
    const schedule = scene.scheduleBattleEvent?.bind(scene) ?? ((delay, data, callback) => scene.time.delayedCall(delay, callback));
    schedule(windup, scene.actionEvent?.('classAbility', unit, target, { ability: a }),
      () => this.resolveCast(unit, action, target, a));
  }

  // Resolve a finished cast against its still-valid target and current battle state. unit
  // is the live combatant, with current resources and arena position.
  resolveCast(unit, action, target, a) {
    const scene = this.scene;
    scene.clearAbilityTelegraph?.(unit, action);
    if(!scene.isActionCurrent(unit,action)) return;

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    if(unit.role === 'Healer' && (a.effect === 'damage' || a.effect === 'mark')
      && this.allies().some(ally => ally.hp / ally.maxHp < 0.8)) {
      unit.finishAction();
      return;
    }

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    if (target.alive && (target === unit || this.distance(unit, target) <= (a.radius ?? a.range))) {
      if (a.charge) {
        if (!this.startCharge(unit, target, a, action)) unit.finishAction();
        return;
      }
      this.resolve(unit,target,a,scene.time.now);
    }

    unit.finishAction();
  }

  // Move the caster through the skill's gameplay charge tween and track it for pause and
  // catch-up. unit is the live combatant, with current resources and arena position.
  startCharge(unit, target, ability, action, saved = null) {
    const scene = this.scene;
    if (scene.isPositionLocked(unit) || unit.status.rootedUntil > scene.time.now) return false;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const point = saved?.point ?? this.adjacentPoint(unit, target);
    if (!point) return false;
    const startX = unit.arenaX, startY = unit.arenaY;

    // Math.hypot calculates straight-line length from the x/y differences: square each,
    // add them, then take the square root.
    const distance = Math.hypot(point.x - startX, point.y - startY);

    // The condition before ? chooses the first value when true and the value after : when
    // false. Math.max chooses the largest value; pairing it with Math.min can keep a
    // result inside both a lower and an upper bound.
    const duration = saved ? Math.max(1, saved.duration - saved.elapsed)
      : Math.max(180, Math.min(900, distance / 1100 * 1000));
    unit.charge = { point, startX, startY, duration, elapsed: 0, targetId: target.id, ability };
    unit.busyUntil = scene.time.now + duration;
    unit.spriteVisual?.play('walk', target);
    const tween = scene.tweens.addCounter({
      from: 0, to: 1, duration,

      // Update the affected display or movement values as this tween advances.
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

        // ?. only follows this link when the value exists; a missing optional value gives
        // undefined.
        if (scene.terrain?.isUnitBlocked(unit, x, y, 12)) {
          tween.stop();
          this.chargeTweens.delete(tween);
          unit.charge = null;
          unit.finishAction();

          return;
        }

        unit.setArenaPosition(x, y);
      },

      // Finish this animation's remaining work when the tween reaches its end.
      onComplete: () => {
        this.chargeTweens.delete(tween);
        unit.charge = null;
        if (!scene.isActionCurrent(unit, action, target)) return;
        unit.setArenaPosition(point.x, point.y);

        if (this.distance(unit, target) <= 1) {

          // ?. only follows this link when the value exists; a missing optional value
          // gives undefined.
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

  // Apply the selected effect, using the shared damage/healing rules and actual eligible
  // targets. unit is the live combatant, with current resources and arena position.
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

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
      const attackers=scene.getLivingEnemies().filter(enemy=>enemy.currentTargetId===target.id);
      scene.applyTankTaunt(unit,attackers,'vow',time,false);
      target.status.damageReduction=a.reduction;
      target.status.damageReductionUntil=time+a.immunityDuration;
    }

    if(a.effect==='stealth') {

      // some stops with true as soon as one entry passes the check; an empty list gives
      // false.
      if(!scene.getLivingEnemies().some(e=>e.currentTargetId===unit.id)) {
        unit.setStealthed(true);
        s.stealthUntil=time+a.duration;
      }
    }

    if(a.effect==='enrage') {
      s.enrageUntil=time+a.duration;
      s.exhaustedUntil=s.enrageUntil+a.recovery;
      s.enrageDamage=a.damageMultiplier;
      s.enrageIncoming=a.incomingMultiplier;
      s.exhaustedDamage=a.recoveryMultiplier;
    }

    if(a.effect==='mark') {
      target.status.damageTakenBoost=a.damageTakenBoost;
      target.status.damageTakenBoostUntil=time+a.duration;

      // This optional saved flag keeps the artwork until death. It does not extend
      // the damage bonus above, and also records marks applied during idle catch-up.
      if (unit.className === 'Ranger' && a.name === "Hunter's Mark") target.status.huntersMarkVisual = true;
      scene.createAbilityEffect?.(unit, target, a);
    }
    if(a.effect==='trap') {
      this.traps=this.traps.filter(t=>t.owner!==unit);
      this.traps.push({owner:unit,point:target,ability:a,wave:scene.currentWaveIndex});
    }

    if(a.effect==='stabilize') {
      s.damageReduction= a.reduction;
      s.damageReductionUntil=time+a.duration;
      s.nextSpellBoost=a.spellBoost;
    }
    if(a.effect==='aegis') s.solarAegis=true;
    if(a.effect==='armor') {
      s.armorMultiplier=a.armorMultiplier;
      s.armorUntil=time+a.duration;
    }

    if(a.effect==='refuge') {
      s.nextHitReduction=0.5;
      s.refugeUntil=time+a.duration;
      s.refugeNext=time+a.interval;
      s.refugePower=abilityPower(unit, a, a.power, true);
      s.refugeInterval=a.interval;
    }
    if(a.effect==='ascendance') {
      s.healingBoost=a.healingBoost;
      s.healingBoostUntil=time+a.duration;
      s.teleportUntil=time+a.duration;
      s.teleportRange=a.teleportRange;
      if(!scene.isPositionLocked(unit) && scene.getLivingEnemies().some(e=>this.distance(unit,e)<=1)) {
        const p=this.escapePoint(unit,a.teleportRange);
        if(p) {
          unit.setArenaPosition(p.x,p.y);
          s.teleportUntil=0;
        }
      }
    }

    if(a.effect==='protect') {

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      const protectionBonus = 1 + (s.nextProtectionBonus ?? 0);
      const protectionDuration = Math.round(a.duration * (1 + (s.nextProtectionDurationBonus ?? 0)));
      s.nextProtectionBonus = 0;
      s.nextProtectionDurationBonus = 0;

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const recipients = a.target === 'allies' ? allies.filter(t => this.distance(unit, t) <= (a.radius ?? 2)) : [target];
      for (const ally of recipients) {
        if (a.powerUnit === 'shield HP') {
          ally.status.temporaryHp = (ally.status.temporaryHp ?? 0) + Math.round(a.power * protectionBonus);
          ally.status.temporaryHpUntil = time + protectionDuration;
        } else if (a.powerUnit.includes('dodge')) {

          // Math.min chooses the smallest value; pairing it with Math.max can keep a
          // result inside both a lower and an upper bound.
          ally.status.abilityDodgeChance = Math.min(0.75, a.power * protectionBonus / 100);
          ally.status.abilityDodgeUntil = time + protectionDuration;
          ally.status.abilityDodgeRangedOnly = a.rangedOnlyDodge === true;
        } else {
          ally.status.damageReduction = Math.min(0.75, a.power * protectionBonus / 100);
          ally.status.damageReductionUntil = time + protectionDuration;
        }

        ally.status.abilityProtectionUntil = time + protectionDuration;

        // Ward art follows this recipient's shield, using the actual duration after
        // preparation bonuses. The shared temporary-HP pool remains unchanged.
        if (unit.className === 'Dawnwarden' && a.name === 'Sunlit Ward') {
          ally.status.sunlitWardVisualUntil = time + protectionDuration;
          scene.createAbilityEffect?.(unit, ally, { ...a, duration: protectionDuration });
        }
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
      else if (a.powerUnit.includes('critical')) {
        s.abilityCritBonus = bonus;
        s.abilityCritUntil = time + a.duration;
      }
      else if (a.powerUnit.includes('movement')) {
        s.moveSpeedBonus = bonus;
        s.moveSpeedBonusUntil = time + a.duration;
      }
      else if (a.powerUnit.includes('threat reduction')) {
        s.threatReduction = bonus;
        s.threatReductionUntil = time + a.duration;
      }
      else if (a.powerUnit.includes('poison')) s.nextPoisonPower = abilityPower(unit, a);
      else if (a.powerUnit.includes('next-hit')) s.nextAttackBoost = bonus;
      else if (a.powerUnit.includes('spell bonus')) s.nextSpellBoost = Math.max(s.nextSpellBoost ?? 0, bonus);
      else if (a.powerUnit.includes('attack bonus')) {
        s.damageBoost = bonus;
        s.damageBoostUntil = time + a.duration;
      }

      if (a.powerUnit.includes('damage reduction')) {
        s.damageReduction = bonus;
        s.damageReductionUntil = time + a.duration;
      }
      if (a.selfReduction) {
        s.damageReduction = a.selfReduction;
        s.damageReductionUntil = time + a.duration;
      }
      if (a.extraMoveBonus) {
        s.moveSpeedBonus = a.extraMoveBonus;
        s.moveSpeedBonusUntil = time + a.duration;
      }

      if (a.nextProtectionBonus) s.nextProtectionBonus = a.nextProtectionBonus;
      if (a.nextProtectionDurationBonus) s.nextProtectionDurationBonus = a.nextProtectionDurationBonus;
      if (a.nextThreatBonus) s.nextThreatBonus = a.nextThreatBonus;

      if (a.nextRangeBonus) s.nextRangeBonus = a.nextRangeBonus;
      if (a.nextLinkedHealRatio) s.nextLinkedHealRatio = a.nextLinkedHealRatio;
      if (a.nextCritOnly) s.abilityCritOnce = true;

      if (a.protectiveOnlyWindup) s.nextWindupProtectOnly = true;
      if (a.targetThreatReduction) {
        s.threatReduction = a.targetThreatReduction;
        s.threatReductionUntil = time + a.duration;
      }
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

        // ?. only follows this link when the value exists; a missing optional value gives
        // undefined.
        power=Math.round(power*(1+(unit.abilities.aegis?.healBonus ?? 0.25)));
        if(target!==unit) targets.push(unit);
      }

      for(const t of targets) {
        const before=t.hp;

        // These area heals play a short column on each actual recipient. The visual
        // uses individual sprite size; it does not enlarge into a second healing zone.
        const hasArtwork = Boolean(findAbilityEffect(unit, a));
        scene.resolveHeal(unit,t,power,a.name,true,hasArtwork);
        scene.createAbilityEffect?.(unit, t, a);
        if(a.temporaryHp && t.hp>before) t.status.temporaryHp=(t.status.temporaryHp??0)+a.temporaryHp;

        if(a.retaliation) t.status.bramble={caster:unit,power:abilityPower(unit, { ...a, damageType: 'nature' }, a.retaliation)};
      }

      if(a.selfDamage && target !== unit) scene.resolveDamage(unit,unit,a.selfDamage,'spell',0,a.name,false);
    }

    // Non-damage effects have already been handled above. Stop here so a shield, movement
    // skill or heal does not also fall through into damage.
    if(a.effect!=='damage') return;

    // Start with legal living enemies, then narrow the list by the skill shape.
    // zone/splash are centered on the target, radius is centered on the caster, and a beam
    // uses the line from caster to target.
    let targets=this.enemies(unit);
    if(a.zone) targets=targets.filter(t=>zoneContains(scene,t,target,a.zone));
    else if(a.radius) targets=targets.filter(t=>this.distance(unit,t)<=a.radius);
    else if(a.splash) targets=targets.filter(t=>this.distance(target,t)<=a.splash);
    else if(a.beam) {
      const length = a.endpoint ? Math.min(a.range, this.distance(unit, target)) + 0.001 : a.range;

      // ... expands these entries into the new list or call. It does not deep-copy the
      // objects inside.
      targets=[...targets,...(a.friendlyFire?allies.filter(t=>t!==unit):[])]
        .filter(t=>beamContains(scene,unit,target,t,length));
    }
    else if(a.targets) targets=[target,...targets.filter(t=>t!==target&&this.distance(unit,t)<=a.range)].slice(0,a.targets);
    else targets=[target];

    // A resolved area skill gets one cosmetic effect at its center, rather than a copy
    // for every victim. Optional drawing keeps headless background combat compatible.
    if (targets.length > 0 && a.name !== 'Exploding Arrow') scene.createAbilityEffect?.(unit, target, a, targets);

    // Work from the ranked potency and apply the skill's situational modifiers.
    // abilityPower converts that potency to the caster's current stat-based amount. The
    // target's defenses are applied later by resolveDamage.
    let power=a.power;

    if(a.judgement && !allies.some(t=>t.id===target.currentTargetId&&t.role==='Tank')) power=a.highPower;
    if(a.missingHealthBonus) power*=1+(1-unit.hp/unit.maxHp);
    if(a.rearBonus && target.currentTargetId !== unit.id) power*=1+a.rearBonus;

    if (!a.poison) power = abilityPower(unit, a, power);

    // A prepared next-spell bonus applies once, then is cleared immediately. Leaving it on
    // the status object would boost every later spell too.
    power*=1+(s.nextSpellBoost??0);
    s.nextSpellBoost=0;
    if (unit.stealthed) unit.setStealthed(false);
    let total=0;

    for(const t of targets) {

      // Poison schedules later ticks instead of dealing an immediate hit here. For other
      // skills, resolveDamage returns actual damage after hit checks and defenses. An
      // undefined result indicates no landed hit.
      const contact = { hasArtwork: Boolean(findAbilityEffect(unit, a) || findAbilityEffect(unit, a, true)) };
      const dealt=a.poison ? 0 : scene.resolveDamage(unit,t,power,a.damageType==='physical'?'melee':['holy','radiant'].includes(a.damageType)?'holy':'spell',a.totalThreat?0:(a.threatMultiplier ?? 1),a.name,true,contact);
      total+=dealt??0;
      if (dealt === undefined && !a.poison) continue;

      // Use confirmed contact rather than damage: dodges return zero too, while
      // shields can absorb a landed arrow completely. Only contact makes it explode.
      if (a.name === 'Exploding Arrow' && contact.hit) scene.createAbilityEffect?.(unit, t, a);

      if(a.stun&&t.alive) {
        t.status.stunnedUntil=Math.max(t.status.stunnedUntil??0,time+a.stun);
        t.status.hardStunUntil=Math.max(t.status.hardStunUntil??0,time+a.stun);
        t.finishAction?.();
      }

      if(a.blind&&t.alive) {
        t.status.blindUntil=time+a.blind;
        t.status.blindChance=a.blindChance;
      }
      if(a.poison&&t.alive) {

        // Remember the caster, power and interval for later poison ticks. next and until
        // are combat-clock timestamps; interval is a delay in milliseconds. Keeping the
        // caster link allows damage and threat to be credited correctly.
        t.status.poison={caster:unit,power:abilityPower(unit, a, a.poison.power),interval:a.poison.interval,next:time+a.poison.interval,until:time+a.poison.duration};
        t.status.attackSlowUntil=time+a.poison.duration;
        t.status.attackSlow=a.attackSlow;
      }

      if(a.root&&t.alive) t.status.rootedUntil=time+a.root;
      if(a.healingReduction&&t.alive) {
        t.status.healingReduction=a.healingReduction;
        t.status.healingReductionUntil=time+a.duration;
      }
      if(a.damageTakenBoost&&t.alive) {
        t.status.damageTakenBoost=a.damageTakenBoost;
        t.status.damageTakenBoostUntil=time+a.duration;
      }

      if(a.slow&&t.alive) {
        t.status.moveSpeedSlow=a.slow;
        t.status.moveSpeedSlowUntil=time+Math.max(2000,a.duration);
      }
    }

    if(a.totalThreat) for(const t of targets) scene.addThreat(t,unit,total*a.totalThreat);

    // Linked healing depends on actual damage dealt, not requested damage. The scope
    // chooses the lowest-health ally, allies near the target, or the whole living party
    // before converting damage into healing.
    if(a.healRatio&&total>0) {
      let recipients=allies;
      if(a.healScope==='lowest') recipients=[...allies].sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp).slice(0,1);
      if(a.healScope==='near') recipients=allies.filter(t=>this.distance(t,target)<=1);

      for(const t of recipients) scene.resolveHeal(unit,t,linkedHealing(unit, a, total),a.name,false);
    }

    if(s.nextLinkedHealRatio&&total>0) {

      // sort rearranges this array in place. A negative comparator result puts a before b;
      // positive puts it after; zero keeps them tied.
      const recipient=[...allies].sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp)[0];
      if(recipient) scene.resolveHeal(unit,recipient,Math.round(linkedHealing(unit, a, total, s.nextLinkedHealRatio)),a.name,false);
      s.nextLinkedHealRatio=0;
    }
  }
}
