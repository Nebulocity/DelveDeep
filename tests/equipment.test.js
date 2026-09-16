import assert from 'node:assert/strict';
import { CLASS_DEFINITIONS } from '../data/classes.js';
import adventurers from '../data/adventurers.js';
import { EQUIPMENT_ITEMS, EQUIPMENT_BY_ID, ITEM_RARITIES, CRAFTING_RECIPES, sellPrice } from '../data/items.js';
import GameState from '../game/GameState.js';
import { loadProfile, saveProfile } from '../game/GameStorage.js';
import { buyEquipment, sellEquipment, equipItem, unequipItem, getEquippedAdventurer, buyMaterial, sellMaterial, craftEquipment, craftingRequirements } from '../game/Equipment.js';
import { grantAdventurerXp } from '../game/AdventurerProgression.js';
import { beginExpedition, fleeExpedition } from '../game/ExpeditionProgression.js';

const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
const key = 'delveDeep.profile.v2';

for (const className of Object.keys(CLASS_DEFINITIONS)) {
  const items = EQUIPMENT_ITEMS.filter((item) => item.className === className);
  assert.equal(items.length, 5);
  assert.equal(items.filter((item) => item.rarity === 'uncommon' && item.price === 100).length, 3);
  assert.equal(items.filter((item) => item.rarity === 'rare' && item.price === 350).length, 2);
  for (const rarity of ['uncommon', 'rare']) {
    assert.ok(items.some((item) => item.rarity === rarity && item.slot === 'weapon'));
    assert.ok(items.some((item) => item.rarity === rarity && item.slot === 'armor'));
  }
}
assert.equal(new Set(EQUIPMENT_ITEMS.map((item) => item.id)).size, EQUIPMENT_ITEMS.length);
for (const [rarity, definition] of Object.entries(ITEM_RARITIES)) assert.equal(sellPrice({ rarity }), definition.level * 50);
assert.equal(sellPrice({ rarity: 'epic' }), 150);
assert.equal(sellPrice({ rarity: 'legendary' }), 200);

// Legacy saves retain all progression and receive empty gear and materials.
storage.set(key, JSON.stringify({ gold: 2000, inventory: { healingTonic: 7, voidKeys: 2 }, roster: [{ id: 'sturm', level: 3, xp: 20 }] }));
loadProfile(adventurers);
assert.equal(GameState.gold, 2000);
assert.equal(GameState.inventory.healingTonic, 7);
assert.equal(GameState.inventory.voidKeys, 2);
assert.deepEqual(GameState.inventory.equipment, []);
assert.deepEqual(GameState.inventory.materials, {});
let sturm = GameState.roster.find((hero) => hero.id === 'sturm');
const baseHp = sturm.maxHp;
const baseAttack = sturm.attackPower;
assert.equal(sturm.level, 3);

// Copies have individual identities; ownership, slot replacement, and class
// restrictions apply before any mutations or gold exchange.
const first = buyEquipment('paladin-weapon');
const second = buyEquipment('paladin-weapon');
assert.notEqual(first.instance.id, second.instance.id);
assert.equal(GameState.gold, 1800);
assert.equal(equipItem('sturm', first.instance.id).ok, true);
assert.equal(equipItem('laurana', first.instance.id).ok, false);
assert.equal(equipItem('raistlin', second.instance.id).ok, false);
assert.equal(sellEquipment(first.instance.id).ok, false);
assert.equal(equipItem('sturm', second.instance.id).ok, true);
assert.equal(sellEquipment(first.instance.id).ok, true);
assert.equal(sellEquipment(first.instance.id).ok, false);
assert.equal(GameState.gold, 1850);
const armor = buyEquipment('paladin-rare-armor');
assert.equal(equipItem('sturm', armor.instance.id).ok, true);
assert.equal(getEquippedAdventurer(sturm).maxHp, baseHp + 40);
assert.equal(getEquippedAdventurer(sturm).attackPower, baseAttack + 3);
assert.equal(sturm.maxHp, baseHp);
assert.equal(sturm.attackPower, baseAttack);

