import assert from 'node:assert/strict';
import adventurers from '../data/adventurers.js';
import GameState from '../game/GameState.js';
import { loadProfile, saveProfile } from '../game/GameStorage.js';
import { EQUIPMENT_SLOTS, ownedEquipment, equipmentOwner, equippedItem, equipItem, unequipItem, getEquippedAdventurer, grantEquipment, grantMaterial } from '../game/Equipment.js';
import { EQUIPMENT_ITEMS, CRAFTING_MATERIALS, ITEM_RARITIES } from '../data/items.js';
import { CLASS_DEFINITIONS } from '../data/classes.js';

const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
const key = 'delveDeep.profile.v2';

storage.set(key, JSON.stringify({
  gold: 2000,
  inventory: { healingTonic: 7, voidKeys: 2, materials: { iron: 4 }, equipment: [{ id: 'old', itemId: 'oathwarden-weapon' }] },
  roster: [{ id: 'sturm', level: 3, xp: 20, equipment: { weapon: 'old' } }]
}));
loadProfile(adventurers);
const sturm = GameState.roster.find((hero) => hero.id === 'sturm');
assert.equal(GameState.gold, 2000);
assert.equal(sturm.level, 3);
assert.equal(sturm.xp, 20);
assert.deepEqual(EQUIPMENT_SLOTS, ['weapon', 'armor', 'accessory', 'potion']);
assert.deepEqual(ownedEquipment(), []);
assert.deepEqual(sturm.equipment, { weapon: null, armor: null, accessory: null, potion: null });
assert.deepEqual(Object.keys(GameState.inventory).sort(), ['equipment', 'equipmentSchemaVersion', 'materials', 'nextEquipmentId']);
assert.deepEqual(GameState.inventory.materials, {});
assert.deepEqual(Object.keys(ITEM_RARITIES), ['common', 'uncommon', 'rare', 'epic', 'legendary']);
assert.equal(new Set(EQUIPMENT_ITEMS.map((item) => item.id)).size, EQUIPMENT_ITEMS.length);
for (const className of Object.keys(CLASS_DEFINITIONS)) {
  for (const slot of ['weapon', 'armor']) {
    assert.ok(EQUIPMENT_ITEMS.some((item) => item.slot === slot && item.usableBy.includes(className)), `${className} lacks ${slot}`);
  }
}
assert.deepEqual(Object.keys(CRAFTING_MATERIALS), ['iron', 'leather', 'cloth', 'herb', 'essence']);

const baseAttack = sturm.attackPower;
const baseHp = sturm.maxHp;
const items = [
  { id: 'future-weapon', name: 'Future Weapon', slot: 'weapon', className: sturm.className, stats: { attackPower: 3 } },
  { id: 'future-armor', name: 'Future Armor', slot: 'armor', className: sturm.className, stats: { maxHp: 20 } },
  { id: 'future-accessory', name: 'Future Accessory', slot: 'accessory', className: sturm.className, stats: { maxHp: 5, attackPower: 2 } },
  { id: 'future-potion', name: 'Future Health Potion', slot: 'potion', charges: 3, stats: { maxHp: 100 } }
];
GameState.inventory.equipment.push(...items);
for (const item of items) assert.equal(equipItem(sturm.id, item.id).ok, true);
assert.equal(equippedItem(sturm, 'accessory')?.name, 'Future Accessory');
assert.equal(equipmentOwner('future-accessory')?.id, sturm.id);
assert.equal(equippedItem(sturm, 'potion')?.charges, 3);
assert.equal(getEquippedAdventurer(sturm).attackPower, baseAttack + 5);
assert.equal(getEquippedAdventurer(sturm).maxHp, baseHp + 25);
assert.equal(sturm.attackPower, baseAttack);
assert.equal(sturm.maxHp, baseHp);
assert.equal(equipItem('raistlin', 'future-accessory').ok, false);

saveProfile();
loadProfile(adventurers);
const restored = GameState.roster.find((hero) => hero.id === 'sturm');
assert.equal(restored.equipment.accessory, 'future-accessory');
assert.equal(restored.equipment.potion, 'future-potion');
assert.equal(equippedItem(restored, 'potion')?.charges, 3);
assert.equal(getEquippedAdventurer(restored).maxHp, baseHp + 25);
assert.equal(unequipItem(restored.id, 'accessory').ok, true);
assert.equal(equippedItem(restored, 'accessory'), null);
assert.equal(getEquippedAdventurer(restored).maxHp, baseHp + 20);
assert.equal(unequipItem(restored.id, 'potion').ok, true);

const blade = grantEquipment('field-blade');
assert.equal(blade.itemId, 'field-blade');
assert.equal(blade.rarity, 'common');
assert.equal(equipItem(restored.id, blade.id).ok, true);
assert.equal(grantEquipment('missing'), null);
assert.equal(grantMaterial('iron', 3), true);
assert.equal(grantMaterial('missing', 1), false);
assert.equal(grantMaterial('iron', -1), false);
saveProfile();
loadProfile(adventurers);
assert.equal(GameState.roster.find((hero) => hero.id === 'sturm').equipment.weapon, blade.id);
assert.equal(equippedItem(GameState.roster.find((hero) => hero.id === 'sturm'), 'weapon').itemId, 'field-blade');
assert.equal(GameState.inventory.materials.iron, 3);
assert.notEqual(grantEquipment('field-blade').id, blade.id);

GameState.inventory.materials = { iron: 3, herb: 2, unknown: 9, cloth: -1 };
saveProfile();
loadProfile(adventurers);
assert.deepEqual(GameState.inventory.materials, { iron: 3, herb: 2 });

storage.set(key, JSON.stringify({
  inventory: { equipmentSchemaVersion: 1, equipment: [
    { ...items[2], id: 'shared' }, { ...items[2], id: 'shared' },
    { ...items[2], id: 'wrong-slot', slot: 'trinket' }
  ] },
  roster: [
    { id: 'sturm', equipment: { accessory: 'shared' } },
    { id: 'laurana', equipment: { accessory: 'shared' } }
  ]
}));
loadProfile(adventurers);
assert.equal(GameState.inventory.equipment.length, 1);
assert.equal(GameState.roster.find((hero) => hero.id === 'sturm').equipment.accessory, 'shared');
assert.equal(GameState.roster.find((hero) => hero.id === 'laurana').equipment.accessory, null);
console.log('Equipment: item reset, four slots, potion packs, ownership, stats, and persistence passed.');
