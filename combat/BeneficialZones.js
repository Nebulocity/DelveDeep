// Read-only views of resolver-owned records. No buffs, triggers or render objects are
// created here; estimates cover at most four seconds of currently visible combat.
import { arenaDistance } from '../config/combatRanges.js';
import { replacementAmount, replacementMultiplier } from './ReplacementEffects.js';
import { missingHealth } from './CombatDecisions.js';

const FRIENDLY = new Set(['runeDamage', 'runeSpeed', 'runeMovement', 'runeReduction',
  'runeMercy', 'runeMana', 'runeMirror', 'healingAura']);

export function zoneMoveSpeed(unit, time) {
  return unit.moveSpeed * replacementMultiplier(unit, 'movement', time)
    * (unit.status.moveSpeedBonusUntil > time ? 1 + unit.status.moveSpeedBonus : 1)
    * (unit.status.moveSpeedSlowUntil > time ? 1 - unit.status.moveSpeedSlow : 1);
}

export function beneficialZones(system, time) {
  if (system.scene.battleOver) return [];
  return system.allies().flatMap(owner => (owner.status.replacementZones ?? [])
    .filter(zone => zone.until > time && zone.wave === system.scene.currentWaveIndex && FRIENDLY.has(zone.ability.handler))
    .map(zone => ({ owner, ability: zone.ability, point: zone.ability.handler === 'healingAura'
      && zone.ability.anchor === 'Caster' ? owner : zone.point, until: zone.until, record: zone })));
}

// Use an ordinary attack's expected value and cadence, even while its cooldown is
// running. An unavailable target or a healer occupied with recovery earns no output.
export function zoneAttackRate(context, ally, point, estimate, horizon = 4000, delay = 0) {
  const { scene, time } = context;
  const target = scene.getPrimaryTarget(ally, false);
  if (!target || ally.stealthed || ally.status.stunnedUntil > time || ally.status.replacementTruceUntil > time
    || ally.basicAttackDamageType !== 'spell' && ally.status.replacementDisarmUntil > time
    || ally.role === 'Healer' && context.allies.some(other => other.hp / other.maxHp < .8)) return 0;
  const reach = ally.attackRange + (scene.movement.isMeleeUnit(ally) ? scene.movement.config.meleeReachPadding : 0);
  if (arenaDistance(point, target) > reach) return 0;
  const wait = Math.max(0, Math.max((ally.lastAttackAt ?? -Infinity) + ally.attackCooldown,
    ally.busyUntil ?? 0, ally.pendingAction ? ally.pendingAction.startAt + ally.pendingAction.duration : 0) - time - delay);
  if (wait + ally.attackWindup > horizon) return 0;
  return estimate(scene, ally, target, ally.attackPower, ally.basicAttackDamageType !== 'spell', time, 0, true, { remaining: 0 })
    / target.maxHp / (Math.max(300, ally.attackCooldown, ally.attackWindup) / 1000) * (1 - wait / horizon);
}

export function zoneValue(context, zone, ally, point, estimate, delay = 0, manaPayment = 0) {
  if (!ally.alive || ally.isDecoy || arenaDistance(point, zone.point) > zone.ability.radius) return 0;
  const remaining = Math.min(4000, zone.until - context.time - delay);
  if (remaining <= 0) return 0;
  const a = zone.ability, h = a.handler, seconds = remaining / 1000;
  const danger = context.risk(ally, delay, remaining);
  if (h === 'runeDamage' || h === 'runeSpeed') {
    const stat = h === 'runeDamage' ? 'damage' : 'speed';
    const own = (ally.status.replacementEffects ?? []).find(effect => effect.key === a.id + ':beneficial'
      && effect.until > context.time);
    const already = own ? Math.max(.1, 1 + (own.changes[stat] ?? 0)) : 1;
    return zoneAttackRate(context, ally, point, estimate, remaining, delay) / already * a.primary.potency * seconds;
  }
  if (h === 'runeMovement') {
    if (context.scene.isPositionLocked(ally) || context.scene.manualTargets?.has(ally.id)
      || ally.status.rootedUntil > context.time || ally.status.replacementCostRootUntil > context.time) return 0;
    const target = context.scene.getPrimaryTarget(ally, false);
    if (!target || context.scene.isWithinAttackReach(ally, target)) return 0;
    const distance = Math.max(0, arenaDistance(ally, target) - ally.attackRange);
    const speed = Math.max(1, zoneMoveSpeed(ally, context.time));
    const travel = Math.min(seconds, distance / speed, a.radius / speed);
    return zoneAttackRate(context, ally, target, estimate) * travel * a.primary.potency / (1 + a.primary.potency) * .5;
  }
  if (h === 'runeReduction') return danger.incoming / ally.maxHp * a.primary.potency;
  if (h === 'runeMercy') {
    if (ally.hp - danger.incoming >= ally.maxHp * .35) return 0;
    const likelihood = ally.hp / ally.maxHp < .35 ? 1 : .5;
    return Math.min(missingHealth(context.scene, ally) + danger.incoming,
      replacementAmount(zone.owner, ally, a.primary)) / ally.maxHp * likelihood * (danger.tier >= 2 ? 2 : 1);
  }
  if (h === 'runeMana') {
    const mana = ally.mana - manaPayment;
    if (!ally.maxMana || mana / ally.maxMana >= .7) return 0;
    return Math.min(ally.maxMana - mana, replacementAmount(zone.owner, ally, a.primary)) / ally.maxMana;
  }
  if (h === 'runeMirror') {
    const reflected = danger.threats.filter(hit => !hit.skill && !hit.area)
      .reduce((sum, hit) => sum + hit.amount * Math.min(.4, Math.max(0, hit.enemy.critChance ?? 0)) * a.primary.potency, 0);
    return context.enemies.filter(enemy => arenaDistance(enemy, zone.point) <= a.radius)
      .reduce((sum, enemy) => sum + Math.min(enemy.hp, reflected) / enemy.maxHp, 0) * .5;
  }
  if (h === 'healingAura') return Math.min(missingHealth(context.scene, ally),
    replacementAmount(zone.owner, ally, a.primary) * remaining / Math.max(1, a.duration)) / ally.maxHp;
  return 0;
}

