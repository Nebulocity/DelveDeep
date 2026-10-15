// These helpers give combat and inspection a consistent set of character stats. Version 2
// skill power is a percentage of Attack Power or Spell Power. Older
// records retain a compatibility path. Avoid applying level or equipment bonuses twice by
// rebuilding from the proper base data before using these helpers.

import { CLASS_DEFINITIONS } from '../data/classes.js';
import { progressionResources } from '../config/characterProgression.js';
import { replacementMultiplier } from '../combat/ReplacementEffects.js';

// Rebuild current combat stats from class, level and bonuses while preserving character
// history. hero is the roster record, rather than the artwork that displays that
// character.
export function rebuildCharacterStats(hero, attributeBonuses = {}) {
  const stats = progressionResources(hero.className, hero.level, attributeBonuses);
  if (!stats) return hero;

  // Leave Happiness and completed-Delve history on the existing hero. The rebuilt profile
  // supplies combat stats; it must not replace the character's earned history with level-1
  // defaults.
  const { happiness, delvesCompleted, ...combatStats } = stats;

  // ... copies the source's own fields into this object; fields listed later replace
  // earlier ones. This is a shallow copy, so nested objects are still shared.
  const result = { ...hero, ...combatStats, healPower: stats.spellPower, statProgressionVersion: 2 };

  // Roster totals are rebuilt from class and level on load, rather than merging the old
  // two powers or adding them twice. Old live battle records do not use this rebuild.
  delete result.spellDamage;
  delete result.spellHealing;
  return result;
}

// Fill missing combat fields from class-compatible defaults so callers can read a
// consistent stat record. hero is the roster record, rather than the artwork that displays
// that character.
export function characterStats(hero) {

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  const base = CLASS_DEFINITIONS[hero.className] ?? {};

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  const levelBonus = Math.max(0, (hero.level ?? 1) - 1) * 2;

  // ... copies the source's own fields into this object; fields listed later replace
  // earlier ones. This is a shallow copy, so nested objects are still shared.
  const stats = {
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

  // Separate power defaults exist only for historical units. Canonical Spell Power,
  // including zero, is authoritative for both spell types in fresh encounters.
  if (hero.spellPower != null) {
    delete stats.spellDamage;
    delete stats.spellHealing;
  }
  return stats;
}

// For legacy skills, calculate only the power gained above the class starting value. unit
// is the live combatant, with current resources and arena position. ability is the
// selected skill data, including its current rank values.
export function abilityStatBonus(unit, ability, healing = false) {

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  const base = CLASS_DEFINITIONS[unit.className] ?? {};
  const stats = characterStats(unit);

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const value = healing ? (stats.spellPower ?? stats.spellHealing)
    : ability.damageType === 'physical' ? stats.attackPower : (stats.spellPower ?? stats.spellDamage);

  // Legacy skill calculations add only the gain above the class starting power. Version 2
  // takes a percentage of the whole current power instead, so this compatibility path must
  // not be used as an extra version-2 bonus.
  const spellBaseline = stats.spellPower != null ? progressionResources(unit.className)?.spellPower : null;
  const baseline = healing ? spellBaseline ?? base.spellHealing ?? base.healPower ?? 0
    : ability.damageType === 'physical' ? base.attackPower ?? value : spellBaseline ?? base.spellDamage ?? base.attackPower ?? value;

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  return Math.max(0, value - baseline);
}

// Convert ranked potency into damage or healing using the matching current stat and
// save-version rule. unit is the live combatant, with current resources and arena
// position. ability is the selected skill data, including its current rank values.
export function abilityPower(unit, ability, potency = ability.power, healing = false) {
  if (unit.statProgressionVersion !== 2) return potency + abilityStatBonus(unit, ability, healing);
  const stats = characterStats(unit);

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const value = healing ? (stats.spellPower ?? stats.spellHealing)
    : ability.damageType === 'physical' ? stats.attackPower : (stats.spellPower ?? stats.spellDamage);

  // Divide the whole percentage by 100 before applying it to the chosen stat. For example,
  // potency 150 and power 200 produce 300 before crits or mitigation.

  // Basic Mend uses the shared power too. Its small existing coefficient is independent
  // of class-spell tuning; temporary Spell Power buffs still strengthen it once.
  const modifier = healing && stats.spellPower != null
    ? replacementMultiplier(unit, 'spell', unit.scene?.time.now ?? 0) : 1;
  return value * potency / 100 * modifier;
}

// Convert actual dealt damage into linked healing using this skill's ratio and the
// caster's stats. unit is the live combatant, with current resources and arena position.
// ability is the selected skill data, including its current rank values.
export function linkedHealing(unit, ability, damage, ratio = ability.healRatio) {
  if (unit.statProgressionVersion !== 2) return damage * ratio + abilityStatBonus(unit, ability, true);

  // One shared power makes the old healing-to-damage ratio equal to one. Historical
  // encounters retain their separate ratio and zero check below.
  if (unit.spellPower != null) return unit.spellPower > 0 ? damage * ratio : 0;

  // Linked healing starts with actual dealt damage, then scales by healRatio and the
  // unit's Healing-to-Damage stat ratio. The zero check avoids dividing by zero for a unit
  // without Spell Damage.
  return unit.spellDamage > 0 ? damage * ratio * unit.spellHealing / unit.spellDamage : 0;
}

// Return base accuracy plus the displayed hit bonus for current stats, preserving the
// legacy format.
export function hitAccuracy(attacker) {

  // The condition before ? chooses the first value when true and the value after : when
  // false. ?? uses the fallback only for null or undefined. A real zero or false stays
  // intact.
  return attacker.statProgressionVersion === 2 ? 0.9 + (attacker.hitChance ?? 0) : attacker.hitChance ?? 1;
}
