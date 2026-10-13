// The player's Renown Level and Renown Points are separate from adventurer XP and skill points.
// Legacy storage still calls Renown level "level". Keep that saved name compatible while
// using the current player-facing label. Unlocks and equipped tactics are separate lists.

import { LEADER_STORAGE_KEY } from './BuildSave.js';
import { MAX_RENOWN_LEVEL, CHARACTER_RENOWN_INTERVAL, LEADERSHIP_RARITIES } from '../config/renown.js';

const STORAGE_KEY = LEADER_STORAGE_KEY;

export const leaderAbilities = [
  {
    id: 'focusFire',
    category: 'Assault',
    name: 'Focus!',
    shortName: 'FOCUS!',
    branch: 'Command',
    description: 'Direct all non-healers to the target. They deal 5% more damage to it for 10 seconds.',
    rarity: 'common',
    cost: 1,
    cooldown: 45000,
    duration: 10000,
    damageBonus: 0.05
  },

  {
    id: 'coordinatedAttack',
    category: 'Assault',
    name: 'Coordinated Attack!',
    shortName: 'COORDINATE',
    branch: 'Command',
    description: 'Melee damage dealers strike one enemy and root it for 6 seconds. Once per encounter.',
    rarity: 'uncommon',
    cost: 15,
    oncePerEncounter: true
  },

  {
    id: 'lunarAssault',
    category: 'Assault',
    name: 'Lunar Assault!',
    shortName: 'LUNAR',
    branch: 'Command',
    description: 'Mages damage enemies within 4 paces of the target and root them for 8 seconds. Once per encounter.',
    rarity: 'uncommon',
    cost: 18,
    oncePerEncounter: true
  },

  {
    id: 'fightOn',
    category: 'Assault',
    name: 'Fight On!',
    shortName: 'FIGHT ON',
    branch: 'Command',
    description: 'All characters deal 10% more damage for 6 seconds.',
    rarity: 'common',
    cost: 2,
    cooldown: 45000,
    duration: 6000,
    damageBonus: 0.1
  },

  {
    id: 'brace',
    category: 'Protect',
    name: 'Brace!',
    shortName: 'BRACE!',
    branch: 'Survival',
    description: 'All characters take 30% less damage for 8 seconds.',
    rarity: 'common',
    cost: 2,
    cooldown: 45000,
    duration: 8000,
    damageReduction: 0.3
  },

  {
    id: 'shieldWall',
    category: 'Protect',
    name: 'Shield Wall!',
    shortName: 'SHIELD WALL',
    branch: 'Survival',
    description: 'Tank characters gain 20% Block for 10 seconds.',
    rarity: 'common',
    cost: 4,
    cooldown: 60000,
    duration: 10000,
    blockBonus: 0.2
  },

  {
    id: 'arise',
    category: 'Restore',
    name: 'Arise!',
    shortName: 'ARISE!',
    branch: 'Survival',
    description: 'Restore all fallen characters to life at full health and mana. Once per encounter.',
    rarity: 'rare',
    cost: 35,
    oncePerEncounter: true,
    healthFraction: 1,
    manaFraction: 1
  },

  {
    id: 'manaVortex',
    category: 'Restore',
    name: 'Mana Vortex!',
    shortName: 'MANA VORTEX',
    branch: 'Morale',
    description: 'Restore all mana to every mana-using character. Once per encounter.',
    rarity: 'uncommon',
    cost: 20,
    oncePerEncounter: true
  },

  {
    id: 'encouragement',
    category: 'Restore',
    name: 'Encourage!',
    shortName: 'ENCOURAGE',
    branch: 'Morale',
    description: 'Restore Health to every living ally.',
    rarity: 'common',
    cost: 2,
    cooldown: 45000,
    healFraction: 0.25
  },

  {
    id: 'regen',
    category: 'Restore',
    name: 'Regen!',
    shortName: 'REGEN!',
    branch: 'Morale',
    description: 'Restore 100 health to all living allies every 3 seconds for 12 seconds.',
    rarity: 'common',
    cost: 4,
    cooldown: 45000,
    duration: 12000,
    healAmount: 100,
    healInterval: 3000
  },

  {
    id: 'supplies',
    category: 'Prepare',
    name: 'Supplies!',
    shortName: 'SUPPLIES',
    branch: 'Preparation',
    description: 'Restore all uses in every equipped potion pack. Once per encounter.',
    rarity: 'common',
    cost: 5,
    oncePerEncounter: true
  },

  {
    id: 'ready',
    category: 'Prepare',
    name: 'Ready!',
    shortName: 'READY!',
    branch: 'Preparation',
    description: 'The next damage-dealing ability for each character is a guaranteed critical hit.',
    rarity: 'common',
    cost: 3,
    cooldown: 45000
  },

  {
    id: 'revive',
    category: 'Restore',
    name: 'Revive!',
    shortName: 'REVIVE!',
    branch: 'Survival',
    description: 'Restore one fallen character to full health and mana.',
    rarity: 'common',
    cost: 3,
    cooldown: 45000,
    healthFraction: 1,
    manaFraction: 1
  }
];

