import { ENCHANTMENT_ITEMS, CRAFTING_RECIPES } from './items.js';

const scrollRecipes = new Map(CRAFTING_RECIPES.filter(recipe => recipe.output.type === 'scroll')
  .map(recipe => [recipe.output.itemId, recipe]));

const workbookEnchantments = ENCHANTMENT_ITEMS.map(item => {
  const recipe = scrollRecipes.get(item.id);
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

const legacyEnchantments = [
  { id: 'minor-might', name: 'Minor Might', slots: ['weapon'], stats: { attackPower: 1 }, ingredients: { MAT014: 2, MAT002: 2 }, price: 80, craftingFee: 0, description: '+1 Attack on a weapon.', legacy: true },
  { id: 'minor-mending', name: 'Minor Mending', slots: ['weapon'], stats: { healPower: 1 }, ingredients: { MAT014: 4 }, price: 80, craftingFee: 0, description: '+1 Healing on a weapon.', legacy: true },
  { id: 'minor-vigor', name: 'Minor Vigor', slots: ['armor', 'accessory'], stats: { maxHp: 6 }, ingredients: { MAT014: 2, MAT010: 2 }, price: 80, craftingFee: 0, description: '+6 HP on armor or an accessory.', legacy: true }
];

export const ENCHANTMENTS = [...workbookEnchantments, ...legacyEnchantments];
export const ACTIVE_ENCHANTMENTS = workbookEnchantments;
export const ENCHANTMENT_BY_ID = Object.fromEntries(ENCHANTMENTS.map(entry => [entry.id, entry]));