// Reloading and leveling never compound gear bonuses into base stats.
saveProfile();
loadProfile(adventurers);
sturm = GameState.roster.find((hero) => hero.id === 'sturm');
assert.equal(getEquippedAdventurer(sturm).maxHp, baseHp + 40);
grantAdventurerXp(sturm, 200);
assert.equal(getEquippedAdventurer(sturm).maxHp, baseHp + 46);
saveProfile(); loadProfile(adventurers);
sturm = GameState.roster.find((hero) => hero.id === 'sturm');
assert.equal(getEquippedAdventurer(sturm).maxHp, baseHp + 46);
assert.equal(unequipItem('sturm', 'armor').ok, true);
assert.equal(getEquippedAdventurer(sturm).maxHp, baseHp + 6);

// Insufficient funds cannot create items or spend gold.
GameState.gold = 99;
const before = JSON.stringify(GameState.inventory);
assert.equal(buyEquipment('paladin-weapon').ok, false);
assert.equal(buyEquipment('missing').ok, false);
assert.equal(GameState.gold, 99);
assert.equal(JSON.stringify(GameState.inventory), before);

// Craft every recipe from its exact ingredients; no negative stock, no
// equipped ingredient consumption, and no free repeat crafts.
for (const recipe of CRAFTING_RECIPES) {
  const state = { gold: recipe.gold, roster: [], inventory: { equipment: [], materials: { ...recipe.materials } } };
  if (recipe.equipment) state.inventory.equipment.push({ id: 'ingredient', itemId: recipe.equipment });
  assert.equal(craftingRequirements(recipe, state).canCraft, true);
  const result = craftEquipment(recipe.id, state);
  assert.equal(result.ok, true);
  assert.equal(state.gold, 0);
  assert.equal(state.inventory.equipment.length, 1);
  assert.equal(state.inventory.equipment[0].itemId, recipe.itemId);
  assert.ok(Object.values(state.inventory.materials).every((count) => count === 0));
  const snapshot = JSON.stringify(state);
  assert.equal(craftEquipment(recipe.id, state).ok, false);
  assert.equal(JSON.stringify(state), snapshot);
}
GameState.gold = 500;
GameState.inventory.materials = { iron: 4 };
const snapshot = JSON.stringify(GameState);
assert.equal(craftEquipment('paladin-rare-weapon').ok, false); // Sturm wears the only eligible copy.
assert.equal(JSON.stringify(GameState), snapshot);
unequipItem('sturm', 'weapon');
assert.equal(craftEquipment('paladin-rare-weapon').ok, true);
assert.equal(GameState.gold, 450);
assert.equal(buyMaterial('cloth').ok, true);
assert.equal(GameState.inventory.materials.cloth, 1);
assert.equal(sellMaterial('cloth').ok, true);
assert.equal(GameState.gold, 450);
assert.equal(sellMaterial('cloth').ok, false);

// Retreat snapshots isolate nested material and equipment inventories.
beginExpedition();
GameState.inventory.materials.iron = 99;
GameState.inventory.equipment.push({ id: 'temporary', itemId: 'rogue-weapon' });
fleeExpedition();
assert.equal(GameState.inventory.materials.iron, 0);
assert.equal(GameState.inventory.equipment.some((entry) => entry.id === 'temporary'), false);
buyMaterial('leather');
saveProfile();
const persistedInventory = JSON.stringify(GameState.inventory);
const persistedGold = GameState.gold;
loadProfile(adventurers);
assert.equal(JSON.stringify(GameState.inventory), persistedInventory);
assert.equal(GameState.gold, persistedGold);

// Invalid saves cannot equip wrong classes, duplicate a physical item, or
// restore references to nonexistent items.
const invalid = {
  inventory: { equipment: [
    { id: 'one', itemId: 'paladin-weapon' }, { id: 'one', itemId: 'paladin-weapon' },
    { id: 'two', itemId: 'wizard-armor' }, { id: 'bad', itemId: 'missing' }, null
  ], materials: { iron: -2, cloth: 3, leather: '4' } },
  roster: [
    { id: 'sturm', equipment: { weapon: 'one', armor: 'two' } },
    { id: 'laurana', equipment: { weapon: 'one', armor: 'missing' } }
  ]
};
storage.set(key, JSON.stringify(invalid)); loadProfile(adventurers);
assert.equal(GameState.inventory.equipment.length, 2);
assert.deepEqual(GameState.inventory.materials, { cloth: 3 });
assert.equal(GameState.roster.find((hero) => hero.id === 'sturm').equipment.armor, null);
assert.equal(GameState.roster.filter((hero) => hero.equipment.weapon === 'one').length, 1);
console.log('Equipment: catalog, economy, crafting, ownership, stats, persistence, and retreat passed.');
