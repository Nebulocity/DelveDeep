import { CRAFTING_MATERIALS } from '../data/items.js';

export function delveMaterialIds(delve) {
  if (delve?.type !== 'delve') return [];
  const pool = (delve.materialDrops ?? Object.keys(CRAFTING_MATERIALS)).filter(id => CRAFTING_MATERIALS[id]);
  return [...new Set(pool)];
}

export function delveDropNames(delve) {
  return ['Gold / Adventurer XP', ...delveMaterialIds(delve).map(id => CRAFTING_MATERIALS[id].name)];
}
