// Known skills, learned ranks and equipped battle slots are separate. Learning or training
// changes the roster's progression; equipping chooses which known skills enter combat. We
// build ranked ability values from the catalog so saved ranks stay compatible with the
// current data instead of saving a permanent copy of every formula.

import { CLASS_DEFINITIONS } from '../data/classes.js';
import GameState from './GameState.js';

export const MAX_EQUIPPED_ABILITIES = 4;
export const MAX_ABILITY_RANK = 10;

// List this character class's skills alongside their saved learning state. hero is the
// roster record, rather than the artwork that displays that character.
export function abilityEntries(hero) {

  // Object.entries turns own fields into [key, value] pairs so we can visit or transform
  // them. ?? uses the fallback only for null or undefined. A real zero or false stays
  // intact. ?. only follows this link when the value exists; a missing optional value
  // gives undefined.
  return Object.entries(CLASS_DEFINITIONS[hero.className]?.abilities ?? {});
}

// Order skill entries for display without using that order as saved identity. hero is the
// roster record, rather than the artwork that displays that character.
export function sortedAbilityEntries(hero) {

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry. sort rearranges this array in place. A
  // negative comparator result puts a before b; positive puts it after; zero keeps them
  // tied.
  return abilityEntries(hero).map((entry, index) => {

    // The brackets unpack entries by position; their order matters.
    const [key] = entry;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const rank = hero.abilityRanks?.[key] ?? 0;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const group = rank > 0 ? 0
      : hero.level >= abilityLevelRequired(hero, key, 1) ? 1 : 2;
    return { entry, index, group };
  }).sort((a, b) => a.group - b.group || a.index - b.index).map(({ entry }) => entry);
}

// Check the character's current rank and requirements before offering training. hero is
// the roster record, rather than the artwork that displays that character.
export function abilityLearningAvailable(hero, key) {

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact. ?.
  // only follows this link when the value exists; a missing optional value gives
  // undefined.
  const nextRank = (hero.abilityRanks?.[key] ?? 0) + 1;
  return nextRank <= MAX_ABILITY_RANK && hero.level >= abilityLevelRequired(hero, key, nextRank);
}

// Calculate the character level required for the requested skill rank. hero is the roster
// record, rather than the artwork that displays that character.
export function abilityLevelRequired(hero, key, rank = 1) {

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  if (!CLASS_DEFINITIONS[hero.className]?.abilities?.[key] || rank < 1 || rank > MAX_ABILITY_RANK) return Infinity;

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  return rank === 1 ? 1 : (rank - 1) * 5;
}

// Calculate the SP needed for the requested next rank.
export function abilitySkillPointCost(rank) {

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound. Math.floor rounds toward the smaller whole number, so
  // 3.8 becomes 3.
  return Math.max(1, Math.min(MAX_ABILITY_RANK, Math.floor(rank)));
}

// Calculate the Gold fee, including the character's Happiness adjustment. hero is the
// roster record, rather than the artwork that displays that character.
export function abilityGoldCost(hero, key, rank = 1) {

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  if (!CLASS_DEFINITIONS[hero.className]?.abilities?.[key] || rank < 1 || rank > MAX_ABILITY_RANK) return Infinity;

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound. ?? uses the fallback only for null or undefined. A
  // real zero or false stays intact.
  const happiness = Math.max(0, Math.min(100, hero.happiness ?? 70));

  // Math.ceil rounds upward to the next integer, including when the value has a fractional
  // part.
  return Math.ceil(((20 + 5 * hero.level) * rank * (1 + (100 - happiness) / 100)) / 5) * 5;
}