export function positionZoneValue(context, zones, ally, point, estimate, delay = 0) {
  const values = new Map();
  for (const zone of zones) {

    // Movement buffs never justify seeking themselves. Named modifiers refresh rather
    // than stack; single-use recovery belongs only to the first eligible recipient.
    if (zone.ability.handler === 'runeMovement') continue;
    if (['runeMercy', 'runeMana'].includes(zone.ability.handler)) {
      const first = context.allies.find(other => zoneValue(context, zone, other,
        other === ally ? point : other, estimate, delay) > 0);
      if (first !== ally) continue;
    }
    const value = zoneValue(context, zone, ally, point, estimate, delay);
    values.set(zone.ability.id, Math.max(values.get(zone.ability.id) ?? 0, value));
  }
  return [...values.values()].reduce((sum, value) => sum + value, 0);
}

export function evaluateRune(system, unit, ability, target, time, context, estimate, basics) {
  const h = ability.handler;
  let benefit = 0, tier = 1;
  const zones = beneficialZones(system, time);
  const zone = { owner: unit, ability, point: unit, until: time + ability.windup + ability.duration };
  const strike = ['runeCadence', 'runeFlourish', 'runeTraverse', 'runeFinale'].includes(h);
  const opening = { remaining: unit.status.nextAttackBoost ?? 0 };
  const damage = (enemy, effect, physical, scale = 1) => estimate(system.scene, unit, enemy,
    replacementAmount(unit, enemy, effect) * scale, physical, time, 0, false, opening, ability.criticalBonus ?? 0) / enemy.maxHp;
  if (strike) {
    if (h === 'runeTraverse') return null;
    const enemies = h === 'runeFinale' ? context.enemies.filter(enemy => arenaDistance(unit, enemy) <= ability.radius) : [target];
    for (const enemy of enemies) benefit += damage(enemy, ability.primary, ability.damageType === 'physical');
    if (h === 'runeFinale') for (const enemy of enemies) benefit += damage(enemy, ability.secondary, false);
    if (h === 'runeCadence') {
      const wait = Math.max(ability.windup, (unit.lastAttackAt ?? -Infinity) + unit.attackCooldown - time) + unit.attackWindup;
      if (wait < ability.duration && zoneAttackRate(context, unit, unit, estimate) > 0) {
        for (const enemy of context.enemies.filter(enemy => arenaDistance(unit, enemy) <= ability.radius)) {
          benefit += damage(enemy, ability.secondary, false) * .5;
        }
      }
    }
    if (h === 'runeFlourish') for (const enemy of context.enemies.filter(enemy => arenaDistance(target, enemy) <= ability.radius)) {
      benefit += damage(enemy, ability.secondary, false, Math.min(4000, ability.duration) / ability.duration) * .5;
    }
  } else if (h === 'runeSnare') {
    for (const enemy of context.enemies.filter(enemy => arenaDistance(unit, enemy) <= ability.radius)) {
      benefit += damage(enemy, ability.primary, false);
      const pursuing = !enemy.pendingAction && enemy.currentTargetId && arenaDistance(enemy,
        context.allies.find(ally => ally.id === enemy.currentTargetId) ?? enemy) > enemy.attackRange;
      if (pursuing && !enemy.controlImmunities?.includes('root') && !(enemy.status.rootedUntil > time)) {
        benefit += .03 * Math.min(2, ability.secondaryDuration / 1000);
      }
    }
  } else if (FRIENDLY.has(h)) {
    for (const ally of context.allies) {
      if (zones.some(existing => existing.ability.id === ability.id && existing.until > time + ability.windup
        && arenaDistance(ally, existing.point) <= ability.radius)) continue;
      const value = zoneValue(context, zone, ally, ally, estimate, ability.windup, ally === unit ? ability.manaCost : 0);
      benefit = h === 'runeMirror' ? Math.max(benefit, value) : benefit + value;
      if (value > 0 && ['runeMercy', 'runeReduction'].includes(h)) tier = Math.max(tier, context.risk(ally, ability.windup, ability.duration).tier);
      if (value > 0 && ['runeMercy', 'runeMana'].includes(h)) break;
    }
    if (h === 'runeMirror') benefit = Math.min(benefit, .5);
  } else return null;
  const cost = ability.manaCost / Math.max(1, unit.maxMana);
  const rate = Math.max(0, ...basics.map(action => action.assessment.score));
  const net = Math.max(0, benefit - (strike ? 0 : rate * ability.windup / 1000) - cost);
  return { tier: Math.max(1, tier), benefit, score: net / (Math.max(300, ability.windup) / 1000)
    / (1 + 4 * cost) / (strike ? 1 : 1 + .15 * Math.min(2, ability.cooldown / 30000)) };
}
