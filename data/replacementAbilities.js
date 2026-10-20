// Role categories are permissions, including for generic abilities. The roster, gear
// and ability catalog use the same current playable class identities.

import { REPLACEMENT_ABILITY_ROWS } from './replacementAbilityCatalog.js';
import { progressionProfile } from '../config/characterProgression.js';
import { balancedHealingAbility } from '../config/healingBalance.js';
import { withAbilityRankCurve } from './abilityRankCurves.js';
import { abilityUnlockLevel, abilityEnabled } from './abilityUnlocks.js';

export const ABILITY_CATALOG_VERSION = 2;
export const CLASS_ABILITY_RULES = {
  Runedancer: ['Magical', 'Assault', 'Protect', 'Prepare'],
  Gladiator: ['Physical', 'Protect', 'Assault', 'Prepare'],
  Oathwarden: ['Physical', 'Protect', 'Assault', 'Prepare'],
  Dawnwarden: ['Magical', 'Protect', 'Assault', 'Restore'],
  Barbarian: ['Physical', 'Assault', 'Prepare', 'Protect'],
  Scoundrel: ['Physical', 'Assault', 'Prepare', 'Protect'],
  Barmaid: ['Physical', 'Assault', 'Prepare', 'Protect'],
  Ranger: ['Physical', 'Assault', 'Prepare', 'Protect'],
  'Umbramancer': ['Magical', 'Assault', 'Prepare', 'Restore'],
  'Spellbinder': ['Magical', 'Assault', 'Prepare', 'Restore'],
  'Arcanist': ['Magical', 'Assault', 'Prepare', 'Restore'],
  'Dawnpriest': ['Magical', 'Restore', 'Protect', 'Assault'],
  'Grovekeeper': ['Magical', 'Restore', 'Protect', 'Assault'],
  'Sanguinist': ['Magical', 'Restore', 'Protect', 'Assault']
};
// These identities override generic physical/magical pools, including Dawnwarden Interpose.
export const CLASS_RESTRICTED_ABILITIES = {
  ability_v2_generic_physical_intervene: ['Gladiator', 'Oathwarden'],
  ability_v2_generic_physical_charge: ['Barbarian', 'Barmaid'],
  ability_v2_generic_physical_interpose: ['Dawnwarden']
};

// Check this again when loading and equipping, rather than trusting a saved category.
export function abilityAllowed(className, row) {
  if (!abilityEnabled(row)) return false;
  const name = className;
  const rules = CLASS_ABILITY_RULES[name];
  const exclusive = CLASS_RESTRICTED_ABILITIES[row.id];
  if (exclusive) return exclusive.includes(name) && rules.slice(1).includes(row.category);
  if (!rules || row.excludedClasses?.includes(name) || !rules.slice(1).includes(row.category)) return false;
  return row.className === name || row.className === `Generic (${rules[0]})`;
}

// Distances in the workbook are logical arena units. The existing skill API measures
// them in paces, so divide by 100 once here. Shapes retain their arena-unit sizes too.
export function replacementAbilities(className, healingMultiplier) {
  const name = className;

  const multiplier = healingMultiplier ?? progressionProfile(className)?.base.healingMultiplier ?? 1;
  const rows = REPLACEMENT_ABILITY_ROWS.filter(row => abilityAllowed(className, row)).map(row => balancedHealingAbility(row, multiplier)).map(withAbilityRankCurve);
  const order = row => row.starterFor.includes(name)
    ? row.className.startsWith('Generic') ? 2 : CLASS_ABILITY_RULES[name].slice(1).indexOf(row.category) : 3;
  rows.sort((a, b) => order(a) - order(b));
  return Object.fromEntries(rows.map(row => {
    const range = row.castRange === 'Anywhere' ? Infinity : row.castRange === 'Self' ? 0
      : row.castRange === 'Weapon reach' ? (name === 'Ranger' ? 6 : 1) : row.castRange / 100;
    const target = row.handler === 'intervene' ? 'dual' : row.targetLabel === 'Self' ? 'self' : row.targetLabel.includes('ally') || row.targetLabel === 'Allies' ? 'ally'
      : row.targetLabel === 'Ground position' ? 'ground' : 'enemy';
    return [row.id, {
      ...row, minimumLevel: abilityUnlockLevel(row, name), replacement: true, effect: 'replacement', range, target,
      primary: { ...row.primary }, secondary: { ...row.secondary },
      starter: abilityUnlockLevel(row) === 1, origin: row.className.startsWith('Generic') ? 'Generic' : 'Class',
      power: row.primary.potency * 100, powerUnit: row.primary.unit,
      description: row.primary.text + (row.secondary.text === 'None' ? '' : ' ' + row.secondary.text),
      zone: row.shape === 'Circle' && row.anchor !== 'Caster' ? row.radius / 100 : undefined,
      beam: row.shape === 'Line',
      oncePerWave: row.limits.includes('once per wave'),
      oncePerEncounter: /once per encounter/i.test(row.limits)
    }];
  }));
}

// Keep fractional potency until the final damage or resource change. Rounding early
// would erase small percentage-point gains. Binary rules and costs do not grow.
export function rankedReplacementAbility(base, rank) {
  const trainedRank = Math.max(1, Math.min(10, Math.floor(rank)));

  // New definitions own explicit ranked values. Historical saved kits retain their old curve.
  if (base.rankValues) {
    const values = base.rankValues[trainedRank - 1];
    return { ...base, ...values, rank: trainedRank, primary: { ...values.primary },
      secondary: { ...values.secondary }, power: values.primary.potency * 100 };
  }
  const scale = 1 + (trainedRank - 1) * 0.08;
  const durationScale = 1 + (trainedRank - 1) * 0.02;
  const effect = value => ({ ...value, potency: Math.min(value.cap ?? Infinity, value.potency * scale) });
  return {
    ...base, rank: trainedRank, primary: effect(base.primary), secondary: effect(base.secondary),
    duration: Math.min(base.durationCap, base.duration * durationScale),
    secondaryDuration: Math.min(base.secondaryDurationCap, base.secondaryDuration * durationScale),
    cooldown: Math.max(base.cooldownFloor, base.cooldown * (1 - (trainedRank - 1) * 0.02)),
    power: effect(base.primary).potency * 100
  };
}