// A fresh leader has one point to choose a first tactic in town. Unlocks and the
// five-slot equipped list are separate, so buying never silently replaces a loadout.
const defaultLeader = () => ({
  level: 1,
  renownPoints: 1,
  spentRenownPoints: 0,
  claimedCharacterMilestones: [],
  claimedDelveBosses: [],
  closedVoidPortals: [],
  unlockedAbilities: [],
  battleLoadout: []
});

// Keep existing local unlocks readable, but do not invent achievement history for old
// saves. The new reward schedule is balanced for a fresh profile.
export function loadLeaderProgression() {
  const fallback = defaultLeader();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    const known = new Set(leaderAbilities.map(ability => ability.id));
    const migrateId = id => id === 'coordinatedAssault' ? 'fightOn' : id;
    const unlocked = [...new Set((saved.unlockedAbilities ?? []).map(migrateId))]
      .filter(id => known.has(id));
    const refund = ['rally', 'preparedSupplies'].filter(id => saved.unlockedAbilities?.includes(id)).length;
    return {
      ...fallback,
      level: Math.max(1, Math.min(MAX_RENOWN_LEVEL, saved.level ?? 1)),
      renownPoints: Math.max(0, saved.renownPoints ?? saved.tacticsPoints ?? saved.inspirationPoints ?? 0) + refund,
      spentRenownPoints: Math.max(0, (saved.spentRenownPoints ?? saved.spentTacticsPoints ?? saved.spentInspiration ?? 0) - refund),
      claimedCharacterMilestones: [...new Set(saved.claimedCharacterMilestones ?? [])],
      claimedDelveBosses: [...new Set(saved.claimedDelveBosses ?? [])],
      closedVoidPortals: [...new Set(saved.closedVoidPortals ?? [])],
      unlockedAbilities: unlocked,
      battleLoadout: [...new Set((saved.battleLoadout ?? []).map(migrateId))]
        .filter(id => unlocked.includes(id)).slice(0, 5)
    };
  } catch (error) {
    console.warn('Could not load Renown progression.', error);
    return fallback;
  }
}

// Store the leader under the existing key so installing a build never erases a profile.
export function saveLeaderProgression(leader) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leader));
  } catch (error) {
    console.warn('Could not save Renown progression.', error);
  }
}

// Read rarity requirements from one table used by both presentation and purchases.
export function leadershipRequirements(ability) {
  return LEADERSHIP_RARITIES[ability.rarity] ?? LEADERSHIP_RARITIES.common;
}

// Check whether this tactic is already unlocked for the leader.
export function hasLeaderAbility(leader, abilityId) {
  return leader.unlockedAbilities.includes(abilityId);
}

