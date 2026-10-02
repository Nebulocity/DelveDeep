import { CLASS_DEFINITIONS } from '../data/classes.js';
import GameState from './GameState.js';

export const MAX_EQUIPPED_ABILITIES = 4;
export const MAX_ABILITY_RANK = 3;

export function abilityEntries(hero) {
  return Object.entries(CLASS_DEFINITIONS[hero.className]?.abilities ?? {});
}

export function abilityLevelRequired(hero, key, nextRank = 1) {
  const index = abilityEntries(hero).findIndex(([id]) => id === key);
  if (index < 0) return Infinity;
  if (nextRank === 1) return [1, 1, 2, 4, 6][index] ?? 8;
  return nextRank === 2 ? 3 : 6;
}

export function abilityGoldCost(hero, key, nextRank = 1) {
  const index = abilityEntries(hero).findIndex(([id]) => id === key);
  if (index < 0) return Infinity;
  return nextRank === 1 ? 80 + index * 40 : nextRank === 2 ? 120 : 220;
}

export function restoreAdventurerAbilities(hero, saved, legacy = false) {
  const keys = abilityEntries(hero).map(([key]) => key);
  const defaults = legacy ? keys : keys.slice(0, 2);
  const ranks = {};
  for (const key of keys) {
    const value = saved?.abilityRanks?.[key];
    if (Number.isSafeInteger(value) && value >= 1) ranks[key] = Math.min(MAX_ABILITY_RANK, value);
    else if (defaults.includes(key)) ranks[key] = 1;
  }
  const selected = Array.isArray(saved?.abilityLoadout) ? saved.abilityLoadout : defaults;
  hero.abilityRanks = ranks;
  hero.abilityLoadout = [...new Set(selected)]
    .filter((key) => ranks[key] > 0 && keys.includes(key))
    .slice(0, MAX_EQUIPPED_ABILITIES);
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
  const cost = abilityGoldCost(hero, key, nextRank);
  if (hero.level < level) return { ok: false, message: `Requires level ${level}.` };
  if (state.gold < cost) return { ok: false, message: `Need ${cost} gold.` };
  state.gold -= cost;
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
    const powerScale = 1 + (rank - 1) * 0.2;
    const durationScale = 1 + (rank - 1) * 0.15;
    const ability = { ...base, cooldown: Math.round(base.cooldown * (1 - (rank - 1) * 0.1)) };
    for (const field of ['power', 'highPower', 'retaliation']) {
      if (Number.isFinite(base[field])) ability[field] = Math.round(base[field] * powerScale);
    }
    for (const field of ['duration', 'stun', 'root']) {
      if (Number.isFinite(base[field])) ability[field] = Math.round(base[field] * durationScale);
    }
    if (base.poison) ability.poison = { ...base.poison, power: Math.round(base.poison.power * powerScale) };
    if (Number.isFinite(base.chance)) ability.chance = Math.min(1, base.chance + (rank - 1) * 0.05);
    result[key] = ability;
  }
  return result;
}
