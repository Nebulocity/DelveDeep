import GameState from './GameState.js';
import { CRAFTING_RECIPE_BY_ID, getEquipmentDefinition, getMaterialDefinition, getPotionDefinition } from '../data/items.js';
import { grantEquipment, grantEnchantmentScroll, grantMaterial, grantPotionPack } from './Equipment.js';

export function recipeIngredientText(recipe) {
  return Object.entries(recipe.ingredients).map(([id, count]) => `${count} ${getMaterialDefinition(id)?.name ?? id}`).join('  •  ');
}

export function canCraft(recipeId, state = GameState) {
  const recipe = CRAFTING_RECIPE_BY_ID[recipeId];
  if (!recipe) return { ok: false, message: 'That recipe is unavailable.' };
  const knownRecipes = state.inventory.knownRecipes
    ?? CRAFTING_RECIPES.filter(entry => entry.knownAtStart).map(entry => entry.id);
  if (!knownRecipes.includes(recipeId)) return { ok: false, message: 'Learn this recipe before crafting it.' };
  if ((state.gold ?? 0) < (recipe.fee ?? 0)) return { ok: false, message: `Need ${recipe.fee} Gold for the crafting fee.` };
  const missing = Object.entries(recipe.ingredients).filter(([id, count]) => (state.inventory.materials?.[id] ?? 0) < count);
  if (missing.length) return { ok: false, message: `Need ${missing.map(([id, count]) => `${Math.max(0, count - (state.inventory.materials?.[id] ?? 0))} ${getMaterialDefinition(id)?.name ?? id}`).join(', ')}.` };
  return { ok: true, recipe };
}

export function craftItem(recipeId, state = GameState) {
  const check = canCraft(recipeId, state);
  if (!check.ok) return check;
  const { recipe } = check;
  state.gold ??= 0;
  const definition = recipe.output.type === 'equipment' ? getEquipmentDefinition(recipe.output.itemId)
    : recipe.output.type === 'potion' ? getPotionDefinition(recipe.output.itemId)
      : recipe.output.type === 'scroll' ? { name: recipe.name.replace(/^Recipe:\s*/, '') }
        : recipe.output.type === 'material' ? getMaterialDefinition(recipe.output.itemId) : null;
  if (!definition) return { ok: false, message: 'The recipe output is unavailable.' };
  for (const [id, count] of Object.entries(recipe.ingredients)) {
    state.inventory.materials[id] -= count;
    if (state.inventory.materials[id] === 0) delete state.inventory.materials[id];
  }
  state.gold -= recipe.fee ?? 0;
  let instance;
  if (recipe.output.type === 'equipment') instance = grantEquipment(recipe.output.itemId, state);
  else if (recipe.output.type === 'potion') instance = grantPotionPack(recipe.output.itemId, state);
  else if (recipe.output.type === 'scroll') instance = grantEnchantmentScroll(recipe.output.itemId, state);
  else if (recipe.output.type === 'material') {
    instance = grantMaterial(recipe.output.itemId, recipe.output.count, state) ? { name: definition.name } : null;
  }
  if (!instance) {
    for (const [id, count] of Object.entries(recipe.ingredients)) state.inventory.materials[id] = (state.inventory.materials[id] ?? 0) + count;
    state.gold += recipe.fee ?? 0;
    return { ok: false, message: 'Could not create the recipe output.' };
  }
  return { ok: true, instance, message: `Crafted ${definition.name}.` };
}
