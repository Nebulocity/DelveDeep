const STORAGE_KEY = 'delveDeep.leaderProgression.v1';

export const leaderAbilities = [
  { id: 'focusFire', name: 'Focus Fire', branch: 'Command', description: 'Mark one enemy as the raid priority target.', cost: 0, unlockedByDefault: true },
  { id: 'rally', name: 'Rally', branch: 'Command', description: 'Call the party back toward a rally point during battle.', cost: 1 },
  { id: 'coordinatedAssault', name: 'Coordinated Assault', branch: 'Command', description: 'Future: improve the payoff for sustained focus fire.', cost: 1 },
  { id: 'encouragement', name: 'Encouragement', branch: 'Morale', description: 'Future: soften morale loss after a difficult expedition.', cost: 1 },
  { id: 'brace', name: 'Brace!', branch: 'Survival', description: 'Future: trade offense for a short defensive response.', cost: 1 },
  { id: 'preparedSupplies', name: 'Prepared Supplies', branch: 'Logistics', description: 'Future: expand expedition consumable options.', cost: 1 }
];

const defaultLeader = () => ({
  level: 1,
  highestClearedDepth: 0,
  inspirationPoints: 0,
  spentInspiration: 0,
  unlockedAbilities: ['focusFire']
});

export function loadLeaderProgression() {
  const fallback = defaultLeader();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    return {
      ...fallback,
      ...saved,
      unlockedAbilities: Array.from(new Set(['focusFire', ...(saved.unlockedAbilities ?? [])]))
    };
  } catch (error) {
    console.warn('Could not load Raid Leader progression.', error);
    return fallback;
  }
}

export function saveLeaderProgression(leader) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leader));
  } catch (error) {
    console.warn('Could not save Raid Leader progression.', error);
  }
}

export function hasLeaderAbility(leader, abilityId) {
  return leader.unlockedAbilities.includes(abilityId);
}

export function purchaseLeaderAbility(leader, abilityId) {
  const ability = leaderAbilities.find((entry) => entry.id === abilityId);
  if (!ability || hasLeaderAbility(leader, abilityId) || leader.inspirationPoints < ability.cost) return false;
  leader.inspirationPoints -= ability.cost;
  leader.spentInspiration += ability.cost;
  leader.unlockedAbilities.push(abilityId);
  saveLeaderProgression(leader);
  return true;
}

export function recordDepthClear(leader, depth) {
  if (!Number.isFinite(depth) || depth <= leader.highestClearedDepth) {
    return { leveledUp: false, inspirationEarned: 0 };
  }

  const previousLevel = leader.level;
  leader.highestClearedDepth = depth;
  leader.level = Math.max(1, depth + 1);
  const previousMilestones = Math.floor(previousLevel / 5);
  const newMilestones = Math.floor(leader.level / 5);
  const inspirationEarned = Math.max(0, newMilestones - previousMilestones);
  leader.inspirationPoints += inspirationEarned;
  saveLeaderProgression(leader);
  return { leveledUp: leader.level > previousLevel, inspirationEarned };
}
