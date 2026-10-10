// Shop checks use the current catalog, prices and recipe materials. We verify actual
// resource changes, ownership guards and save round trips instead of retired item data.

import assert from 'node:assert/strict';
import { grantEquipment, grantPotionPack, grantEnchantmentScroll, restoreEquipment, getEquippedAdventurer } from '../game/Equipment.js';
import { buyGear, saleRows, sellOwnedItem, sellAllOwnedItem, inscribeEnchantment, applyEnchantment, disenchantItem } from '../game/ShopServices.js';
import { ENCHANTMENTS, ENCHANTMENT_BY_ID } from '../data/enchantments.js';
import { CRAFTING_MATERIALS, CRAFTING_RECIPES, ENCHANTMENT_ITEMS, getEquipmentDefinition, getPotionDefinition } from '../data/items.js';
import { rebuildCharacterStats } from '../game/CharacterStats.js';

const scrollRecipes = CRAFTING_RECIPES.filter(recipe => recipe.output.type === 'scroll');
const state = () => ({ gold: 5000, inventory: { equipment: [],
  materials: Object.fromEntries(Object.keys(CRAFTING_MATERIALS).map(id => [id, 20])),
  knownRecipes: scrollRecipes.map(recipe => recipe.id), nextEquipmentId: 1 }, roster: [] });
assert.deepEqual(ENCHANTMENTS.map(entry => entry.id), ENCHANTMENT_ITEMS.map(entry => entry.id));
assert.equal(ENCHANTMENT_BY_ID['minor-might'], undefined);
let s = state();
const bow = getEquipmentDefinition('PBR01');
assert.equal(buyGear(bow.id, s).ok, true);
assert.equal(s.gold, 5000 - bow.price);
assert.equal(sellOwnedItem(s.inventory.equipment[0].id, s).ok, true);
assert.equal(s.gold, 5000 - bow.price + bow.sellPrice);
assert.equal(saleRows(s).some(row => row.name === bow.name), false);

// A used potion pack sells for its remaining fraction of the half-price full pack.
const potionDefinition = getPotionDefinition('mending-potion');
const potion = grantPotionPack(potionDefinition.id, s);
potion.charges = 1;
const beforePotion = s.gold;
assert.equal(sellOwnedItem(potion.id, s).ok, true);
assert.equal(s.gold, beforePotion + Math.floor(potionDefinition.price / 2 / potionDefinition.uses));
const beforeMaterial = s.gold;
assert.equal(sellOwnedItem('MAT002', s).ok, true);
assert.equal(s.gold, beforeMaterial + CRAFTING_MATERIALS.MAT002.sellPrice);
assert.equal(s.inventory.materials.MAT002, 19);

// Bulk sales quote and pay the whole stack, then reject a second sale of that stack.
assert.equal(saleRows(s).find(row => row.id === 'MAT002').allValue, 19 * CRAFTING_MATERIALS.MAT002.sellPrice);
const beforeStack = s.gold;
assert.equal(sellAllOwnedItem('MAT002', s).ok, true);
assert.equal(s.gold, beforeStack + 19 * CRAFTING_MATERIALS.MAT002.sellPrice);
assert.equal(s.inventory.materials.MAT002, undefined);
assert.equal(sellAllOwnedItem('MAT002', s).ok, false);

// Selling duplicate gear keeps equipped copies, other catalog items, and differently
// enchanted versions. A stale card must not pay again after its owned copy is gone.
s = state();
const duplicates = [grantEquipment('PBR01', s), grantEquipment('PBR01', s)];
const equippedBow = grantEquipment('PBR01', s);
const enchantedBow = grantEquipment('PBR01', s);
enchantedBow.enchantmentId = 'SCE001';
const otherGear = grantEquipment('PV01', s);
s.roster = [{ name: 'Hero', equipment: { weapon: equippedBow.id } }];
assert.equal(saleRows(s).find(row => row.id === duplicates[0].id).allValue, 2 * bow.sellPrice);
assert.equal(sellAllOwnedItem(equippedBow.id, s).ok, false);
assert.equal(sellAllOwnedItem(duplicates[0].id, s).ok, true);
assert.equal(s.gold, 5000 + 2 * bow.sellPrice);
assert.deepEqual(s.inventory.equipment.map(item => item.id), [equippedBow.id, enchantedBow.id, otherGear.id]);
assert.equal(sellAllOwnedItem(duplicates[0].id, s).ok, false);

// Partial packs contribute their individually rounded remaining-charge prices. Scroll
// bulk selling likewise removes only copies of the selected enchantment scroll.
s = state();
const fullPack = grantPotionPack(potionDefinition.id, s);
const partialPack = grantPotionPack(potionDefinition.id, s);
partialPack.charges = 1;
const equippedPack = grantPotionPack(potionDefinition.id, s);
s.roster = [{ equipment: { potion: equippedPack.id } }];
const packTotal = Math.floor(potionDefinition.price / 2)
  + Math.floor(potionDefinition.price / 2 / potionDefinition.uses);
