// Exercise the drop-to-sale-to-craft loop, including shop boundaries and old ownership.
import assert from 'node:assert/strict';
import { EQUIPMENT_ITEMS, CRAFTING_RECIPES, getEquipmentDefinition } from '../data/items.js';
import { grantEquipment, equipItem, restoreEquipment } from '../game/Equipment.js';
import { GEAR_STOCK, buyGear, saleRows, sellOwnedItem, sellAllOwnedItem } from '../game/ShopServices.js';
import { canCraft, craftItem } from '../game/Crafting.js';
import { equipmentLootPool } from '../game/EquipmentLoot.js';

const weapons = EQUIPMENT_ITEMS.filter(item => /^(Voidsteel|Voidgate|Aetherium)/.test(item.name));
assert.equal(weapons.length, 16);
const state = () => ({ gold: 100000, inventory: { equipment: [], materials: {}, knownRecipes: [], nextEquipmentId: 1 }, roster: [] });
for (const item of weapons) {
  assert.equal(item.minimumLevel, item.name.startsWith('Aetherium') ? 45 : 35);
  assert.equal(item.rarity, 'uncommon');
  assert.equal(GEAR_STOCK.some(entry => entry.id === item.id), false);
  assert.equal(buyGear(item.id, state()).ok, false);
  assert.ok(!item.description.includes('Mithril'));
  for (const source of ['wave', 'boss', 'everdeep']) {
    assert.equal(equipmentLootPool('pineshire-reach', source, 'slime-cave', 'uncommon').includes(item), false);
    assert.ok(equipmentLootPool('highmere-crags', source, 'future-highmere-delve', 'uncommon').includes(item));
  }
  const recipe = CRAFTING_RECIPES.find(entry => entry.output.itemId === item.id);
  assert.equal(recipe.knownAtStart, false);
  const s = state();
  s.inventory.materials = Object.fromEntries(Object.entries(recipe.ingredients).map(([id, count]) => [id, count * 2]));
  const drop = grantEquipment(item.id, s);
  assert.equal(canCraft(recipe.id, s).ok, false, 'Finding a drop does not teach its recipe.');
  assert.match(saleRows(s, 'Blacksmith')[0].description, /learns this recipe/);
  const before = s.gold;
  assert.equal(sellOwnedItem(drop.id, s, 'Blacksmith').ok, true);
  assert.equal(s.gold, before + item.sellPrice);
  assert.deepEqual(s.inventory.knownRecipes, [recipe.id]);
  assert.equal(sellOwnedItem(drop.id, s, 'Blacksmith').ok, false);
  assert.equal(craftItem(recipe.id, s).ok, true);
  assert.equal(s.gold, before + item.sellPrice - recipe.fee);
  assert.deepEqual(s.inventory.equipment[0].stats, item.stats);
  assert.equal(sellOwnedItem(s.inventory.equipment[0].id, s, 'Blacksmith').ok, true);
  assert.deepEqual(s.inventory.knownRecipes, [recipe.id], 'Repeat sales do not duplicate recipe knowledge.');
}

for (const shop of [null, 'Alchemist', 'Enchanter']) {
  const s = state();
  const drop = grantEquipment('VMA01', s);
  assert.equal(sellOwnedItem(drop.id, s, shop).ok, true);
  assert.deepEqual(s.inventory.knownRecipes, [], 'Only the Blacksmith learns from these sales.');
}
const bulk = state();
const copies = [grantEquipment('ALST01', bulk), grantEquipment('ALST01', bulk)];
assert.match(sellAllOwnedItem(copies[0].id, bulk, 'Blacksmith').message, /Blacksmith learned/);
assert.deepEqual(bulk.inventory.knownRecipes, ['RALST01']);
assert.equal(bulk.inventory.equipment.length, 0);

// An old low-level copy keeps its owned ID, but the corrected level gate removes its slot.
const old = state();
old.inventory.equipmentSchemaVersion = 2;
const oldSword = grantEquipment('VLS01', old);
old.roster.push({ id: 'test', name: 'Test', className: 'Gladiator', level: 7, equipment: { weapon: oldSword.id } });
restoreEquipment(structuredClone(old.inventory), new Map(old.roster.map(hero => [hero.id, structuredClone(hero)])), old);
assert.equal(old.inventory.equipment[0].id, oldSword.id);
assert.equal(old.roster[0].equipment.weapon, null);
assert.equal(equipItem('test', oldSword.id, old).ok, false);
for (const id of ['VMA01', 'AMA01']) assert.deepEqual(getEquipmentDefinition(id).usableBy, getEquipmentDefinition('STMA01').usableBy);
for (const id of ['VGST01', 'ALST01']) assert.deepEqual(getEquipmentDefinition(id).usableBy, getEquipmentDefinition('STST01').usableBy);
for (const id of ['VGBR01', 'ALBR01']) assert.deepEqual(getEquipmentDefinition(id).usableBy, ['Ranger']);
assert.ok(getEquipmentDefinition('VMA01').stats.spellPower > getEquipmentDefinition('STMA01').stats.spellPower);
assert.ok(getEquipmentDefinition('AMA01').stats.spellPower > getEquipmentDefinition('VMA01').stats.spellPower);
console.log('Highmere level tiers, class restrictions, region gates, sales, recipes, crafting and legacy ownership passed.');
