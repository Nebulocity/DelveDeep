// Material pools come from the selected encounter environment and difficulty. Reused
// encounters inherit their template's pool. Keep the displayed list and the actual reward
// rolls reading the same source so the Delve Info screen does not promise the wrong
// materials.

import { CRAFTING_MATERIALS, MATERIAL_ID_ALIASES } from '../data/items.js';
import { FARM_MATERIAL_CHANCES } from '../config/farmMaterialDrops.js';

// Resolve this encounter's environment pool. Without an override, use first-clear
// difficulty rules; farming supplies allowedRarities to check one chart rarity at a time.
export function delveMaterialIds(delve, allowedRarities = null) {

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  if (delve?.type !== 'delve') return [];
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
  return ['Gold / Adventurer XP', ...ids.map(id => CRAFTING_MATERIALS[id].name)];
}
