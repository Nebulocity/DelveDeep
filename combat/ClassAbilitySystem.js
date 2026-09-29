import { CLASS_DEFINITIONS } from '../data/classes.js';

// Grid spell geometry is independent of screen perspective. Diagonal neighbors
// count as one square; units continue to move freely inside their cells.
export function cellOf(scene, unit) {
  return scene.battlefield.arenaPointToCell(unit.arenaX ?? unit.x, unit.arenaY ?? unit.y);
}
export function squareDistance(scene, a, b) {
  const x = cellOf(scene, a), y = cellOf(scene, b);
  return Math.max(Math.abs(x.column - y.column), Math.abs(x.row - y.row));
}
export function zoneContains(scene, point, anchor, zone) {
  const p = cellOf(scene, point), a = cellOf(scene, anchor);
  const left = Math.max(0, Math.min(scene.battlefield.columns - zone[0], a.column - Math.floor((zone[0] - 1) / 2)));
  const bottom = Math.max(0, Math.min(scene.battlefield.rows - zone[1], a.row - Math.floor((zone[1] - 1) / 2)));
  return p.column >= left && p.column < left + zone[0] && p.row >= bottom && p.row < bottom + zone[1];
}
export function beamContains(scene, caster, target, point, range) {
  const g = scene.battlefield;
  const x = (target.arenaX - caster.arenaX) / (g.logicalWidth / g.columns);
  const y = (target.arenaY - caster.arenaY) / (g.logicalHeight / g.rows);
  const length = Math.hypot(x, y);
  if (!length) return false;
  const px = (point.arenaX - caster.arenaX) / (g.logicalWidth / g.columns);
  const py = (point.arenaY - caster.arenaY) / (g.logicalHeight / g.rows);
  const along = (px * x + py * y) / length;
  return along > 0 && along <= range && Math.abs(px * y - py * x) / length <= 0.5;
}

