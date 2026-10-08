import { CRAFTING_MATERIALS, MATERIAL_ID_ALIASES } from '../data/items.js';

export function delveMaterialIds(delve) {
  if (delve?.type !== 'delve') return [];
  const higherTier = ['Difficult', 'Tough', 'Very Tough', 'Incredibly Tough', 'Impossible'].includes(delve.difficulty);
  const rarities = higherTier ? ['common', 'uncommon'] : ['common'];
  if (delve.materialEnvironments?.length) {
    return Object.values(CRAFTING_MATERIALS).filter(material =>
      rarities.includes(material.rarity) && material.environment.split(';').some(environment =>
        environment.trim() !== 'Crafted' && delve.materialEnvironments.includes(environment.trim())))
      .map(material => material.id);
  }
  const pool = (delve.materialDrops ?? [])
    .map(id => CRAFTING_MATERIALS[id] ? id : MATERIAL_ID_ALIASES[id])
    .filter(id => CRAFTING_MATERIALS[id] && rarities.includes(CRAFTING_MATERIALS[id].rarity)
      && CRAFTING_MATERIALS[id].environment !== 'Crafted');
  return [...new Set(pool)];
}

export function delveDropNames(delve) {
  return ['Gold / Adventurer XP', ...delveMaterialIds(delve).map(id => CRAFTING_MATERIALS[id].name)];
}