// Enforce earned Renown and the point balance here, even if a caller skips the UI.
export function purchaseLeaderAbility(leader, abilityId) {
  const ability = leaderAbilities.find(entry => entry.id === abilityId);
  if (!ability) return false;
  const requirement = leadershipRequirements(ability);
  if (requirement.questOnly || leader.level < requirement.level
    || hasLeaderAbility(leader, abilityId) || leader.renownPoints < ability.cost) return false;
  leader.renownPoints -= ability.cost;
  leader.spentRenownPoints += ability.cost;
  leader.unlockedAbilities.push(abilityId);
  saveLeaderProgression(leader);
  return true;
}

// Dev Tools awards one point per actual level gained, stopping at the configurable cap.
export function grantLeaderLevels(leader, amount = 1) {
  const requested = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  const gained = Math.min(requested, Math.max(0, MAX_RENOWN_LEVEL - leader.level));
  leader.level += gained;
  leader.renownPoints = (leader.renownPoints ?? 0) + gained;
  saveLeaderProgression(leader);
  return { leveledUp: gained > 0, levelsGained: gained, renownPointsEarned: gained };
}

// Claim a unique achievement once. At level 50 its point is still awarded, but the
// level stays capped. Spending points never changes standing or restores a claim.
function claimRenownAchievement(leader, field, key) {
  leader[field] ??= [];
  if (leader[field].includes(key)) return { leveledUp: false, levelsGained: 0, renownPointsEarned: 0 };
  leader[field].push(key);
  const levelsGained = leader.level < MAX_RENOWN_LEVEL ? 1 : 0;
  leader.level += levelsGained;
  leader.renownPoints = (leader.renownPoints ?? 0) + 1;
  saveLeaderProgression(leader);
  return { leveledUp: levelsGained > 0, levelsGained, renownPointsEarned: 1 };
}

// Visit every crossed five-level threshold. Claims belong to the player, so a second
// adventurer reaching the same level earns nothing, including in an offline batch.
export function recordCharacterMilestones(leader, previousLevel, currentLevel) {
  const result = { leveledUp: false, levelsGained: 0, renownPointsEarned: 0 };
  if (!leader) return result;
  const first = (Math.floor(previousLevel / CHARACTER_RENOWN_INTERVAL) + 1) * CHARACTER_RENOWN_INTERVAL;
  for (let milestone = first; milestone <= currentLevel; milestone += CHARACTER_RENOWN_INTERVAL) {
    const gained = claimRenownAchievement(leader, 'claimedCharacterMilestones', milestone);
    result.levelsGained += gained.levelsGained;
    result.renownPointsEarned += gained.renownPointsEarned;
  }
  result.leveledUp = result.levelsGained > 0;
  return result;
}

// World destination IDs identify achievements, rather than enemy types or inherited
// encounter depth. A portal pays for closure instead of also paying as a Delve boss.
export function recordDelveCompletion(leader, delve) {
  if (!leader || !delve?.id) return { leveledUp: false, levelsGained: 0, renownPointsEarned: 0 };
  const id = { 'old-quarry': 'march-west-delves', 'sunken-watch': 'verge-delves' }[delve.id] ?? delve.id;
  return claimRenownAchievement(leader, delve.type === 'void' ? 'closedVoidPortals' : 'claimedDelveBosses', id);
}

// Equip or remove an unlocked tactic within the five-slot limit.
export function toggleLeaderLoadoutAbility(leader, abilityId) {
  if (!hasLeaderAbility(leader, abilityId)) return false;

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  leader.battleLoadout = Array.isArray(leader.battleLoadout) ? leader.battleLoadout : [];
  if (leader.battleLoadout.includes(abilityId)) {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    leader.battleLoadout = leader.battleLoadout.filter((id) => id !== abilityId);
  } else {
    if (leader.battleLoadout.length >= 5) return false;
    leader.battleLoadout.push(abilityId);
  }

  saveLeaderProgression(leader);
  return true;
}

// Remove the saved leader record during the existing reset flow.
export function clearLeaderProgression() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Could not clear Battle Tactics progression.', error);
  }
}
