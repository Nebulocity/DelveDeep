// Visible Pineshire combat adds durability and incoming pressure to ordinary
// monsters. Keep these multipliers separate from the established idle/boss profiles.
// Health 1.15 adds 15%; power 1.25 adds 25%. Ordinary waves override power below.
export const ACTIVE_MONSTER_BALANCE = { health: 1.15, power: 1.25 };

// Individual encounters can refine active pressure without changing their idle totals.
// These factors multiply the already tuned idle power, rather than the raw catalog.
export const ACTIVE_MONSTER_POWER = {
  'slime-cave': 1.75, 'thornbriar-hollow': 2.2, 'dolmark-den': 3, 'old-quarry': 2.3,
  'sunken-watch': 1.75, 'murmuring-abyss': 4
};

// A Set holds each encounter ID once. has checks whether a Delve belongs to this group.
const PINESHIRE_ENCOUNTERS = new Set([
  'slime-cave', 'thornbriar-hollow', 'dolmark-den', 'old-quarry',
  'sunken-watch', 'murmuring-abyss'
]);

// Idle means the app is away or catching up, even if the return summary is visible.
// Leaving the battle visible and focused without tapping still counts as active combat.
export function isActiveCombat(scene) {
  const background = scene.game?.backgroundProgress;

  // Fifty milliseconds is one background replay step. Pending debt at that size still
  // belongs to catch-up, even after the app becomes visible again.
  return !scene.idleSimulating && !background?.hidden && !background?.isReplaying
    && !(background?.pendingMs >= 50);
}

// Remember the already tuned live stats, including Thornbriar's local overrides and
// boss-wave escort scales. Old saved units skip this setup and retain their stats.
export function prepareActiveMonster(enemy, scene, delve) {
  const id = delve?.encounterId ?? delve?.id;
  if (scene.restoringBattle || enemy.isBoss || !PINESHIRE_ENCOUNTERS.has(id)) return;

  // Final-boss escorts already use stronger boss-preparation totals. Give those ordinary
  // monsters the shared modest increment, rather than the full progression/farm boost.
  const bossEscort = Number.isInteger(scene.bossWaveIndex) && scene.currentWaveIndex === scene.bossWaveIndex;
  enemy.activeCombatBalance = {
    active: false,
    healthScale: ACTIVE_MONSTER_BALANCE.health,
    powerScale: bossEscort ? ACTIVE_MONSTER_BALANCE.power : ACTIVE_MONSTER_POWER[id] ?? ACTIVE_MONSTER_BALANCE.power,
    maxHp: enemy.maxHp,
    attackPower: enemy.attackPower,
    spellDamage: enemy.spellDamage,
    spellHealing: enemy.spellHealing
  };
  syncActiveMonster(enemy, isActiveCombat(scene));
}

// Switch from saved baseline totals instead of multiplying current stats repeatedly.
// Keep the same Health fraction, so backgrounding neither heals nor hurts a monster.
export function syncActiveMonster(enemy, active) {
  const balance = enemy.activeCombatBalance;
  if (!balance || balance.active === active) return;
  const healthFraction = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;
  const healthScale = active ? balance.healthScale : 1;
  const powerScale = active ? balance.powerScale : 1;
  enemy.maxHp = Math.round(balance.maxHp * healthScale);
  enemy.hp = healthFraction * enemy.maxHp;
  for (const stat of ['attackPower', 'spellDamage', 'spellHealing']) {
    enemy[stat] = balance[stat] * powerScale;
  }
  balance.active = active;
  enemy.updateHealthBar?.();
}

// Run on mode changes before combat timers resolve, and on visible frame updates.
// Optional unit data is saved by the existing version-1 snapshot serializer.
export function syncActiveCombat(scene, active = isActiveCombat(scene)) {
  for (const enemy of scene.enemies ?? []) syncActiveMonster(enemy, active);
}
