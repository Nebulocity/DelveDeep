import { ATTRIBUTE_STATS, CHANCE_STATS, cappedChance } from '../config/characterProgression.js';

export const MONSTER_STAT_DEFAULTS = {
  level: 1, maxHp: 1, maxMana: 0, armor: 0, dodge: 0, block: 0, speed: 100,
  strength: 0, agility: 0, constitution: 0, intellect: 0, wisdom: 0,
  hitChance: 0.1, critChance: 0, critMultiplier: 1.3,
  attackPower: 0, spellDamage: 0, spellHealing: 0, happiness: 80, delvesCompleted: 0
};

export function monsterStats(definition) {
  const stats = { ...MONSTER_STAT_DEFAULTS, ...definition, statProgressionVersion: 2 };
  stats.spellDamage = definition.spellDamage ?? stats.attackPower;
  stats.spellHealing = definition.spellHealing ?? definition.healPower ?? 0;
  for (const stat of ATTRIBUTE_STATS) stats[stat] = Math.max(0, stats[stat]);
  for (const stat of CHANCE_STATS) stats[stat] = cappedChance(stat, stats[stat]);
  return stats;
}

// Existing flat skill powers become percentages without changing their starting damage.
export function monsterAbilities(definition) {
  return Object.fromEntries(Object.entries(definition.abilities ?? {}).map(([key, ability]) => {
    const damageType = ability.damageType ?? 'physical';
    const stat = ability.effect === 'heal' ? definition.spellHealing
      : damageType === 'physical' ? definition.attackPower : definition.spellDamage;
    const power = ability.powerUnit === 'percent' ? ability.power : stat > 0 ? ability.power * 100 / stat : 0;
    return [key, { ...ability, damageType, power, powerUnit: 'percent' }];
  }));
}