export default class ClassAbilitySystem {
  constructor(scene) { this.scene = scene; this.traps = []; }
  allies() { return this.scene.partyUnits.filter(u => u.alive); }
  enemies(unit) { return this.scene.getLivingEnemies().filter(e => unit.role === 'Tank' || this.scene.isEnemyEngaged(e)); }
  distance(a, b) { return squareDistance(this.scene, a, b); }
  canSacrifice(unit) {
    const scene = this.scene, wave = scene.waves?.[scene.currentWaveIndex];
    const others = scene.partyUnits.filter(ally => ally !== unit);
    const survivors = others.filter(ally => ally.alive);
    return unit.alive && !unit.delvesUsed?.honorSacrifice && !scene.battleOver
      && scene.currentWaveIndex === scene.waves?.length - 1 && wave?.boss === true
      && scene.getLivingEnemies().length > 0 && others.some(ally => !ally.alive)
      && survivors.length === 1 && survivors[0].role === 'Healer';
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
    if (s.refugeNext && s.refugeNext <= time && s.refugeNext <= s.refugeUntil) {
      this.scene.resolveHeal(unit, unit, s.refugePower, 'Scripted Refuge', false);
      s.refugeNext += s.refugeInterval;
    }
  }
  tickWorld(time) {
    for (const enemy of this.scene.getLivingEnemies()) {
      const poison = enemy.status.poison;
      while (poison && enemy.alive && poison.next <= time && poison.next <= poison.until) {
        this.scene.resolveDamage(poison.caster, enemy, poison.power, 'spell', 1, 'Poison', false);
        poison.next += poison.interval;
      }
    }
    this.traps = this.traps.filter(trap => {
      if (trap.wave !== this.scene.currentWaveIndex) return false;
      const target = this.scene.getLivingEnemies().find(e => this.distance(e, trap.point) === 0);
      if (!target) return true;
      this.resolve(trap.owner, target, { ...trap.ability, effect: 'damage' }, time);
      return false;
    });
  }
  adjacentPoint(unit, target, behind = false) {
    const scene = this.scene, cell = cellOf(scene, target);
    const facing = this.allies().find(a => a.id === target.currentTargetId);
    const points = [];
    for (let c = cell.column - 1; c <= cell.column + 1; c++) for (let r = cell.row - 1; r <= cell.row + 1; r++) {
      if (c < 0 || r < 0 || c >= scene.battlefield.columns || r >= scene.battlefield.rows || (c === cell.column && r === cell.row)) continue;
      const point = scene.battlefield.getCellCenter(c, r);
      if (this.canTeleport(unit, point)) points.push(point);
    }
    // Rear cells are opposite the monster's current target; otherwise use the nearest free cell.
    const score = p => behind && facing
      ? (p.x-target.arenaX)*(facing.arenaX-target.arenaX)+(p.y-target.arenaY)*(facing.arenaY-target.arenaY)
      : Math.hypot(p.x-unit.arenaX,p.y-unit.arenaY);
    return points.sort((a,b) => score(a)-score(b))[0];
  }
  trapPoint(unit, enemies) {
    const cell = cellOf(this.scene, unit), points = [];
    for (let c=cell.column-1;c<=cell.column+1;c++) for(let r=cell.row-1;r<=cell.row+1;r++) {
      if(c<0||r<0||c>=this.scene.battlefield.columns||r>=this.scene.battlefield.rows||(c===cell.column&&r===cell.row)) continue;
      const p=this.scene.battlefield.getCellCenter(c,r);
      if(this.canTeleport(unit,p)) points.push(p);
    }
    const score=p=>Math.min(...enemies.map(e=>Math.hypot(e.arenaX-p.x,e.arenaY-p.y)));
    const p=points.sort((a,b)=>score(a)-score(b))[0];
    return p ? {arenaX:p.x,arenaY:p.y,alive:true} : null;
  }
  canTeleport(unit, point) {
    const scene = this.scene, g = scene.battlefield;
    if (point.x < 0 || point.y < 0 || point.x > g.logicalWidth || point.y > g.logicalHeight) return false;
    if ([...this.allies(), ...scene.getLivingEnemies()].some(other => other !== unit && this.distance(other, point) === 0)) return false;
    const safe = scene.terrain?.nearestSafeUnitPoint(unit, point.x, point.y, 12) ?? point;
    return Math.hypot(safe.x - point.x, safe.y - point.y) < 1;
  }
  move(unit, point, time) {
    if (!unit.gridAbilities || !unit.canStartAction(time) || !unit.canCast(time) || !this.canTeleport(unit, point)) return false;
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
  escapePoint(unit, range) {
    const scene = this.scene, enemies = scene.getLivingEnemies(), points = [];
    for (let c = 0; c < scene.battlefield.columns; c++) for (let r = 0; r < scene.battlefield.rows; r++) {
      const p = scene.battlefield.getCellCenter(c, r);
      if (this.distance(unit, p) <= range && this.distance(unit, p) > 0 && this.canTeleport(unit, p)) points.push(p);
    }
    const safety = p => Math.min(...enemies.map(e => this.distance(e, p)));
    return points.sort((a, b) => safety(b) - safety(a))[0];
  }
  update(unit, time, delta) {
    const scene = this.scene;
    if (!unit.canStartAction(time) || !unit.canCast(time)) return;
    const enemies = this.enemies(unit), allies = this.allies();
    const injured = allies.filter(a => a.hp < a.maxHp).sort((a,b) => a.hp/a.maxHp - b.hp/b.maxHp);
    if (!scene.getLivingEnemies().some(e => e.id === scene.attackTargets.get(unit.id))) scene.attackTargets.delete(unit.id);
    const ordered = scene.attackTargets.get(unit.id);
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
        target = allies.filter(ally => ally !== unit && this.distance(unit, ally) <= a.range
          && enemies.some(enemy => enemy.currentTargetId === ally.id))
          .sort((x,y) => x.hp/x.maxHp-y.hp/y.maxHp)[0];
        if (!target) continue;
        this.cast(unit, target, key, time);
        return;
      }
      if (a.effect === 'teleport') {
        if (scene.isPositionLocked(unit) || !enemies.some(e => this.distance(unit, e) <= 1)) continue;
        const point = this.escapePoint(unit, Infinity);
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
        if (ordered) continue;
        target = injured.find(t => this.distance(unit,t) <= a.range);
        if (a.zone) target = this.bestZone(unit, a, injured);
        if (!target) continue;
      } else if (a.effect === 'trap') {
        if (!enemies.length) continue;
        target = this.trapPoint(unit, enemies);
        if (!target) continue;
      } else if (a.effect === 'damage' || a.effect === 'mark') {
        if (a.requiresStealth && !unit.stealthed) continue;
        if (unit.stealthed && !a.requiresStealth) continue;
        if ((a.charge || a.behind) && scene.isPositionLocked(unit)) continue;
        const inRange = enemies.filter(e => this.distance(unit,e) <= (a.radius ?? a.range));
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
    if (!unit.stealthed && preferred && scene.isWithinAttackReach(unit, preferred) && unit.canAttack(time)) {
      scene.beginBasicAttack(unit, preferred, time, ['Tank', 'Melee DPS'].includes(unit.role) ? 'melee' : unit.className === 'Ranger' ? 'ranged' : 'spell');
    }
    if (scene.isPositionLocked(unit)) return;
    const healTarget = unit.role === 'Healer' && !ordered ? injured[0] : null;
    if (healTarget) {
      if (this.distance(unit,healTarget)>3) unit.moveToward(healTarget.arenaX,healTarget.arenaY,delta,100);
      else if (preferred) scene.movement.maintainRange(unit,preferred,delta,true);
    } else if (preferred) scene.movement.moveToCombatPosition(unit,preferred,time,delta);
  }
  bestLine(unit, ability, candidates) {
    const scene=this.scene, g=scene.battlefield;
    let best=null, score=0;
    for(let c=0;c<g.columns;c++) for(let r=0;r<g.rows;r++) {
      const p=g.getCellCenter(c,r), point={arenaX:p.x,arenaY:p.y,alive:true};
      const length=Math.hypot((p.x-unit.arenaX)/(g.logicalWidth/g.columns),(p.y-unit.arenaY)/(g.logicalHeight/g.rows));
      if(!length || length>ability.range) continue;
      const count=candidates.filter(t=>beamContains(scene,unit,point,t,length+0.001)).length;
      if(count>score) { best=point; score=count; }
    }
    return best;
  }
  bestZone(unit, a, candidates) {
    const scene=this.scene;
    let best=null, score=0;
    for(let c=0;c<scene.battlefield.columns;c++) for(let r=0;r<scene.battlefield.rows;r++) {
      const point=scene.battlefield.getCellCenter(c,r);
      if(this.distance(unit,point)>a.range) continue;
      const count=candidates.filter(t=>zoneContains(scene,t,point,a.zone)).length;
      if(count>score) { score=count; best={arenaX:point.x,arenaY:point.y,alive:true}; }
    }
    return best;
  }
  cast(unit,target,key,time) {
    const scene=this.scene, a=unit.abilities[key];
    if(!unit.startAction(a.name,time,a.windup)) return;
    unit.spriteVisual?.play(a.effect === 'damage' ? 'attack' : 'block', target);
    unit.markAbilityUsed(key,time);
    scene.announceAbility(unit,a.name,'#fde68a');
    scene.logActionStart(unit,target===unit||a.zone?null:target,a.name);
    const action=unit.pendingAction;
    scene.time.delayedCall(a.windup,()=>{
      if(!scene.isActionCurrent(unit,action)) return;
      if(target.alive && (target===unit || this.distance(unit,target)<=(a.radius??a.range))) this.resolve(unit,target,a,scene.time.now);
      unit.finishAction();
    });
  }
  resolve(unit,target,a,time) {
    const scene=this.scene,s=unit.status,allies=this.allies();
    if(a.requiresStealth && !unit.stealthed) return;
    if(a.charge || a.behind) {
      if(scene.isPositionLocked(unit) || s.rootedUntil > time) return;
      const point=this.adjacentPoint(unit,target,a.behind);
      if(!point) return;
      unit.setArenaPosition(point.x,point.y);
    }
    if(a.effect==='vow' && target !== unit && target.alive && this.distance(unit,target)<=a.range) {
      const attackers=scene.getLivingEnemies().filter(enemy=>enemy.currentTargetId===target.id);
      scene.applyTankTaunt(unit,attackers,'vow',time,false);
      target.status.immuneUntil=time+a.immunityDuration;
    }
    if(a.effect==='stealth') {
      if(!scene.getLivingEnemies().some(e=>e.currentTargetId===unit.id)) unit.setStealthed(true);
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
    if(a.effect==='refuge') { s.nextHitReduction=0.5; s.refugeUntil=time+a.duration; s.refugeNext=time+a.interval; s.refugePower=a.power; s.refugeInterval=a.interval; }
    if(a.effect==='ascendance') {
      s.healingBoost=a.healingBoost; s.healingBoostUntil=time+a.duration;
      s.teleportUntil=time+a.duration; s.teleportRange=a.teleportRange;
      if(!scene.isPositionLocked(unit) && scene.getLivingEnemies().some(e=>this.distance(unit,e)<=1)) {
        const p=this.escapePoint(unit,a.teleportRange);
        if(p) { unit.setArenaPosition(p.x,p.y); s.teleportUntil=0; }
      }
    }
    if(a.effect==='heal') {
      const targets=a.zone?allies.filter(t=>zoneContains(scene,t,target,a.zone)):[target];
      let power=a.lowHealthPower && unit.hp/unit.maxHp<0.5?a.lowHealthPower:a.power;
      power += Math.max(0, (unit.healPower ?? 0) - (CLASS_DEFINITIONS[unit.className]?.healPower ?? 0));
      if(s.solarAegis&&!a.zone) {
        s.solarAegis=false;
        if(target===unit) power=unit.maxHp;
        else { power*=3; targets.push(unit); }
      }
      let healed=0;
      for(const t of targets) {
        const before=t.hp;
        scene.resolveHeal(unit,t,power,a.name);
        if(t.hp>before) healed++;
        if(a.retaliation) t.status.bramble={caster:unit,power:a.retaliation};
      }
      if(a.selfDamage) scene.resolveDamage(unit,unit,a.selfDamage,'spell',0,a.name,false);
      if(a.temporaryHp) s.temporaryHp=(s.temporaryHp??0)+healed*a.temporaryHp;
    }
    if(a.effect!=='damage') return;
    let targets=this.enemies(unit);
    if(a.zone) targets=targets.filter(t=>zoneContains(scene,t,target,a.zone));
    else if(a.radius) targets=targets.filter(t=>this.distance(unit,t)<=a.radius);
    else if(a.splash) targets=targets.filter(t=>this.distance(target,t)<=a.splash);
    else if(a.beam) {
      const g=scene.battlefield;
      const length=a.endpoint ? Math.min(a.range,Math.hypot(
        (target.arenaX-unit.arenaX)/(g.logicalWidth/g.columns),
        (target.arenaY-unit.arenaY)/(g.logicalHeight/g.rows)))+0.001 : a.range;
      targets=[...targets,...(a.friendlyFire?allies.filter(t=>t!==unit):[])]
        .filter(t=>beamContains(scene,unit,target,t,length));
    }
    else if(a.targets) targets=[target,...targets.filter(t=>t!==target&&this.distance(unit,t)<=a.range)].slice(0,a.targets);
    else targets=[target];
    let power=a.power;
    if(a.judgement && !allies.some(t=>t.id===target.currentTargetId&&t.role==='Tank')) power=a.highPower;
    if(a.missingHealthBonus) power*=1+(1-unit.hp/unit.maxHp);
    if (!a.poison) power += Math.max(0, unit.attackPower - (CLASS_DEFINITIONS[unit.className]?.attackPower ?? unit.attackPower));
    power*=1+(s.nextSpellBoost??0); s.nextSpellBoost=0;
    if (unit.stealthed) unit.setStealthed(false);
    let total=0;
    for(const t of targets) {
      const dealt=a.poison ? 0 : scene.resolveDamage(unit,t,power,a.damageType==='physical'?'melee':['holy','radiant'].includes(a.damageType)?'holy':'spell',a.totalThreat?0:1,a.name);
      total+=dealt??0;
      if (dealt === undefined && !a.poison) continue;
      if(a.stun&&t.alive) {
        t.status.stunnedUntil=Math.max(t.status.stunnedUntil??0,time+a.stun);
        t.status.hardStunUntil=Math.max(t.status.hardStunUntil??0,time+a.stun);
        t.finishAction?.();
      }
      if(a.blind&&t.alive) { t.status.blindUntil=time+a.blind; t.status.blindChance=a.blindChance; }
      if(a.poison&&t.alive) {
        t.status.poison={caster:unit,power:a.poison.power,interval:a.poison.interval,next:time+a.poison.interval,until:time+a.poison.duration};
        t.status.attackSlowUntil=time+a.poison.duration; t.status.attackSlow=a.attackSlow;
      }
      if(a.root&&t.alive) t.status.rootedUntil=time+a.root;
    }
    if(a.totalThreat) for(const t of targets) scene.addThreat(t,unit,total*a.totalThreat);
    if(a.healRatio&&total>0) {
      let recipients=allies;
      if(a.healScope==='lowest') recipients=[...allies].sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp).slice(0,1);
      if(a.healScope==='near') recipients=allies.filter(t=>this.distance(t,target)<=1);
      for(const t of recipients) scene.resolveHeal(unit,t,total*a.healRatio,a.name,false);
    }
  }
}