assert.equal(saleRows(s).find(row => row.id === fullPack.id).allValue, packTotal);
assert.equal(sellAllOwnedItem(fullPack.id, s).ok, true);
assert.equal(s.gold, 5000 + packTotal);
assert.deepEqual(s.inventory.equipment.map(item => item.id), [equippedPack.id]);
const firstScroll = grantEnchantmentScroll('SCE001', s);
grantEnchantmentScroll('SCE001', s);
const differentScroll = grantEnchantmentScroll('SCE002', s);
const scrollTotal = 2 * Math.floor(ENCHANTMENT_BY_ID.SCE001.price * 0.3);
assert.equal(saleRows(s).find(row => row.id === firstScroll.id).allValue, scrollTotal);
assert.equal(sellAllOwnedItem(firstScroll.id, s).ok, true);
assert.equal(s.gold, 5000 + packTotal + scrollTotal);
assert.deepEqual(s.inventory.equipment.map(item => item.id), [equippedPack.id, differentScroll.id]);

for (const definition of ENCHANTMENTS) {
  s = state();
  const gear = grantEquipment('PV01', s);
  const original = { ...gear.stats };
  const materialsBefore = { ...s.inventory.materials };
  const scroll = inscribeEnchantment(definition.id, s).instance;
  assert.ok(scroll);
  assert.equal(s.gold, 5000 - definition.craftingFee);
  for (const [id, count] of Object.entries(definition.ingredients)) {
    assert.equal(s.inventory.materials[id], materialsBefore[id] - count);
  }

  // Saving and loading preserves owned IDs. Applying consumes exactly one scroll, and
  // restoring the enchanted item reconstructs current bonuses once, even on a second load.
  const saved = structuredClone(s.inventory);
  saved.equipmentSchemaVersion = 2;
  restoreEquipment(saved, new Map(), s);
  assert.equal(s.inventory.equipment.find(item => item.id === scroll.id).enchantmentId, definition.id);
  assert.equal(applyEnchantment(scroll.id, gear.id, s).ok, true);
  assert.equal(applyEnchantment(scroll.id, gear.id, s).ok, false);
  const enchanted = s.inventory.equipment.find(item => item.id === gear.id);
  for (const [stat, amount] of Object.entries(definition.stats)) {
    assert.equal(enchanted.stats[stat], (original[stat] ?? 0) + amount);
  }
  const inventory = structuredClone(s.inventory);
  restoreEquipment(inventory, new Map(), s);
  restoreEquipment(structuredClone(s.inventory), new Map(), s);
  assert.deepEqual(s.inventory.equipment.find(item => item.id === gear.id).stats, enchanted.stats);

  // The refund is half the recipe's material pieces, chosen without replacement.
  // Removing the enchantment restores the catalog's original gear bonuses exactly.
  const result = disenchantItem(gear.id, s, () => 0.99);
  assert.equal(result.ok, true);
  const ingredientCount = Object.values(definition.ingredients).reduce((sum, count) => sum + count, 0);
  assert.equal(Object.values(result.refunds).reduce((sum, count) => sum + count, 0), Math.floor(ingredientCount / 2));
  assert.ok(Object.keys(result.refunds).every(id => Object.hasOwn(definition.ingredients, id)));
  assert.deepEqual(s.inventory.equipment.find(item => item.id === gear.id).stats, original);
  assert.equal(disenchantItem(gear.id, s).ok, false);
}

s = state();
const gear = grantEquipment('BLS01', s);
s.roster = [rebuildCharacterStats({ id: 'hero', name: 'Hero', className: 'Gladiator', level: 1, equipment: { weapon: gear.id } })];
assert.equal(sellOwnedItem(gear.id, s).ok, false);
assert.equal(saleRows(s).find(row => row.id === gear.id).enabled, false);
const beforePower = getEquippedAdventurer(s.roster[0], s).attackPower;
const scroll = inscribeEnchantment('SCE001', s, true).instance;
assert.equal(s.gold, 5000 - ENCHANTMENT_BY_ID.SCE001.price);
assert.equal(applyEnchantment(scroll.id, gear.id, s).ok, true);
assert.equal(getEquippedAdventurer(s.roster[0], s).attackPower, beforePower + 40);

// Buying a current scroll teaches its inscription recipe. A full material purse alone
// must not unlock an unknown recipe or allow an unaffordable purchase.
s = state();
s.inventory.knownRecipes = [];
assert.equal(inscribeEnchantment('SCE002', s).ok, false);
assert.equal(inscribeEnchantment('SCE002', s, true).ok, true);
assert.ok(s.inventory.knownRecipes.includes(scrollRecipes.find(recipe => recipe.output.itemId === 'SCE002').id));
assert.equal(inscribeEnchantment('SCE002', s).ok, true);
s.gold = 0;
const before = structuredClone(s);
assert.equal(buyGear('PBR01', s).ok, false);
assert.equal(inscribeEnchantment('SCE002', s, true).ok, false);
s.inventory.materials = {};
assert.equal(inscribeEnchantment('SCE002', s).ok, false);
assert.deepEqual(s.inventory.equipment, before.inventory.equipment);
assert.equal(buyGear('trail-bow', state()).ok, false);
assert.equal(grantEquipment('field-blade', state()), null);
assert.equal(inscribeEnchantment('minor-might', state(), true).ok, false);
console.log('Current shop catalog, sales, recipe discovery, enchantments, refunds and repeat save restoration passed.');
