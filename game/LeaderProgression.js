// The player's Renown and Tactics Points are separate from adventurer XP and skill points.
// Legacy storage still calls Renown level "level". Keep that saved name compatible while
// using the current player-facing label. Unlocks and equipped tactics are separate lists.

import { LEADER_STORAGE_KEY } from './BuildSave.js';

const STORAGE_KEY = LEADER_STORAGE_KEY;

export const leaderAbilities = [
  {
    id: 'focusFire',
    category: 'Assault',
    name: 'Focus!',
    shortName: 'FOCUS!',
    branch: 'Command',
    description: 'Direct all non-healers to the target. They deal 5% more damage to it for 10 seconds.',
    cost: 0,
    cooldown: 45000,
    duration: 10000,
    damageBonus: 0.05,
    unlockedByDefault: true
  },

  {
    id: 'coordinatedAttack',
    category: 'Assault',
    name: 'Coordinated Attack!',
    shortName: 'COORDINATE',
    branch: 'Command',
    description: 'Melee damage dealers strike one enemy and root it for 6 seconds. Once per encounter.',
    cost: 1,
    oncePerEncounter: true
  },

  {
    id: 'lunarAssault',
    category: 'Assault',
    name: 'Lunar Assault!',
    shortName: 'LUNAR',
    branch: 'Command',
    description: 'Mages damage enemies within a 400-unit radius of the target and root them for 8 seconds. Once per encounter.',
    cost: 1,
    oncePerEncounter: true
  },

  {
    id: 'fightOn',
    category: 'Assault',
    name: 'Fight On!',
    shortName: 'FIGHT ON',
    branch: 'Command',
    description: 'All characters deal 10% more damage for 6 seconds.',
    cost: 1,
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
    cost: 1,
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
    description: 'Tank characters gain 20 percentage points of Block for 10 seconds.',
    cost: 1,
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
    cost: 2,
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
    cost: 1,
    oncePerEncounter: true
  },

  {
    id: 'encouragement',
    category: 'Restore',
    name: 'Encourage!',
    shortName: 'ENCOURAGE',
    branch: 'Morale',
    description: 'Restore Health to every living ally.',
    cost: 1,
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
    cost: 1,
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
    cost: 1,
    oncePerEncounter: true
  },

  {
    id: 'ready',
    category: 'Prepare',
    name: 'Ready!',
    shortName: 'READY!',
    branch: 'Preparation',
    description: 'The next damage-dealing ability for each character is a guaranteed critical hit.',
    cost: 1,
    cooldown: 45000
  },

  {
    id: 'revive',
    category: 'Restore',
    name: 'Revive!',
    shortName: 'REVIVE!',
    branch: 'Survival',
    description: 'Restore one fallen character to full health and mana.',
    cost: 1,
    cooldown: 45000,
    healthFraction: 1,
    manaFraction: 1
  }
];

const defaultLeader = () => ({
  level: 1,
  highestClearedDepth: 0,
  tacticsPoints: 0,
  spentTacticsPoints: 0,
  unlockedAbilities: ['focusFire'],
  battleLoadout: ['focusFire']
});

// Restore Renown, tactic unlocks and loadout while migrating retired tactic IDs.
export function loadLeaderProgression() {
  const fallback = defaultLeader();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { inspirationPoints, spentInspiration, ...progress } = saved;

    // A Set keeps each value once. has checks membership without searching a list for
    // duplicate entries. map builds one output entry for each input entry, in the same
    // order. The callback's return value becomes that output entry.
    const known = new Set(leaderAbilities.map((ability) => ability.id));

    // The condition before ? chooses the first value when true and the value after : when
    // false. ?. only follows this link when the value exists; a missing optional value
    // gives undefined.
    let refund = saved.unlockedAbilities?.includes('preparedSupplies') === true ? 1 : 0;
    const migrateId = (id) => {
      if (id === 'rally') {
        refund += 1;
        return null;
      }
      if (id === 'coordinatedAssault') return 'fightOn';
      if (id === 'preparedSupplies') return null;

      return id;
    };

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place. ... expands these entries into the new list or call. It
    // does not deep-copy the objects inside. ?? uses the fallback only for null or
    // undefined. A real zero or false stays intact.
    const unlocked = Array.from(new Set(['focusFire', ...(saved.unlockedAbilities ?? []).map(migrateId).filter(Boolean)]))
      .filter((id) => known.has(id));
    const oldLoadout = saved.battleLoadout ?? ['focusFire'];
    const battleLoadout = Array.from(new Set(oldLoadout.map(id => id === 'rally' ? null
      : id === 'coordinatedAssault' ? 'fightOn' : id === 'preparedSupplies' ? null : id)
      .filter((id) => id && unlocked.includes(id)))).slice(0, 5);

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    const leader = {
      ...fallback,
      ...progress,
      tacticsPoints: Math.max(0, saved.tacticsPoints ?? inspirationPoints ?? 0) + refund,
      spentTacticsPoints: Math.max(0, (saved.spentTacticsPoints ?? spentInspiration ?? 0) - refund),
      unlockedAbilities: unlocked,
      battleLoadout
    };

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    if (refund || saved.unlockedAbilities?.some(id => ['rally', 'coordinatedAssault', 'preparedSupplies'].includes(id))) {
      saveLeaderProgression(leader);
    }

    return leader;
  } catch (error) {
    console.warn('Could not load Battle Tactics progression.', error);
    return fallback;
  }
}

// Store the leader's persistent progress under its compatible legacy storage key.
export function saveLeaderProgression(leader) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leader));
  } catch (error) {
    console.warn('Could not save Battle Tactics progression.', error);
  }
}

// Check whether this tactic is already unlocked for the leader.
export function hasLeaderAbility(leader, abilityId) {
  return leader.unlockedAbilities.includes(abilityId);
}

// Check unlock requirements and TP before buying the tactic.
export function purchaseLeaderAbility(leader, abilityId) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const ability = leaderAbilities.find((entry) => entry.id === abilityId);
  if (!ability || hasLeaderAbility(leader, abilityId) || leader.tacticsPoints < ability.cost) return false;
  leader.tacticsPoints -= ability.cost;
  leader.spentTacticsPoints += ability.cost;
  leader.unlockedAbilities.push(abilityId);
  saveLeaderProgression(leader);

  return true;
}

// Apply Renown gains and the normal Tactics Point milestones.
export function grantLeaderLevels(leader, amount = 1) {
  const previousLevel = leader.level;

  // The condition before ? chooses the first value when true and the value after : when
  // false. Math.max chooses the largest value; pairing it with Math.min can keep a result
  // inside both a lower and an upper bound. Math.floor rounds toward the smaller whole
  // number, so 3.8 becomes 3.
  const gained = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  leader.level += gained;
  const tacticsPointsEarned = Math.floor(leader.level / 5) - Math.floor(previousLevel / 5);
  leader.tacticsPoints += tacticsPointsEarned;
  saveLeaderProgression(leader);

  return { leveledUp: gained > 0, tacticsPointsEarned };
}

// Record clear progression and any corresponding leader gains. depth controls draw order;
// higher values draw over lower values.
export function recordDepthClear(leader, depth) {
  if (!Number.isFinite(depth) || depth <= leader.highestClearedDepth) {
    return { leveledUp: false, tacticsPointsEarned: 0 };
  }
  leader.highestClearedDepth = depth;

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  return grantLeaderLevels(leader, Math.max(0, depth + 1 - leader.level));
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
