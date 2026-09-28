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
  constructor(scene) { this.scene = scene; }
  allies() { return this.scene.partyUnits.filter(u => u.alive); }
  enemies(unit) { return this.scene.getLivingEnemies().filter(e => unit.role === 'Tank' || this.scene.isEnemyEngaged(e)); }
  distance(a, b) { return squareDistance(this.scene, a, b); }
  tick(unit, time) {
    const s = unit.status;
    if (s.refugeNext && s.refugeNext <= time && s.refugeNext <= s.refugeUntil) {
      this.scene.resolveHeal(unit, unit, s.refugePower, 'Scripted Refuge', false);
      s.refugeNext += s.refugeInterval;
    }
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
      if (!unit.abilityReady(key, time)) continue;
      let target = unit;
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
        return;
      }
      if (a.effect === 'heal') {
        if (ordered) continue;
        target = injured.find(t => this.distance(unit,t) <= a.range);
        if (a.zone) target = this.bestZone(unit, a, injured);
        if (!target) continue;
      } else if (a.effect === 'damage') {
        const inRange = enemies.filter(e => this.distance(unit,e) <= (a.radius ?? a.range));
        target = inRange.includes(preferred) ? preferred : inRange[0];
        if (a.zone) target = this.bestZone(unit, a, enemies);
        if (!target) continue;
      } else {
        const threatened = scene.getLivingEnemies().some(e => e.currentTargetId === unit.id);
        if (a.effect === 'aegis' && (!injured.length || unit.status.solarAegis || ordered)) continue;
        if (a.effect === 'stabilize' && !enemies.length) continue;
        if (a.effect === 'refuge' && unit.hp === unit.maxHp && !threatened) continue;
        if (a.effect === 'armor' && !threatened) continue;
        if (a.effect === 'ascendance' && !injured.length && !threatened) continue;
      }
      this.cast(unit, target, key, time);
      return;
    }
    if (preferred && scene.isWithinAttackReach(unit, preferred) && unit.canAttack(time)) {
      scene.beginBasicAttack(unit, preferred, time, unit.role === 'Tank' ? 'melee' : 'spell');
    }
    if (scene.isPositionLocked(unit)) return;
    const healTarget = unit.role === 'Healer' && !ordered ? injured[0] : null;
    if (healTarget) {
      if (this.distance(unit,healTarget)>3) unit.moveToward(healTarget.arenaX,healTarget.arenaY,delta,100);
      else if (preferred) scene.movement.maintainRange(unit,preferred,delta,true);
    } else if (preferred) scene.movement.moveToCombatPosition(unit,preferred,time,delta);
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
    else if(a.beam) targets=[...targets,...(a.friendlyFire?allies.filter(t=>t!==unit):[])].filter(t=>beamContains(scene,unit,target,t,a.range));
    else if(a.targets) targets=[target,...targets.filter(t=>t!==target&&this.distance(unit,t)<=a.range)].slice(0,a.targets);
    else targets=[target];
    let power=a.power;
    if(a.judgement && !allies.some(t=>t.id===target.currentTargetId&&t.role==='Tank')) power=a.highPower;
    if(a.missingHealthBonus) power*=1+(1-unit.hp/unit.maxHp);
    power += Math.max(0, unit.attackPower - (CLASS_DEFINITIONS[unit.className]?.attackPower ?? unit.attackPower));
    power*=1+(s.nextSpellBoost??0); s.nextSpellBoost=0;
    let total=0;
    for(const t of targets) {
      total+=scene.resolveDamage(unit,t,power,['holy','radiant'].includes(a.damageType)?'holy':'spell',a.totalThreat?0:1,a.name)??0;
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
