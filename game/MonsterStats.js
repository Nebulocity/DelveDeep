// Enemies use the shared stat fields and combat formulas, but their authored values are
// already their totals. We do not add adventurer level growth to a monster. This lets the
// inspection screen and actual battle agree about armor, accuracy, speed and skill power.

import { ATTRIBUTE_STATS, CHANCE_STATS, cappedChance } from '../config/characterProgression.js';

export const MONSTER_STAT_DEFAULTS = {
  level: 1, maxHp: 1, maxMana: 0, armor: 0, dodge: 0, block: 0, speed: 100,
  strength: 0, agility: 0, constitution: 0, intellect: 0, wisdom: 0,
  hitChance: 0.1, critChance: 0, critMultiplier: 1.3,
  attackPower: 0, spellDamage: 0, spellHealing: 0, happiness: 80, delvesCompleted: 0
};

// Fill the shared combat stat record from authored monster totals without adventurer
// growth.
export function monsterStats(definition) {

  // ... copies the source's own fields into this object; fields listed later replace
  // earlier ones. This is a shallow copy, so nested objects are still shared.
  const stats = { ...MONSTER_STAT_DEFAULTS, ...definition, statProgressionVersion: 2 };

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  stats.spellDamage = definition.spellDamage ?? stats.attackPower;
  stats.spellHealing = definition.spellHealing ?? definition.healPower ?? 0;
  for (const stat of ATTRIBUTE_STATS) stats[stat] = Math.max(0, stats[stat]);

  for (const stat of CHANCE_STATS) stats[stat] = cappedChance(stat, stats[stat]);
  return stats;
}

// Existing flat skill powers become percentages without changing their starting damage.
export function monsterAbilities(definition) {

  // Object.fromEntries turns [key, value] pairs back into an object. A later pair with the
  // same key replaces the earlier value. map builds one output entry for each input entry,
  // in the same order. The callback's return value becomes that output entry.
  // Object.entries turns own fields into [key, value] pairs so we can visit or transform
  // them.
  return Object.fromEntries(Object.entries(definition.abilities ?? {}).map(([key, ability]) => {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const damageType = ability.damageType ?? 'physical';

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const stat = ability.effect === 'heal' ? definition.spellHealing
      : damageType === 'physical' ? definition.attackPower : definition.spellDamage;
    const power = ability.powerUnit === 'percent' ? ability.power : stat > 0 ? ability.power * 100 / stat : 0;

    // ... copies the source's own fields into this object; fields listed later replace
    // earlier ones. This is a shallow copy, so nested objects are still shared.
    return [key, { ...ability, damageType, power, powerUnit: 'percent' }];
  }));
}
