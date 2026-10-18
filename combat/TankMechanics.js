// Tank protection uses existing hit resolution and ordinary threat, never target control.
import { ADJACENT_DISTANCE, NEAR_DISTANCE, arenaDistance } from '../config/combatRanges.js';

export const HOLD_THE_LINE = 'ability_v2_generic_physical_hold_the_line';
export const INTERVENE = 'ability_v2_generic_physical_intervene';
export const INTERPOSE = 'ability_v2_generic_physical_interpose';
export const VIGILANCE = 'ability_v2_oathwarden_vigilance';
export const PERIMETER_RADIUS = 2 * ADJACENT_DISTANCE;
export const PERIMETER_REDUCTION = .1;
export const PERIMETER_THREAT_FRACTION = .1;
export const BLOCK_THREAT_FRACTION = .15;
export const INTERCEPT_THREAT_FRACTION = .2;
export const REACTIVE_THREAT_CAP = .5;
export const SECONDARY_THREAT = {
  ability_v2_oathwarden_righteous_blow: { radius: ADJACENT_DISTANCE, fraction: .2 },
  ability_v2_gladiator_offensive_drill: { radius: 1.5 * ADJACENT_DISTANCE, fraction: .35 }
};

// Boss metadata and explicit control immunity are authoritative for every taunt path.
export function canTankTaunt(enemy) {
  return Boolean(enemy?.alive && !enemy.isBoss && !enemy.controlImmunities?.includes('taunt'));
}

export function maintainedHold(scene, unit, time) {
  return unit.alive && unit.status.replacementCostRootUntil > time
    && unit.status.replacementEffects?.some(effect => effect.key === HOLD_THE_LINE + ':beneficial' && effect.until > time)
    && scene.getLivingEnemies().some(enemy => arenaDistance(unit, enemy) <= NEAR_DISTANCE);
}

// Overlapping copies of the same perimeter grant one reduction and one protector.
export function perimeterOwner(scene, target, time) {
  if (target.isEnemy || target.isDecoy || !target.alive) return null;
  return scene.partyUnits.filter(owner => owner !== target && maintainedHold(scene, owner, time)
    && arenaDistance(owner, target) <= PERIMETER_RADIUS)
    .sort((a, b) => arenaDistance(a, target) - arenaDistance(b, target) || String(a.id).localeCompare(String(b.id)))[0] ?? null;
}

// Cap each reactive grant at half an unmodified basic tank hit's threat. No floor,
// pulse, prepared bonus or recursive threat multiplier can amplify these reactions.
export function reactiveTankThreat(scene, owner, enemy, damage, fraction) {
  if (!owner?.alive || !enemy?.alive || !enemy.isEnemy || owner.isEnemy || damage <= 0) return 0;
  const multiplier = owner.threatMultiplier ?? 1;
  const reduction = scene.time.now < (owner.status.threatReductionUntil ?? 0) ? 1 - (owner.status.threatReduction ?? 0) : 1;
  const threat = Math.max(0, Math.min(damage * multiplier * fraction,
    (owner.attackPower ?? 0) * multiplier * REACTIVE_THREAT_CAP) * reduction);
  if (threat > 0) scene.addThreat(enemy, owner, threat);
  return threat;
}

export function spreadHitThreat(scene, caster, target, ability, normalThreat, impactPoint) {
  const spread = SECONDARY_THREAT[ability.id];
  if (!spread || !caster.alive || !(normalThreat > 0)) return;
  for (const enemy of scene.getLivingEnemies()) {
    if (enemy !== target && arenaDistance(enemy, impactPoint) <= spread.radius) {
      scene.addThreat(enemy, caster, normalThreat * spread.fraction);
    }
  }
}
