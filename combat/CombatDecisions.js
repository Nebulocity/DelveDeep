// These estimates guide decisions, but never apply damage or change combat stats.
// Distances are logical arena units and times are milliseconds on the battle clock.
import { abilityPower } from '../game/CharacterStats.js';

// Count nearby attackers and committed hostile hits. Distant pursuit alone should not
// spend a shield before the enemy can threaten its recipient.
export function incomingPressure(scene, ally) {
  let pressure = 0;
  for (const enemy of scene.getLivingEnemies()) {
    if (enemy.currentTargetId !== ally.id) continue;
    const distance = Math.hypot(enemy.arenaX - ally.arenaX, enemy.arenaY - ally.arenaY);
    const reach = enemy.attackRange ?? 100;
    const committedHit = enemy.pendingAction && !enemy.pendingAction.healingReservations;
    if (committedHit || distance <= reach + 90) pressure += 1;
  }
  for (const warning of scene.activeTelegraphs ?? []) {
    if (Math.hypot(ally.arenaX - warning.arenaX, ally.arenaY - warning.arenaY)
      <= warning.radius + (ally.bodyRadius ?? 20)) pressure += 2;
  }
  return pressure;
}

// Read committed heals from live actions. Cancellation clears the action, so it also
// releases the reservation. Optional action fields travel with existing battle saves.
export function missingHealth(scene, target) {
  let promised = 0;
  for (const actor of [...(scene.partyUnits ?? []), ...(scene.enemies ?? [])]) {
    if (!actor.alive || actor.isEnemy !== target.isEnemy) continue;
    promised += actor.pendingAction?.healingReservations?.[target.id] ?? 0;
  }
  return Math.max(0, target.maxHp - target.hp - promised);
}

// Fragile allies under attack can be more urgent than a safe tank with a lower HP ratio.
export function healingUrgency(scene, target) {
  const missing = missingHealth(scene, target) / target.maxHp;
  return missing + incomingPressure(scene, target) * missing * 0.3;
}

// Reserve only the expected restoration, never overhealing. Multiple healers then see
// what remains to be treated rather than all choosing the same nearly healed ally.
export function reserveHealing(actor, targets, power) {
  if (!actor.pendingAction) return;
  actor.pendingAction.healingReservations = Object.fromEntries(targets.map(target =>
    [target.id, Math.min(target.maxHp - target.hp, power)]));
}

// Avoid paying a long cooldown for a scratch. Critical allies bypass efficiency checks.
export function usefulHeal(scene, caster, target, ability) {
  const missing = missingHealth(scene, target);
  const power = abilityPower(caster, ability, ability.power, true);
  return missing > 0 && (target.hp / target.maxHp < 0.4
    || missing >= Math.min(power * 0.35, target.maxHp * 0.15));
}
