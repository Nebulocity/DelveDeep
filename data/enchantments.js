// These definitions describe compatible gear, bonuses and material requirements. An
// enchantment belongs to an owned gear instance. Its catalog entry stays reusable for
// other copies, and the inventory helpers apply or remove the actual bonuses.

import { ENCHANTMENT_ITEMS, CRAFTING_RECIPES } from './items.js';

// A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
// object; get/set read and write that same key. filter keeps entries whose callback
// returns true. It builds a new list and leaves the original list in place.
const scrollRecipes = new Map(CRAFTING_RECIPES.filter(recipe => recipe.output.type === 'scroll')
  .map(recipe => [recipe.output.itemId, recipe]));

const workbookEnchantments = ENCHANTMENT_ITEMS.map(item => {
  const recipe = scrollRecipes.get(item.id);

  // ... copies the source's own fields into this object; fields listed later replace
  // earlier ones. This is a shallow copy, so nested objects are still shared. ?? uses the
  // fallback only for null or undefined. A real zero or false stays intact. ?. only
  // follows this link when the value exists; a missing optional value gives undefined.
  return {
    id: item.id,
    name: item.name,
    slots: ['weapon', 'armor', 'accessory'],
    stats: { ...item.stats },
    ingredients: recipe?.ingredients ?? {},
    price: item.price ?? 0,
    craftingFee: recipe?.fee ?? 0,
    description: item.description
  };
});

// These names only translate old saves. They are not extra shop stock or old stat
// definitions: a restored scroll or enchantment uses its current catalog entry.
export const LEGACY_ENCHANTMENT_IDS = {
  'minor-might': 'SCE001', 'minor-mending': 'SCE003', 'minor-vigor': 'SCE005'
};

export const ENCHANTMENTS = workbookEnchantments;
export const ACTIVE_ENCHANTMENTS = workbookEnchantments;
export const ENCHANTMENT_BY_ID = Object.fromEntries(ENCHANTMENTS.map(entry => [entry.id, entry]));
