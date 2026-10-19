import { CRAFTING_RECIPES, EQUIPMENT_ITEMS, POTION_ITEMS } from '../data/items.js';
import { ACTIVE_ENCHANTMENTS } from '../data/enchantments.js';

// Match the merchants' current buy catalogs. Stocked items need no discovery first.
const stockedItems = new Set([
  ...EQUIPMENT_ITEMS.filter(item => Number.isFinite(item.price) && item.price > 0),
  ...POTION_ITEMS,
  ...ACTIVE_ENCHANTMENTS
].map(item => item.id));

export const DEFAULT_RECIPE_IDS = CRAFTING_RECIPES
  .filter(recipe => recipe.knownAtStart || stockedItems.has(recipe.output.itemId))
  .map(recipe => recipe.id);

// Knowledge survives selling, consuming or equipping the discovered item.
export function learnItemRecipes(type, itemId, state) {
  state.inventory.knownRecipes ??= [];
  for (const recipe of CRAFTING_RECIPES) {
    if (recipe.output.type === type && recipe.output.itemId === itemId
      && !state.inventory.knownRecipes.includes(recipe.id)) {
      state.inventory.knownRecipes.push(recipe.id);
    }
  }
}

// Also observe restored inventory, including equipped copies held in the shared list.
export function learnInventoryRecipes(state) {
  state.inventory.knownRecipes = [...new Set([
    ...(state.inventory.knownRecipes ?? []), ...DEFAULT_RECIPE_IDS
  ])];
  for (const item of state.inventory.equipment ?? []) {
    const type = item.slot === 'potion' ? 'potion' : item.slot === 'scroll' ? 'scroll' : 'equipment';
    learnItemRecipes(type, item.itemId, state);
  }
  for (const [id, count] of Object.entries(state.inventory.materials ?? {})) {
    if (count > 0) learnItemRecipes('material', id, state);
  }
}
