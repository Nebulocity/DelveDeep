// Planning is read-only. The committed classAbility events own travel and arrival.
import { arenaDistance, ADJACENT_DISTANCE } from '../config/combatRanges.js';
import { replacementMultiplier } from './ReplacementEffects.js';

export function interveneLocked(scene, unit, time) {
  return scene.isPositionLocked(unit) || scene.manualTargets?.has(unit.id) || unit.criticalKnockback
    || unit.status.rootedUntil > time || unit.status.stunnedUntil > time
    || unit.status.replacementCostRootUntil > time || unit.status.replacementChannel?.until > time;
}

export function interveneSpeed(unit, time) {
  const bonus = time < (unit.status.moveSpeedBonusUntil ?? 0) ? 1 + unit.status.moveSpeedBonus : 1;
  const slow = time < (unit.status.moveSpeedSlowUntil ?? 0) ? 1 - unit.status.moveSpeedSlow : 1;
  return Math.max(0, unit.moveSpeed * bonus * slow * replacementMultiplier(unit, 'movement', time) * 3);
}

// The same landing/route request serves AI, commitment, launch and bounded pursuit.
export function intervenePlan(system, unit, target, ability, time, options = {}) {
  const scene = system.scene, movement = scene.movement, context = options.context;
  const key = unit.id + '/' + target?.id + '/' + ability.id;
  if (!options.travelling && context?.intervenePlans.has(key)) return context.intervenePlans.get(key);
  const remember = plan => {
    if (!options.travelling && context) context.intervenePlans.set(key, plan);
    return plan;
  };
  if (!target?.alive || target === unit || interveneLocked(scene, unit, time)) return remember(null);
  const mode = system.enemies().includes(target) ? 'offensive' : system.allies().includes(target) ? 'defensive' : null;
  const origin = options.origin ?? unit;
  if (!mode || arenaDistance(origin, target) > ability.range * ADJACENT_DISTANCE
    || !options.travelling && mode === 'offensive'
      && (arenaDistance(unit, target) < 2 * ADJACENT_DISTANCE || scene.isWithinAttackReach(unit, target))) return remember(null);
  const speed = interveneSpeed(unit, time);
  if (!(speed > 0)) return remember(null);
  const clearance = Math.max(movement.config.normal, (unit.bodyRadius ?? 0) + (target.bodyRadius ?? 0)
    + movement.config.personalSpaceGap);
  const reach = mode === 'offensive' ? unit.attackRange + movement.config.meleeReachPadding : ADJACENT_DISTANCE;
  const radius = Math.min(reach, clearance + 12);
  if (radius < clearance) return remember(null);
  const victim = mode === 'offensive' ? system.allies().find(ally => ally !== unit && ally.id === target.currentTargetId)
    : system.enemies().find(enemy => enemy.id === options.attackerId)
      ?? system.enemies().filter(enemy => enemy.currentTargetId === target.id)
        .sort((a, b) => arenaDistance(a, target) - arenaDistance(b, target))[0];
  const angle = Math.atan2(unit.arenaY - target.arenaY, unit.arenaX - target.arenaX);
  const points = Array.from({ length: 8 }, (_, index) => ({ x: target.arenaX + Math.cos(angle + index * Math.PI / 4) * radius,
    y: target.arenaY + Math.sin(angle + index * Math.PI / 4) * radius }));
  const urgent = context?.risk(target).tier >= 2 || options.allowBrace;
  if (mode === 'defensive' && urgent && arenaDistance(unit, target) <= ADJACENT_DISTANCE)
    points.unshift({ x: unit.arenaX, y: unit.arenaY });
  const roar = Object.values(unit.abilities).find(skill => skill.id === 'ability_v2_gladiator_defiant_roar');
  const coverage = point => roar ? system.enemies().filter(enemy => arenaDistance(point, enemy) <= roar.radius
    && system.rescuePriority(unit, enemy) > 0).length : 0;
  const preference = point => Math.min(2, coverage(point)) * 20 + (victim
    ? 16 * ((point.x - target.arenaX) * (victim.arenaX - target.arenaX)
      + (point.y - target.arenaY) * (victim.arenaY - target.arenaY))
      / Math.max(1, radius * arenaDistance(victim, target)) : 0);
  points.sort((a, b) => arenaDistance(unit, a) - preference(a) - arenaDistance(unit, b) + preference(b));
  const maxDistance = options.remainingDistance ?? ability.range * ADJACENT_DISTANCE;
  const collision = movement.rushClearanceContext(unit, target);
  const legal = [], obstructed = [];
  let blocked = null;
  for (const point of points) {
    const route = movement.getRushRoute(unit, point, maxDistance, collision, { remaining: 0 });
    if (route.waypoints) legal.push({ point, ...route });
    else {
      blocked ??= route.blocked;
      if (!['landing', 'reach'].includes(route.blocked.stage)) obstructed.push(point);
    }
  }

  // Try at most two promising detours, sharing a small search budget across AI candidates.
  const budget = options.budget ?? context?.interveneRouteBudget ?? { remaining: 128 };
  for (const point of obstructed.slice(0, 2)) {
    const shortest = Math.min(Infinity, ...legal.map(route => route.distance));
    if (arenaDistance(unit, point) > shortest + 40) continue;
    const route = movement.getRushRoute(unit, point, maxDistance, collision, budget);
    if (route.waypoints) legal.push({ point, ...route });
    else blocked = route.blocked;
  }
  if (!legal.length) {
    if (options.failure) Object.assign(options.failure, blocked ?? { reason: 'no_legal_landing' });
    return remember(null);
  }
  const shortest = Math.min(...legal.map(route => route.distance));
  legal.sort((a, b) => a.distance - preference(a.point) - b.distance + preference(b.point));
  const best = legal.find(route => route.distance <= shortest + 40) ?? legal[0];
  return remember({ ...best, mode, travelMs: best.distance / speed * 1000, coverage: coverage(best.point), attackerId: victim?.id });
}
