import { CRAFTING_MATERIALS, MATERIAL_ID_ALIASES } from '../data/items.js';

export function delveMaterialIds(delve) {
  if (delve?.type !== 'delve') return [];
  const pool = (delve.materialDrops ?? Object.keys(CRAFTING_MATERIALS))
    .map(id => CRAFTING_MATERIALS[id] ? id : MATERIAL_ID_ALIASES[id])
    .filter(id => CRAFTING_MATERIALS[id]);
  return [...new Set(pool)];
}

export function delveDropNames(delve) {
  return ['Gold / Adventurer XP', ...delveMaterialIds(delve).map(id => CRAFTING_MATERIALS[id].name)];
}
