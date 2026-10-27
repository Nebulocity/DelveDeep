// Material pools come from the selected encounter environment and difficulty. Reused
// encounters inherit their template's pool. Keep the displayed list and the actual reward
// rolls reading the same source so the Delve Info screen does not promise the wrong
// materials.

import { CRAFTING_MATERIALS, MATERIAL_ID_ALIASES } from '../data/items.js';
import { FARM_MATERIAL_CHANCES } from '../config/farmMaterialDrops.js';
import { equipmentLootPool, equipmentLootTable, EQUIPMENT_LOOT_RARITIES } from './EquipmentLoot.js';
import { pineshireProgression } from '../data/pineshireProgression.js';

// Resolve this encounter's environment pool. Without an override, use first-clear
// difficulty rules; farming supplies allowedRarities to check one chart rarity at a time.
export function delveMaterialIds(delve, allowedRarities = null) {

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  if (delve?.type !== 'delve' && !delve?.campWaves?.length) return [];
  const higherTier = ['Difficult', 'Tough', 'Very Tough', 'Incredibly Tough', 'Impossible'].includes(delve.difficulty);

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const rarities = allowedRarities ?? (higherTier ? ['common', 'uncommon'] : ['common']);
  if (delve.materialEnvironments?.length) {

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry. filter keeps entries whose callback returns
    // true. It builds a new list and leaves the original list in place.
    return Object.values(CRAFTING_MATERIALS).filter(material =>
      rarities.includes(material.rarity) && material.environment.split(';').some(environment =>
        environment.trim() !== 'Crafted' && delve.materialEnvironments.includes(environment.trim())))
      .map(material => material.id);
  }

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  const pool = (delve.materialDrops ?? [])
    .map(id => CRAFTING_MATERIALS[id] ? id : MATERIAL_ID_ALIASES[id])
    .filter(id => CRAFTING_MATERIALS[id] && rarities.includes(CRAFTING_MATERIALS[id].rarity)
      && CRAFTING_MATERIALS[id].environment !== 'Crafted');

  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside. A Set keeps each value once. has checks membership without searching a list
  // for duplicate entries.
  return [...new Set(pool)];
}

// Turn the eligible material IDs into readable names for Delve information.
export function delveDropNames(delve) {

  // Delve Info includes both first-clear and farm possibilities. Easy farming now has
  // a small Uncommon chance even though its first-clear pool remains Common only.
  const chances = FARM_MATERIAL_CHANCES[delve?.difficulty] ?? FARM_MATERIAL_CHANCES.Easy;
  const farmRarities = Object.keys(chances).filter(rarity => chances[rarity] > 0);
  const ids = [...new Set([...delveMaterialIds(delve), ...delveMaterialIds(delve, farmRarities)])];

  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside. map builds one output entry for each input entry, in the same order. The
  // callback's return value becomes that output entry.
  const equipment = [];
  for (const rarity of [...EQUIPMENT_LOOT_RARITIES].reverse()) {
    const sources = ['wave', 'boss'].filter(source => {
      const table = equipmentLootTable({ source, location: delve.id, region: delve.regionId ?? 'pineshire-reach' });
      return table?.rolls[rarity] > 0 && equipmentLootPool(table.region, source, delve.id, rarity).length > 0;
    });
    if (sources.length) equipment.push(`${rarity[0].toUpperCase() + rarity.slice(1)} equipment (${sources.length === 2 ? 'waves and final boss' : 'final boss'})`);
  }
  const plan = pineshireProgression(delve);
  const firstClear = plan ? [
    'First clear: guaranteed equipment each wave',
    plan.cap === 10 ? 'Waves 1-9: Common, 30% Uncommon; 10-11: Uncommon, 35% Rare'
      : plan.waves === 6 ? 'Waves 1-3: Common; 4-5: Common, 30% Uncommon'
        : 'Waves 1-9: Common, 30% Uncommon',
    `First final boss: party-usable ${plan.cap === 10 ? 'Epic' : 'Rare'}`
  ] : [];
  // Keep repeat equipment tiers out of the campaign Delve Details list.
  return ['Gold / Adventurer XP', ...firstClear, ...ids.map(id => CRAFTING_MATERIALS[id].name),
    ...(plan ? [] : equipment)];
}
