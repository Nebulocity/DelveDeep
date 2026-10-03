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

export const CRAFTING_MATERIALS = {
  iron: { id: 'iron', name: 'Iron Ore', rarity: 'common', description: 'Raw metal for weapons and heavy armor.' },
  leather: { id: 'leather', name: 'Cured Leather', rarity: 'common', description: 'Flexible material for grips and light armor.' },
  cloth: { id: 'cloth', name: 'Woven Cloth', rarity: 'common', description: 'Sturdy fabric for robes, padding, and scrolls.' },
  herb: { id: 'herb', name: 'Wild Herbs', rarity: 'common', description: 'Gathered plants for future potion recipes.' },
  essence: { id: 'essence', name: 'Arcane Essence', rarity: 'common', description: 'A trace of magic for scrolls and future mixtures.' }
};

export function getEquipmentDefinition(id) {
  return EQUIPMENT_BY_ID[id] ?? null;
}

export function getMaterialDefinition(id) {
  return CRAFTING_MATERIALS[id] ?? null;
}
