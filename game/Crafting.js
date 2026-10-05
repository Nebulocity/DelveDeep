import GameState from './GameState.js';
import { CRAFTING_RECIPE_BY_ID, getEquipmentDefinition, getMaterialDefinition, getPotionDefinition } from '../data/items.js';
import { grantEquipment, grantPotionPack } from './Equipment.js';

export function recipeIngredientText(recipe) {
  return Object.entries(recipe.ingredients).map(([id, count]) => `${count} ${getMaterialDefinition(id)?.name ?? id}`).join('  •  ');
}

export function canCraft(recipeId, state = GameState) {
  const recipe = CRAFTING_RECIPE_BY_ID[recipeId];
  if (!recipe) return { ok: false, message: 'That recipe is unavailable.' };
  const missing = Object.entries(recipe.ingredients).filter(([id, count]) => (state.inventory.materials?.[id] ?? 0) < count);
  if (missing.length) return { ok: false, message: `Need ${missing.map(([id, count]) => `${Math.max(0, count - (state.inventory.materials?.[id] ?? 0))} ${getMaterialDefinition(id)?.name ?? id}`).join(', ')}.` };
  return { ok: true, recipe };
}

export function craftItem(recipeId, state = GameState) {
  const check = canCraft(recipeId, state);
  if (!check.ok) return check;
  const { recipe } = check;
  const definition = recipe.output.type === 'equipment' ? getEquipmentDefinition(recipe.output.itemId) : getPotionDefinition(recipe.output.itemId);
  if (!definition) return { ok: false, message: 'The recipe output is unavailable.' };
  for (const [id, count] of Object.entries(recipe.ingredients)) {
    state.inventory.materials[id] -= count;
    if (state.inventory.materials[id] === 0) delete state.inventory.materials[id];
  }
  const instance = recipe.output.type === 'equipment'
    ? grantEquipment(recipe.output.itemId, state)
    : grantPotionPack(recipe.output.itemId, state);
  if (!instance) {
    for (const [id, count] of Object.entries(recipe.ingredients)) state.inventory.materials[id] = (state.inventory.materials[id] ?? 0) + count;
    return { ok: false, message: 'Could not create the recipe output.' };
  }
  return { ok: true, instance, message: `Crafted ${definition.name}.` };
}
