import { CLASS_DEFINITIONS } from '../data/classes.js';
import GameState from './GameState.js';

export const MAX_EQUIPPED_ABILITIES = 4;
export const MAX_ABILITY_RANK = 10;

export function abilityEntries(hero) {
  return Object.entries(CLASS_DEFINITIONS[hero.className]?.abilities ?? {});
}

export function sortedAbilityEntries(hero) {
  return abilityEntries(hero).map((entry, index) => {
    const [key] = entry;
    const rank = hero.abilityRanks?.[key] ?? 0;
    const group = rank > 0 ? 0
      : hero.level >= abilityLevelRequired(hero, key, 1) ? 1 : 2;
    return { entry, index, group };
  }).sort((a, b) => a.group - b.group || a.index - b.index).map(({ entry }) => entry);
}

export function abilityLearningAvailable(hero, key) {
  const nextRank = (hero.abilityRanks?.[key] ?? 0) + 1;
  return nextRank <= MAX_ABILITY_RANK && hero.level >= abilityLevelRequired(hero, key, nextRank);
}

export function abilityLevelRequired(hero, key, rank = 1) {
  if (!CLASS_DEFINITIONS[hero.className]?.abilities?.[key] || rank < 1 || rank > MAX_ABILITY_RANK) return Infinity;
  return rank === 1 ? 1 : (rank - 1) * 5;
}

export function abilitySkillPointCost(rank) {
  return Math.max(1, Math.min(MAX_ABILITY_RANK, Math.floor(rank)));
}

export function abilityGoldCost(hero, key, rank = 1) {
  if (!CLASS_DEFINITIONS[hero.className]?.abilities?.[key] || rank < 1 || rank > MAX_ABILITY_RANK) return Infinity;
  const happiness = Math.max(0, Math.min(100, hero.happiness ?? 70));
  return Math.ceil(((20 + 5 * hero.level) * rank * (1 + (100 - happiness) / 100)) / 5) * 5;
}

export function restoreAdventurerAbilities(hero, saved, legacy = false) {
  const entries = abilityEntries(hero);
  const keys = entries.map(([key]) => key);
  const starterKeys = entries.filter(([, ability]) => ability.starter).map(([key]) => key);
  const legacyKeys = legacy ? entries.filter(([, ability]) => ability.origin === 'Existing').map(([key]) => key) : [];
  const ranks = {};
  for (const key of keys) {
    const value = saved?.abilityRanks?.[key];
    if (Number.isSafeInteger(value) && value >= 1) ranks[key] = Math.min(MAX_ABILITY_RANK, value);
    else if (starterKeys.includes(key) || legacyKeys.includes(key)) ranks[key] = 1;
  }
  const defaults = saved?.abilityLoadout ?? (legacy ? legacyKeys : starterKeys);
  hero.abilityRanks = ranks;
  hero.abilityLoadout = [...new Set(defaults)]
    .filter((key) => ranks[key] > 0 && keys.includes(key))
    .slice(0, MAX_EQUIPPED_ABILITIES);
  hero.skillPoints = Number.isSafeInteger(saved?.skillPoints) && saved.skillPoints >= 0
    ? saved.skillPoints : Math.max(1, hero.level);
  return hero;
}

export function purchaseAdventurerAbility(heroId, key, state = GameState) {
  const hero = state.roster.find((entry) => entry.id === heroId);
  const ability = hero && CLASS_DEFINITIONS[hero.className]?.abilities?.[key];
  if (!ability) return { ok: false, message: 'Ability unavailable.' };
  const current = hero.abilityRanks?.[key] ?? 0;
  if (current >= MAX_ABILITY_RANK) return { ok: false, message: 'This ability is at maximum rank.' };
  const nextRank = current + 1;
  const level = abilityLevelRequired(hero, key, nextRank);
  const points = abilitySkillPointCost(nextRank);
  const gold = abilityGoldCost(hero, key, nextRank);
  if (hero.level < level) return { ok: false, message: `Requires level ${level}.` };
  if ((hero.skillPoints ?? 0) < points) return { ok: false, message: `Need ${points} skill points.` };
  if (state.gold < gold) return { ok: false, message: `Need ${gold} gold.` };
  state.gold -= gold;
  hero.skillPoints -= points;
  hero.abilityRanks ??= {};
  hero.abilityRanks[key] = nextRank;
  hero.abilityLoadout ??= [];
  if (!current && hero.abilityLoadout.length < MAX_EQUIPPED_ABILITIES) hero.abilityLoadout.push(key);
  return { ok: true, message: `${ability.name} is now rank ${nextRank}.` };
}

export function toggleAdventurerAbility(heroId, key, state = GameState) {
  const hero = state.roster.find((entry) => entry.id === heroId);
  if (!hero?.abilityRanks?.[key] || !CLASS_DEFINITIONS[hero.className]?.abilities?.[key]) {
    return { ok: false, message: 'Unlock this ability first.' };
  }
  hero.abilityLoadout ??= [];
  if (hero.abilityLoadout.includes(key)) {
    hero.abilityLoadout = hero.abilityLoadout.filter((id) => id !== key);
    return { ok: true, message: 'Ability unequipped.' };
  }
  if (hero.abilityLoadout.length >= MAX_EQUIPPED_ABILITIES) {
    return { ok: false, message: 'Unequip an ability to free a slot.' };
  }
  hero.abilityLoadout.push(key);
  return { ok: true, message: 'Ability equipped.' };
}

export function battleAbilities(hero) {
  const result = {};
  const equipped = new Set(hero.abilityLoadout ?? []);
  for (const [key, base] of abilityEntries(hero)) {
    const rank = hero.abilityRanks?.[key] ?? 0;
    if (!equipped.has(key) || rank < 1) continue;
    const ability = rankedAbility(base, rank);
    result[key] = ability;
  }
  return result;
}

export function rankedAbility(base, rank = 1) {
  const powerScale = 1 + (rank - 1) * 0.12;
  const durationScale = 1 + (rank - 1) * 0.05;
  const ability = { ...base, rank };
  for (const field of ['power', 'highPower', 'retaliation']) {
    if (Number.isFinite(base[field])) ability[field] = Math.round(base[field] * powerScale);
  }
  if (Number.isFinite(base.duration)) ability.duration = Math.min(base.slow ? 4000 : 20000, Math.round(base.duration * durationScale));
  for (const field of ['stun', 'root', 'blind']) {
    if (Number.isFinite(base[field])) ability[field] = Math.min(4000, Math.round(base[field] * durationScale));
  }
  for (const field of ['reduction', 'chance', 'damageTakenBoost', 'spellBoost', 'healingBoost', 'damageBoost', 'healBonus', 'threatBonus']) {
    if (Number.isFinite(base[field])) ability[field] = Math.min(0.75, base[field] * powerScale);
  }
  if (Number.isFinite(base.threatMultiplier)) ability.threatMultiplier = 1 + (base.threatMultiplier - 1) * powerScale;
  if (base.poison) ability.poison = { ...base.poison, power: Math.round(base.poison.power * powerScale) };
  return ability;
}
