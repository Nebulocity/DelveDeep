import { CLASS_DEFINITIONS } from '../data/classes.js';
import { abilityMeetsLevel } from '../data/abilityUnlocks.js';

// Only the undelivered events are saved. Availability itself is derived from level.
// A set also coalesces several XP grants before the player reaches a safe screen.
export function queueAbilityUnlocks(hero, previousLevel) {
  hero.abilityRanks ??= {};
  const keys = Object.entries(CLASS_DEFINITIONS[hero.className]?.abilities ?? {})
    .filter(([key, ability]) => ability.minimumLevel > previousLevel
      && abilityMeetsLevel(hero, ability) && !hero.abilityRanks?.[key])
    .map(([key]) => key);
  for (const key of keys) hero.abilityRanks[key] = 1;
  if (keys.length) hero.pendingAbilityUnlocks = [...new Set([...(hero.pendingAbilityUnlocks ?? []), ...keys])];
  return keys;
}

export function pendingAbilityUnlocks(roster) {
  return roster.flatMap(hero => {
    const definitions = CLASS_DEFINITIONS[hero.className]?.abilities ?? {};
    const abilities = [...new Set(hero.pendingAbilityUnlocks ?? [])]
      .map(key => definitions[key]).filter(ability => abilityMeetsLevel(hero, ability));
    return abilities.length ? [{ hero, abilities }] : [];
  });
}

export function acknowledgeAbilityUnlocks(groups) {
  for (const { hero, abilities } of groups) {
    acknowledgeAbilityUnlockIds(hero, abilities.map(ability => ability.id));
  }
}

export function acknowledgeAbilityUnlockIds(hero, keys) {
  const displayed = new Set(keys);
  hero.pendingAbilityUnlocks = (hero.pendingAbilityUnlocks ?? []).filter(key => !displayed.has(key));
}