// Restore valid learned ranks and battle slots against the current class catalog. hero is
// the roster record, rather than the artwork that displays that character.
export function restoreAdventurerAbilities(hero, saved, legacy = false) {
  const entries = abilityEntries(hero);

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry.
  const keys = entries.map(([key]) => key);

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  const starterKeys = entries.filter(([, ability]) => ability.starter).map(([key]) => key);

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const legacyKeys = legacy ? entries.filter(([, ability]) => ability.origin === 'Existing').map(([key]) => key) : [];
  const ranks = {};
  for (const key of keys) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const value = saved?.abilityRanks?.[key];
    if (Number.isSafeInteger(value) && value >= 1) ranks[key] = Math.min(MAX_ABILITY_RANK, value);
    else if (starterKeys.includes(key) || legacyKeys.includes(key)) ranks[key] = 1;
  }

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  const defaults = saved?.abilityLoadout ?? (legacy ? legacyKeys : starterKeys);
  hero.abilityRanks = ranks;

  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside. A Set keeps each value once. has checks membership without searching a list
  // for duplicate entries.
  hero.abilityLoadout = [...new Set(defaults)]
    .filter((key) => ranks[key] > 0 && keys.includes(key))
    .slice(0, MAX_EQUIPPED_ABILITIES);

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  hero.skillPoints = Number.isSafeInteger(saved?.skillPoints) && saved.skillPoints >= 0
    ? saved.skillPoints : Math.max(1, hero.level);
  return hero;
}

// Recheck requirements, spend SP and Gold, then learn or raise this skill's rank. state is
// the game data to read or change; a default can point at shared GameState.
export function purchaseAdventurerAbility(heroId, key, state = GameState) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const hero = state.roster.find((entry) => entry.id === heroId);

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  const ability = hero && CLASS_DEFINITIONS[hero.className]?.abilities?.[key];
  if (!ability) return { ok: false, message: 'Ability unavailable.' };

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
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

  // ??= fills a missing value once. It leaves an existing value, including zero or false,
  // alone.
  hero.abilityRanks ??= {};
  hero.abilityRanks[key] = nextRank;
  hero.abilityLoadout ??= [];

  if (!current && hero.abilityLoadout.length < MAX_EQUIPPED_ABILITIES) hero.abilityLoadout.push(key);
  return { ok: true, message: `${ability.name} is now rank ${nextRank}.` };
}

// Equip or remove a known skill while respecting the battle-slot limit. state is the game
// data to read or change; a default can point at shared GameState.
export function toggleAdventurerAbility(heroId, key, state = GameState) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const hero = state.roster.find((entry) => entry.id === heroId);

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  if (!hero?.abilityRanks?.[key] || !CLASS_DEFINITIONS[hero.className]?.abilities?.[key]) {
    return { ok: false, message: 'Unlock this ability first.' };
  }

  // ??= fills a missing value once. It leaves an existing value, including zero or false,
  // alone.
  hero.abilityLoadout ??= [];
  if (hero.abilityLoadout.includes(key)) {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    hero.abilityLoadout = hero.abilityLoadout.filter((id) => id !== key);
    return { ok: true, message: 'Ability unequipped.' };
  }

  if (hero.abilityLoadout.length >= MAX_EQUIPPED_ABILITIES) {
    return { ok: false, message: 'Unequip an ability to free a slot.' };
  }
  hero.abilityLoadout.push(key);

  return { ok: true, message: 'Ability equipped.' };
}

// Build only the equipped skills and their current ranked values for combat. hero is the
// roster record, rather than the artwork that displays that character.
export function battleAbilities(hero) {
  const result = {};

  // A Set keeps each value once. has checks membership without searching a list for
  // duplicate entries. ?? uses the fallback only for null or undefined. A real zero or
  // false stays intact.
  const equipped = new Set(hero.abilityLoadout ?? []);
  for (const [key, base] of abilityEntries(hero)) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const rank = hero.abilityRanks?.[key] ?? 0;
    if (!equipped.has(key) || rank < 1) continue;
    const ability = rankedAbility(base, rank);
    result[key] = ability;
  }

  return result;
}

// Build this skill's values at the requested learned rank without changing its catalog
// row.
export function rankedAbility(base, rank = 1) {
  const powerScale = 1 + (rank - 1) * 0.12;
  const durationScale = 1 + (rank - 1) * 0.05;

  // ... copies the source's own fields into this object; fields listed later replace
  // earlier ones. This is a shallow copy, so nested objects are still shared.
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
