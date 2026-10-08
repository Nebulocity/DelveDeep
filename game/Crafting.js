// Crafting checks the known recipe, materials and Gold before spending anything. Recipes
// describe the requirements; inventory holds what the player actually owns. A successful
// craft grants through the shared inventory helpers so IDs and save rules match items
// obtained from shops and rewards.

import GameState from './GameState.js';
import { CRAFTING_RECIPE_BY_ID, getEquipmentDefinition, getMaterialDefinition, getPotionDefinition } from '../data/items.js';
import { grantEquipment, grantEnchantmentScroll, grantMaterial, grantPotionPack } from './Equipment.js';

// Format required materials from the same recipe data used by crafting.
export function recipeIngredientText(recipe) {

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry. Object.entries turns own fields into [key,
  // value] pairs so we can visit or transform them.
  return Object.entries(recipe.ingredients).map(([id, count]) => `${count} ${getMaterialDefinition(id)?.name ?? id}`).join('  •  ');
}

// Check recipe knowledge, materials and Gold before allowing a craft. state is the game
// data to read or change; a default can point at shared GameState.
export function canCraft(recipeId, state = GameState) {
  const recipe = CRAFTING_RECIPE_BY_ID[recipeId];
  if (!recipe) return { ok: false, message: 'That recipe is unavailable.' };

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry. filter keeps entries whose callback returns
  // true. It builds a new list and leaves the original list in place.
  const knownRecipes = state.inventory.knownRecipes
    ?? CRAFTING_RECIPES.filter(entry => entry.knownAtStart).map(entry => entry.id);
  if (!knownRecipes.includes(recipeId)) return { ok: false, message: 'Learn this recipe before crafting it.' };

  if ((state.gold ?? 0) < (recipe.fee ?? 0)) return { ok: false, message: `Need ${recipe.fee} Gold for the crafting fee.` };

  // Object.entries turns own fields into [key, value] pairs so we can visit or transform
  // them.
  const missing = Object.entries(recipe.ingredients).filter(([id, count]) => (state.inventory.materials?.[id] ?? 0) < count);
  if (missing.length) return { ok: false, message: `Need ${missing.map(([id, count]) => `${Math.max(0, count - (state.inventory.materials?.[id] ?? 0))} ${getMaterialDefinition(id)?.name ?? id}`).join(', ')}.` };
  return { ok: true, recipe };
}

// Recheck the recipe, spend its requirements and grant the finished item through inventory
// helpers. state is the game data to read or change; a default can point at shared
// GameState.
export function craftItem(recipeId, state = GameState) {
  const check = canCraft(recipeId, state);
  if (!check.ok) return check;

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { recipe } = check;

  // ??= fills a missing value once. It leaves an existing value, including zero or false,
  // alone.
  state.gold ??= 0;

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const definition = recipe.output.type === 'equipment' ? getEquipmentDefinition(recipe.output.itemId)
    : recipe.output.type === 'potion' ? getPotionDefinition(recipe.output.itemId)
      : recipe.output.type === 'scroll' ? { name: recipe.name.replace(/^Recipe:\s*/, '') }
        : recipe.output.type === 'material' ? getMaterialDefinition(recipe.output.itemId) : null;

  if (!definition) return { ok: false, message: 'The recipe output is unavailable.' };

  // Object.entries turns own fields into [key, value] pairs so we can visit or transform
  // them.
  for (const [id, count] of Object.entries(recipe.ingredients)) {
    state.inventory.materials[id] -= count;
    if (state.inventory.materials[id] === 0) delete state.inventory.materials[id];
  }

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
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
