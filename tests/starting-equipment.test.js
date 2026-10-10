// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import adventurers from '../data/adventurers.js';
import { STARTING_EQUIPMENT } from '../data/startingEquipment.js';
import GameState from '../game/GameState.js';
import { loadProfile, saveProfile } from '../game/GameStorage.js';
import { equippedItem, getEquippedAdventurer, unequipItem } from '../game/Equipment.js';
import { grantStartingEquipment } from '../game/StartingEquipment.js';

import { sellOwnedItem } from '../game/ShopServices.js';
import { PROFILE_STORAGE_KEY } from '../game/BuildSave.js';
import { getEquipmentDefinition } from '../data/items.js';
import { ATTRIBUTE_STATS } from '../config/characterProgression.js';

// A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
// object; get/set read and write that same key.
const storage = new Map();
globalThis.localStorage = {

  // We work out item here so callers can use the result. Keep the calculation together
  // with the checks below that decide which inputs are usable.
  getItem: (key) => storage.get(key) ?? null,

  // We bring item up to date here. The assignments below are the new values other code
  // will read after this step.
  setItem: (key, value) => storage.set(key, value)
};

loadProfile(adventurers);
assert.equal(GameState.inventory.equipment.length, adventurers.length * 2);

// A Set keeps each value once. has checks membership without searching a list for
// duplicate entries.
assert.equal(new Set(GameState.inventory.equipment.map((item) => item.id)).size, adventurers.length * 2);
assert.equal(GameState.gold, 0);
for (const hero of GameState.roster) {
  const loadout = STARTING_EQUIPMENT[hero.className];
  assert.ok(loadout);

  // Object.entries turns own fields into [key, value] pairs so we can visit or transform
  // them.
  for (const [slot, itemId] of Object.entries(loadout)) {
    const item = equippedItem(hero, slot);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    assert.equal(item?.itemId, itemId);
    assert.deepEqual(item.stats, getEquipmentDefinition(itemId).stats);
  }

  // Attribute gear also changes derived resources. For example, Constitution adds
  // 10 HP per point in addition to an item's direct HP bonus; checking only the
  // printed maxHp bonus would miss those gains and incorrectly fail current gear.
  const bonuses = {};
  for (const slot of Object.keys(loadout)) {
    for (const [stat, bonus] of Object.entries(equippedItem(hero, slot).stats)) bonuses[stat] = (bonuses[stat] ?? 0) + bonus;
  }
  const geared = getEquippedAdventurer(hero);
  for (const stat of ATTRIBUTE_STATS) assert.equal(geared[stat], hero[stat] + (bonuses[stat] ?? 0));
  assert.equal(geared.maxHp, hero.maxHp + (bonuses.maxHp ?? 0) + (bonuses.constitution ?? 0) * 10);
  assert.equal(geared.attackPower, hero.attackPower + (bonuses.attackPower ?? 0) + (bonuses.strength ?? 0) * 8
    + (['Ranger', 'Scoundrel'].includes(hero.className) ? (bonuses.agility ?? 0) * 6 : 0));

  assert.equal(hero.equipment.accessory, null);
  assert.equal(hero.equipment.potion, null);
}

grantStartingEquipment(new Map());
assert.equal(GameState.inventory.equipment.length, adventurers.length * 2);
saveProfile();
const freshInventory = JSON.parse(JSON.stringify(GameState.inventory));
loadProfile(adventurers);
assert.deepEqual(JSON.parse(JSON.stringify(GameState.inventory)), freshInventory);

// Saved choices stay empty after unequipping or selling starting gear.
const hero = GameState.roster.find((entry) => entry.id === 'caramon-gladiator');
const weaponId = hero.equipment.weapon;
assert.equal(unequipItem(hero.id, 'weapon').ok, true);
assert.equal(sellOwnedItem(weaponId).ok, true);
assert.equal(unequipItem(hero.id, 'armor').ok, true);
saveProfile();
const afterSale = JSON.parse(JSON.stringify(GameState.inventory));

loadProfile(adventurers);
assert.deepEqual(JSON.parse(JSON.stringify(GameState.inventory)), afterSale);

// find returns the first matching entry, or undefined when none matches. Check for that
// missing result before using its fields.
assert.equal(GameState.roster.find((entry) => entry.id === hero.id).equipment.weapon, null);
assert.equal(GameState.roster.find((entry) => entry.id === hero.id).equipment.armor, null);

// Older profiles keep enchanted gear, consumables, inventory, and progression.
storage.set(PROFILE_STORAGE_KEY, JSON.stringify({
  gold: 321,
  inventory: {
    equipmentSchemaVersion: 1, nextEquipmentId: 1, materials: { iron: 7 },
    equipment: [
      { id: 'gear-1', itemId: 'field-blade', name: 'Field Blade', slot: 'weapon', usableBy: ['Gladiator'], stats: { attackPower: 3 }, enchantmentId: 'minor-might' },
      { id: 'gear-2', itemId: 'mending-potion', name: 'Health Potion', slot: 'potion', charges: 2, stats: {} }
    ]
  },

  roster: [{ id: hero.id, level: 4, xp: 12, happiness: 65, equipment: { weapon: 'gear-1', potion: 'gear-2' } }]
}));

loadProfile(adventurers);
const migrated = GameState.roster.find((entry) => entry.id === hero.id);
assert.equal(migrated.equipment.weapon, 'gear-1');
assert.equal(migrated.equipment.potion, 'gear-2');
assert.equal(equippedItem(migrated, 'weapon').stats.attackPower, getEquipmentDefinition('BLS01').stats.attackPower);
assert.equal(equippedItem(migrated, 'weapon').stats.strength, getEquipmentDefinition('BLS01').stats.strength + 5);
assert.equal(equippedItem(migrated, 'weapon').enchantmentId, 'SCE001');
assert.equal(equippedItem(migrated, 'armor').itemId, 'PV01');

assert.equal(migrated.level, 4);
assert.equal(migrated.xp, 12);
assert.equal(migrated.happiness, 65);
assert.equal(GameState.gold, 321);
assert.deepEqual(GameState.inventory.materials, { MAT002: 7 });
assert.equal(GameState.inventory.equipment.length, adventurers.length * 2 + 1);
assert.equal(new Set(GameState.inventory.equipment.map((item) => item.id)).size, GameState.inventory.equipment.length);

saveProfile();
const migratedInventory = JSON.parse(JSON.stringify(GameState.inventory));
loadProfile(adventurers);
assert.deepEqual(JSON.parse(JSON.stringify(GameState.inventory)), migratedInventory);

// A newly added adventurer receives gear even when the existing roster was initialized.
saveProfile();

// ... expands these entries into the new list or call. It does not deep-copy the objects
// inside.
loadProfile([...adventurers, { ...adventurers[0], id: 'new-mage' }]);
assert.equal(GameState.inventory.equipment.length, migratedInventory.equipment.length + 2);
assert.equal(equippedItem(GameState.roster.at(-1), 'weapon').itemId, 'PST01');
console.log('Starting gear, compatible stats, migration, unique ownership, and one-time grants passed.');
