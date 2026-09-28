import { CLASS_DEFINITIONS, CLASS_MIGRATIONS } from './classes.js';

export const ITEM_RARITIES = {
  uncommon: { label: 'Uncommon', color: '#4ade80', level: 1 },
  rare: { label: 'Rare', color: '#60a5fa', level: 2 },
  epic: { label: 'Epic', color: '#c084fc', level: 3 },
  legendary: { label: 'Legendary', color: '#fb923c', level: 4 }
};

// Each class has two alternative uncommon weapons, one uncommon armor,
// and a rare upgrade for each slot. Stable IDs are stored in player saves.
const CLASS_KITS = {
  Paladin: ['Dawn Mace', 'Pilgrim Hammer', 'Dawn Plate', 'Sunforged Mace', 'Sunforged Plate'],
  Rogue: ['Dusk Dagger', 'Viper Knife', 'Shadow Leather', 'Nightfang', 'Nightstalker Leather'],
  Barbarian: ['Raider Axe', 'Boar Cleaver', 'Raider Hide', 'Stormsplitter', 'Thunderhide'],
  'Mage of the Crimson Spire': ['Crimson Staff', 'Spire Wand', 'Red Robe', 'Arcane Staff', 'Crimson Robe'],
  'Mage of the Luminous Archive': ['Lumen Staff', 'Libram Focus', 'White Robe', 'Archive Staff', 'Luminous Robe'],
  Wizard: ['Ember Staff', 'Runic Wand', 'Apprentice Robe', 'Starfire Staff', 'Starweave Robe'],
  Ranger: ['Trail Bow', 'Thorn Bow', 'Trail Leathers', 'Hawkeye Bow', 'Hawkeye Leathers'],
  Naturalist: ['Willow Staff', 'Bloom Scepter', 'Grove Vestments', 'Lifebloom Staff', 'Lifebloom Vestments'],
  Priest: ['Dawn Scepter', 'Mercy Mace', 'Acolyte Robe', 'Radiant Scepter', 'Radiant Vestments'],
  Bloodwarder: ['Crimson Focus', 'Sanguine Rod', 'Bloodwoven Robe', 'Heartfire Focus', 'Heartfire Robe']
};

export const EQUIPMENT_ITEMS = Object.entries(CLASS_KITS).flatMap(([kitId, names]) => {
  const className = CLASS_MIGRATIONS[kitId] ?? kitId;
  const role = CLASS_DEFINITIONS[className].role;
  const power = role === 'Healer' ? 'healPower' : 'attackPower';
  const variants = [
    { suffix: 'weapon', slot: 'weapon', rarity: 'uncommon', stats: { [power]: 3 } },
    { suffix: 'balanced-weapon', slot: 'weapon', rarity: 'uncommon', stats: { [power]: 2, maxHp: 10 } },
    { suffix: 'armor', slot: 'armor', rarity: 'uncommon', stats: { maxHp: 20, armor: 0.02 } },
    { suffix: 'rare-weapon', slot: 'weapon', rarity: 'rare', stats: { [power]: 6, maxHp: 15 } },
    { suffix: 'rare-armor', slot: 'armor', rarity: 'rare', stats: { maxHp: 40, armor: 0.04 } }
  ];
  return variants.map((variant, index) => ({
    ...variant,
    id: `${kitId.toLowerCase()}-${variant.suffix}`,
    name: names[index],
    className,
    type: 'equipment',
    price: variant.rarity === 'uncommon' ? 100 : 350
  }));
});

export function migrateEquipmentId(id) {
  return typeof id === 'string' ? id.replace(/^(gladiator|guardian)-/, 'paladin-') : id;
}
export const EQUIPMENT_BY_ID = Object.fromEntries(EQUIPMENT_ITEMS.map((item) => [item.id, item]));

// Supplies can be purchased now; delve drops can grant these same IDs later.
export const CRAFTING_MATERIALS = {
  iron: { id: 'iron', name: 'Iron Ingot', rarity: 'uncommon', price: 50, description: 'Used to forge weapons and heavy armor.' },
  leather: { id: 'leather', name: 'Cured Leather', rarity: 'uncommon', price: 50, description: 'Used for grips and light armor.' },
  cloth: { id: 'cloth', name: 'Runic Cloth', rarity: 'uncommon', price: 50, description: 'Used for focuses and spellcaster robes.' }
};

export const CRAFTING_RECIPES = EQUIPMENT_ITEMS.map((item) => {
  const role = CLASS_DEFINITIONS[item.className].role;
  const armorMaterial = role === 'Tank' ? 'iron' : role === 'Healer' || item.className.startsWith('Mage of') ? 'cloth' : 'leather';
  const material = item.slot === 'weapon' ? 'iron' : armorMaterial;
  return {
    id: item.id,
    itemId: item.id,
    materials: { [material]: item.rarity === 'rare' ? 4 : 2 },
    equipment: item.rarity === 'rare' ? item.id.replace('-rare-', '-') : null,
    gold: item.rarity === 'rare' ? 50 : 0
  };
});

export function sellPrice(item) {
  return (ITEM_RARITIES[item?.rarity]?.level ?? 0) * 50;
}

export function equipmentStatsText(stats) {
  const labels = { maxHp: 'HP', attackPower: 'Attack', healPower: 'Healing', armor: 'Armor' };
  return Object.entries(stats).map(([key, value]) =>
    key === 'armor' ? `+${Math.round(value * 100)}% Armor` : `+${value} ${labels[key] ?? key}`
  ).join('  /  ');
}

export function equipmentDetails(item) {
  return {
    title: item.name,
    description: `${ITEM_RARITIES[item.rarity].label} ${item.slot} | ${item.className}\n\n${equipmentStatsText(item.stats)}\n\n${item.slot === 'weapon' ? 'Attack and healing bonuses improve basic actions and the new grid class spells. Rogue, Barbarian, and Ranger ability powers remain unchanged.' : 'Armor adds percentage points of damage mitigation.'}\n\nSell value: ${sellPrice(item)} gold. Unequip before selling.`
  };
}
