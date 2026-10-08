import { LEADER_STORAGE_KEY } from './BuildSave.js';

const STORAGE_KEY = LEADER_STORAGE_KEY;

export const leaderAbilities = [
  { id: 'focusFire', category: 'Assault', name: 'Focus!', shortName: 'FOCUS!', branch: 'Command', description: 'Direct all non-healers to the target. They deal 5% more damage to it for 10 seconds.', cost: 0, cooldown: 45000, duration: 10000, damageBonus: 0.05, unlockedByDefault: true },
  { id: 'coordinatedAttack', category: 'Assault', name: 'Coordinated Attack!', shortName: 'COORDINATE', branch: 'Command', description: 'Melee damage dealers strike one enemy and root it for 6 seconds. Once per encounter.', cost: 1, oncePerEncounter: true },
  { id: 'lunarAssault', category: 'Assault', name: 'Lunar Assault!', shortName: 'LUNAR', branch: 'Command', description: 'Mages damage enemies within a 400-unit radius of the target and root them for 8 seconds. Once per encounter.', cost: 1, oncePerEncounter: true },
  { id: 'fightOn', category: 'Assault', name: 'Fight On!', shortName: 'FIGHT ON', branch: 'Command', description: 'All characters deal 10% more damage for 6 seconds.', cost: 1, cooldown: 45000, duration: 6000, damageBonus: 0.1 },
  { id: 'brace', category: 'Protect', name: 'Brace!', shortName: 'BRACE!', branch: 'Survival', description: 'All characters take 30% less damage for 8 seconds.', cost: 1, cooldown: 45000, duration: 8000, damageReduction: 0.3 },
  { id: 'shieldWall', category: 'Protect', name: 'Shield Wall!', shortName: 'SHIELD WALL', branch: 'Survival', description: 'Tank characters gain 20 percentage points of Block for 10 seconds.', cost: 1, cooldown: 60000, duration: 10000, blockBonus: 0.2 },
  { id: 'arise', category: 'Restore', name: 'Arise!', shortName: 'ARISE!', branch: 'Survival', description: 'Restore all fallen characters to life at full health and mana. Once per encounter.', cost: 2, oncePerEncounter: true, healthFraction: 1, manaFraction: 1 },
  { id: 'manaVortex', category: 'Restore', name: 'Mana Vortex!', shortName: 'MANA VORTEX', branch: 'Morale', description: 'Restore all mana to every mana-using character. Once per encounter.', cost: 1, oncePerEncounter: true },
  { id: 'encouragement', category: 'Restore', name: 'Encourage!', shortName: 'ENCOURAGE', branch: 'Morale', description: 'Restore Health to every living ally.', cost: 1, cooldown: 45000, healFraction: 0.25 },
  { id: 'regen', category: 'Restore', name: 'Regen!', shortName: 'REGEN!', branch: 'Morale', description: 'Restore 100 health to all living allies every 3 seconds for 12 seconds.', cost: 1, cooldown: 45000, duration: 12000, healAmount: 100, healInterval: 3000 },
  { id: 'supplies', category: 'Prepare', name: 'Supplies!', shortName: 'SUPPLIES', branch: 'Preparation', description: 'Restore all uses in every equipped potion pack. Once per encounter.', cost: 1, oncePerEncounter: true },
  { id: 'ready', category: 'Prepare', name: 'Ready!', shortName: 'READY!', branch: 'Preparation', description: 'The next damage-dealing ability for each character is a guaranteed critical hit.', cost: 1, cooldown: 45000 },
  { id: 'revive', category: 'Restore', name: 'Revive!', shortName: 'REVIVE!', branch: 'Survival', description: 'Restore one fallen character to full health and mana.', cost: 1, cooldown: 45000, healthFraction: 1, manaFraction: 1 }
];

const defaultLeader = () => ({
  level: 1,
  highestClearedDepth: 0,
  tacticsPoints: 0,
  spentTacticsPoints: 0,
  unlockedAbilities: ['focusFire'],
  battleLoadout: ['focusFire']
});

export function loadLeaderProgression() {
  const fallback = defaultLeader();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    const { inspirationPoints, spentInspiration, ...progress } = saved;
    const known = new Set(leaderAbilities.map((ability) => ability.id));
    let refund = saved.unlockedAbilities?.includes('preparedSupplies') === true ? 1 : 0;
    const migrateId = (id) => {
      if (id === 'rally') { refund += 1; return null; }
      if (id === 'coordinatedAssault') return 'fightOn';
      if (id === 'preparedSupplies') return null;
      return id;
    };
    const unlocked = Array.from(new Set(['focusFire', ...(saved.unlockedAbilities ?? []).map(migrateId).filter(Boolean)]))
      .filter((id) => known.has(id));
    const oldLoadout = saved.battleLoadout ?? ['focusFire'];
    const battleLoadout = Array.from(new Set(oldLoadout.map(id => id === 'rally' ? null
      : id === 'coordinatedAssault' ? 'fightOn' : id === 'preparedSupplies' ? null : id)
      .filter((id) => id && unlocked.includes(id)))).slice(0, 5);
    const leader = {
      ...fallback,
      ...progress,
      tacticsPoints: Math.max(0, saved.tacticsPoints ?? inspirationPoints ?? 0) + refund,
      spentTacticsPoints: Math.max(0, (saved.spentTacticsPoints ?? spentInspiration ?? 0) - refund),
      unlockedAbilities: unlocked,
      battleLoadout
    };
    if (refund || saved.unlockedAbilities?.some(id => ['rally', 'coordinatedAssault', 'preparedSupplies'].includes(id))) {
      saveLeaderProgression(leader);
    }
    return leader;
  } catch (error) {
    console.warn('Could not load Battle Tactics progression.', error);
    return fallback;
  }
}

export function saveLeaderProgression(leader) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leader));
  } catch (error) {
    console.warn('Could not save Battle Tactics progression.', error);
  }
}

export function hasLeaderAbility(leader, abilityId) {
  return leader.unlockedAbilities.includes(abilityId);
}

export function purchaseLeaderAbility(leader, abilityId) {
  const ability = leaderAbilities.find((entry) => entry.id === abilityId);
  if (!ability || hasLeaderAbility(leader, abilityId) || leader.tacticsPoints < ability.cost) return false;
  leader.tacticsPoints -= ability.cost;
  leader.spentTacticsPoints += ability.cost;
  leader.unlockedAbilities.push(abilityId);
  saveLeaderProgression(leader);
  return true;
}

export function grantLeaderLevels(leader, amount = 1) {
  const previousLevel = leader.level;
  const gained = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  leader.level += gained;
  const tacticsPointsEarned = Math.floor(leader.level / 5) - Math.floor(previousLevel / 5);
  leader.tacticsPoints += tacticsPointsEarned;
  saveLeaderProgression(leader);
  return { leveledUp: gained > 0, tacticsPointsEarned };
}

export function recordDepthClear(leader, depth) {
  if (!Number.isFinite(depth) || depth <= leader.highestClearedDepth) {
    return { leveledUp: false, tacticsPointsEarned: 0 };
  }
  leader.highestClearedDepth = depth;
  return grantLeaderLevels(leader, Math.max(0, depth + 1 - leader.level));
}

export function toggleLeaderLoadoutAbility(leader, abilityId) {
  if (!hasLeaderAbility(leader, abilityId)) return false;
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

export function clearLeaderProgression() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Could not clear Battle Tactics progression.', error);
  }
}
