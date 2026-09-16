const STORAGE_KEY = 'delveDeep.leaderProgression.v1';

export const leaderAbilities = [
  { id: 'focusFire', name: 'Focus Fire', shortName: 'FOCUS FIRE', branch: 'Command', description: 'Choose a shared enemy target. Healers keep healing.', cost: 0, cooldown: 10000, unlockedByDefault: true },
  { id: 'rally', name: 'Rally', shortName: 'RALLY', branch: 'Command', description: 'Gather all living allies at a point and hold there.', cost: 1, cooldown: 12000 },
  { id: 'coordinatedAssault', name: 'Coordinated Assault', shortName: 'ASSAULT', branch: 'Command', description: 'All allies deal 20% more damage for 8 seconds.', cost: 1, cooldown: 24000, duration: 8000, damageBonus: 0.2 },
  { id: 'encouragement', name: 'Encouragement', shortName: 'ENCOURAGE', branch: 'Morale', description: 'Restore 25% maximum health to every living ally.', cost: 1, cooldown: 20000, healFraction: 0.25 },
  { id: 'brace', name: 'Brace!', shortName: 'BRACE!', branch: 'Survival', description: 'All allies take 30% less damage for 8 seconds.', cost: 1, cooldown: 24000, duration: 8000, damageReduction: 0.3 },
  { id: 'preparedSupplies', name: 'Prepared Supplies', shortName: 'SUPPLIES', branch: 'Logistics', description: 'Add one Healing Tonic. Once per encounter.', cost: 1, oncePerEncounter: true, tonicAmount: 1 },
  { id: 'arise', name: 'Arise!', shortName: 'ARISE!', branch: 'Survival', description: 'Revive all fallen allies at 50% HP and mana. Once per encounter.', cost: 2, oncePerEncounter: true, healthFraction: 0.5, manaFraction: 0.5 }
];

// This function starts a new Raid Leader with Focus Fire available and
// equipped.
const defaultLeader = () => ({

  level: 1,
  highestClearedDepth: 0,
  tacticsPoints: 0,
  spentTacticsPoints: 0,
  unlockedAbilities: ['focusFire'],
  battleLoadout: ['focusFire']
});

// This function restores Raid Leader progress with valid defaults and loadout
// entries.
export function loadLeaderProgression() {

  const fallback = defaultLeader();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);

    // Older saves used Inspiration names. Preserve those balances while
    // writing only the new TP fields on the next save.
    const { inspirationPoints, spentInspiration, ...progress } = saved;
    const known = new Set(leaderAbilities.map((ability) => ability.id));
    const unlocked = Array.from(new Set(['focusFire', ...(saved.unlockedAbilities ?? [])]))
      .filter((id) => known.has(id));
    return {
      ...fallback,
      ...progress,
      tacticsPoints: Math.max(0, saved.tacticsPoints ?? inspirationPoints ?? 0),
      spentTacticsPoints: Math.max(0, saved.spentTacticsPoints ?? spentInspiration ?? 0),
      unlockedAbilities: unlocked,
      battleLoadout: Array.from(new Set(saved.battleLoadout ?? ['focusFire'])).filter((id) => unlocked.includes(id)).slice(0, 5)
    };
  } catch (error) {
    console.warn('Could not load Battle Tactics progression.', error);
    return fallback;
  }
}

// This function saves Raid Leader advancement separately from the main
// profile.
export function saveLeaderProgression(leader) {

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leader));
  } catch (error) {
    console.warn('Could not save Battle Tactics progression.', error);
  }
}

// This function checks which leadership abilities the player has unlocked.
export function hasLeaderAbility(leader, abilityId) {

  return leader.unlockedAbilities.includes(abilityId);
}

// This function spends available Tactics Points to unlock a leadership ability
// once.
export function purchaseLeaderAbility(leader, abilityId) {

  const ability = leaderAbilities.find((entry) => entry.id === abilityId);
  if (!ability || hasLeaderAbility(leader, abilityId) || leader.tacticsPoints < ability.cost) return false;
  leader.tacticsPoints -= ability.cost;
  leader.spentTacticsPoints += ability.cost;
  leader.unlockedAbilities.push(abilityId);
  saveLeaderProgression(leader);
  return true;
}

// This function grants leader levels and awards one TP for each five-level
// milestone crossed. The Dev button and depth progression use the same rule.
export function grantLeaderLevels(leader, amount = 1) {

  const previousLevel = leader.level;
  const gained = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  leader.level += gained;
  const tacticsPointsEarned = Math.floor(leader.level / 5) - Math.floor(previousLevel / 5);
  leader.tacticsPoints += tacticsPointsEarned;
  saveLeaderProgression(leader);
  return { leveledUp: gained > 0, tacticsPointsEarned };
}

// This function records a new depth and grants any corresponding leader
// levels. Developer-granted levels are never reduced by clearing a lower
// depth, and repeated clears cannot award the same milestone twice.
export function recordDepthClear(leader, depth) {

  if (!Number.isFinite(depth) || depth <= leader.highestClearedDepth) {
    return { leveledUp: false, tacticsPointsEarned: 0 };
  }
  leader.highestClearedDepth = depth;
  return grantLeaderLevels(leader, Math.max(0, depth + 1 - leader.level));
}

// This function lets the player equip up to five unlocked leadership
// abilities.
export function toggleLeaderLoadoutAbility(leader, abilityId) {

  if (!hasLeaderAbility(leader, abilityId)) return false;

  // Normalize missing loadout data before toggling the ability; adding a
  // sixth entry is rejected.
  leader.battleLoadout = Array.isArray(leader.battleLoadout) ? leader.battleLoadout : [];
  if (leader.battleLoadout.includes(abilityId)) {
    leader.battleLoadout = leader.battleLoadout.filter((id) => id !== abilityId);
  } else {
    if (leader.battleLoadout.length >= 5) return false;
    leader.battleLoadout.push(abilityId);
  }
  saveLeaderProgression(leader);
  return true;
}

// This function removes Raid Leader progress as part of a fresh start.
export function clearLeaderProgression() {

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Could not clear Battle Tactics progression.', error);
  }
}
