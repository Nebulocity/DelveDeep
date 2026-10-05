export const ITEM_RARITIES = {
  common: { label: 'Common', color: '#d6d3d1' },
  uncommon: { label: 'Uncommon', color: '#4ade80' },
  rare: { label: 'Rare', color: '#60a5fa' },
  epic: { label: 'Epic', color: '#c084fc' },
  legendary: { label: 'Legendary', color: '#fb923c' }
};

const frontliners = ['Gladiator', 'Oathwarden', 'Dawnwarden', 'Barbarian', 'Barmaid', 'Scoundrel'];
const mages = ['Mage of the Umbral Veil', 'Mage of the Crimson Spire', 'Mage of the Luminous Archive'];
const clerics = ['Cleric of the Everbright', 'Cleric of the Verdant Covenant', 'Cleric of the Sanguine Song'];

export const EQUIPMENT_ITEMS = [
  { id: 'field-blade', name: 'Field Blade', slot: 'weapon', rarity: 'common', usableBy: frontliners, stats: { attackPower: 2 }, description: 'A plain but reliable blade for close combat.' },
  { id: 'trail-bow', name: 'Trail Bow', slot: 'weapon', rarity: 'common', usableBy: ['Ranger'], stats: { attackPower: 2 }, description: 'A light bow suited to long roads and narrow caves.' },
  { id: 'apprentice-focus', name: 'Apprentice Focus', slot: 'weapon', rarity: 'common', usableBy: mages, stats: { attackPower: 2 }, description: 'A simple focus that steadies spellcasting.' },
  { id: 'pilgrim-staff', name: 'Pilgrim Staff', slot: 'weapon', rarity: 'common', usableBy: clerics, stats: { healPower: 2 }, description: 'A travel staff carved for patient hands.' },
  { id: 'padded-vest', name: 'Padded Vest', slot: 'armor', rarity: 'common', usableBy: [...frontliners, 'Ranger', ...mages, ...clerics], stats: { maxHp: 12 }, description: 'Quilted protection that fits any adventurer.' },
  { id: 'iron-guard', name: 'Iron Guard', slot: 'armor', rarity: 'common', usableBy: ['Gladiator', 'Oathwarden', 'Dawnwarden'], stats: { maxHp: 16, armor: 0.01 }, description: 'Basic iron protection for a front-line defender.' }
];

export const EQUIPMENT_BY_ID = Object.fromEntries(EQUIPMENT_ITEMS.map((item) => [item.id, item]));

export const POTION_ITEMS = [
  { id: 'mending-potion', name: 'Health Potion', slot: 'potion', rarity: 'common', uses: 3, price: 60, effect: { resource: 'hp', fraction: 0.3 }, description: 'Restores 30% of maximum HP to its user.' },
  { id: 'clarity-potion', name: 'Mana Potion', slot: 'potion', rarity: 'common', uses: 3, price: 60, effect: { resource: 'mana', fraction: 0.3 }, description: 'Restores 30% of maximum mana to its user.' }
];

export const POTION_BY_ID = Object.fromEntries(POTION_ITEMS.map((item) => [item.id, item]));

export const CRAFTING_MATERIALS = {
  iron: { id: 'iron', name: 'Iron Ore', rarity: 'common', description: 'Raw metal for weapons and heavy armor.' },
  wood: { id: 'wood', name: 'Hardwood', rarity: 'common', description: 'Seasoned timber for bows and staves.' },
  leather: { id: 'leather', name: 'Cured Leather', rarity: 'common', description: 'Flexible material for grips and light armor.' },
  cloth: { id: 'cloth', name: 'Woven Cloth', rarity: 'common', description: 'Sturdy fabric for robes, padding, and scrolls.' },
  herb: { id: 'herb', name: 'Wild Herbs', rarity: 'common', description: 'Gathered plants for future potion recipes.' },
  essence: { id: 'essence', name: 'Arcane Essence', rarity: 'common', description: 'A trace of magic for scrolls and future mixtures.' }
};

export const CRAFTING_RECIPES = [
  { id: 'field-blade', name: 'Field Blade', category: 'equipment', output: { type: 'equipment', itemId: 'field-blade', count: 1 }, ingredients: { iron: 3, leather: 1 }, description: 'Forge a reliable close-combat blade.' },
  { id: 'trail-bow', name: 'Trail Bow', category: 'equipment', output: { type: 'equipment', itemId: 'trail-bow', count: 1 }, ingredients: { leather: 3, cloth: 1 }, description: 'Shape a light bow for a Ranger.' },
  { id: 'apprentice-focus', name: 'Apprentice Focus', category: 'equipment', output: { type: 'equipment', itemId: 'apprentice-focus', count: 1 }, ingredients: { cloth: 2, essence: 2 }, description: 'Bind arcane essence into a simple spell focus.' },
  { id: 'pilgrim-staff', name: 'Pilgrim Staff', category: 'equipment', output: { type: 'equipment', itemId: 'pilgrim-staff', count: 1 }, ingredients: { wood: 3, cloth: 1 }, description: 'Craft a healing staff for a cleric.' },
  { id: 'padded-vest', name: 'Padded Vest', category: 'equipment', output: { type: 'equipment', itemId: 'padded-vest', count: 1 }, ingredients: { leather: 2, cloth: 2 }, description: 'Sew flexible padded armor.' },
  { id: 'iron-guard', name: 'Iron Guard', category: 'equipment', output: { type: 'equipment', itemId: 'iron-guard', count: 1 }, ingredients: { iron: 4, leather: 1 }, description: 'Forge sturdy front-line armor.' },
  { id: 'health-potion', name: 'Health Potion Pack', category: 'alchemy', output: { type: 'potion', itemId: 'mending-potion', count: 1 }, ingredients: { herb: 2, cloth: 1 }, description: 'Contains 3 Health Potions, identical to the Health Potions sold here.' },
  { id: 'mana-potion', name: 'Mana Potion Pack', category: 'alchemy', output: { type: 'potion', itemId: 'clarity-potion', count: 1 }, ingredients: { herb: 1, essence: 2 }, description: 'Contains 3 Mana Potions, identical to the Mana Potions sold here.' }
];

export const CRAFTING_RECIPE_BY_ID = Object.fromEntries(CRAFTING_RECIPES.map((recipe) => [recipe.id, recipe]));

export function getEquipmentDefinition(id) {
  return EQUIPMENT_BY_ID[id] ?? null;
}

export function getPotionDefinition(id) {
  return POTION_BY_ID[id] ?? null;
}

export function getMaterialDefinition(id) {
  return CRAFTING_MATERIALS[id] ?? null;
}
