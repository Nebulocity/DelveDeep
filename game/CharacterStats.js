import { CLASS_DEFINITIONS } from '../data/classes.js';
import { progressionResources } from '../config/characterProgression.js';

export function rebuildCharacterStats(hero, attributeBonuses = {}) {
  const stats = progressionResources(hero.className, hero.level, attributeBonuses);
  if (!stats) return hero;
  const { happiness, delvesCompleted, ...combatStats } = stats;
  return { ...hero, ...combatStats, healPower: stats.spellHealing, statProgressionVersion: 2 };
}

export function characterStats(hero) {
  const base = CLASS_DEFINITIONS[hero.className] ?? {};
  const levelBonus = Math.max(0, (hero.level ?? 1) - 1) * 2;
  return {
    ...hero,
    maxMana: hero.maxMana ?? 0,
    armor: hero.armor ?? 0,
    dodge: hero.dodge ?? 0,
    block: hero.block ?? 0,
    hitChance: hero.hitChance ?? 1,
    critChance: hero.critChance ?? 0.1,
    critMultiplier: hero.critMultiplier ?? 1.75,
    spellDamage: hero.spellDamage ?? (base.attackPower ?? hero.attackPower ?? 0) + levelBonus,
    spellHealing: hero.spellHealing ?? hero.healPower ?? 0
  };
}

export function abilityStatBonus(unit, ability, healing = false) {
  const base = CLASS_DEFINITIONS[unit.className] ?? {};
  const stats = characterStats(unit);
  const value = healing ? stats.spellHealing : ability.damageType === 'physical' ? stats.attackPower : stats.spellDamage;
  const baseline = healing ? base.spellHealing ?? base.healPower ?? 0
    : ability.damageType === 'physical' ? base.attackPower ?? value : base.spellDamage ?? base.attackPower ?? value;
  return Math.max(0, value - baseline);
}

export function abilityPower(unit, ability, potency = ability.power, healing = false) {
  if (unit.statProgressionVersion !== 2) return potency + abilityStatBonus(unit, ability, healing);
  const stats = characterStats(unit);
  const value = healing ? stats.spellHealing : ability.damageType === 'physical' ? stats.attackPower : stats.spellDamage;
  return value * potency / 100;
}

export function linkedHealing(unit, ability, damage, ratio = ability.healRatio) {
  if (unit.statProgressionVersion !== 2) return damage * ratio + abilityStatBonus(unit, ability, true);
  return unit.spellDamage > 0 ? damage * ratio * unit.spellHealing / unit.spellDamage : 0;
}

export function hitAccuracy(attacker) {
  return attacker.statProgressionVersion === 2 ? 0.9 + (attacker.hitChance ?? 0) : attacker.hitChance ?? 1;
}
