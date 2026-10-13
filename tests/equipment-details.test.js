// Check catalog restrictions, owned enchantment bonuses and actual attribute conversions.
import assert from 'node:assert/strict';
import { CATALOG_ITEMS, getEquipmentDefinition, itemMinimumLevel } from '../data/items.js';
import { equipmentDetails } from '../game/EquipmentDescriptions.js';
import { canEquipItem, equipItem, grantEquipment, restoreEquipment } from '../game/Equipment.js';

const hero = { id: 'tank', className: 'Gladiator', level: 1, maxMana: 0, equipment: {} };
const state = { roster: [hero], inventory: { equipment: [], nextEquipmentId: 1 } };
const common = grantEquipment('BLS01', state);
const uncommon = grantEquipment('SLS01', state);
assert.ok(canEquipItem(hero, common));
assert.equal(canEquipItem(hero, uncommon), false);
assert.match(equipItem(hero.id, uncommon.id, state).message, /requires level 10/);
hero.level = 9;
assert.equal(canEquipItem(hero, uncommon), false);
hero.level = 10;
assert.ok(canEquipItem(hero, uncommon));
assert.ok(equipItem(hero.id, uncommon.id, state).ok);
assert.equal(canEquipItem({ ...hero, className: 'Ranger' }, uncommon), false);
for (const item of CATALOG_ITEMS) {
  if (item.rarity === 'common') assert.equal(itemMinimumLevel(item), 1);
  if (item.rarity === 'uncommon') assert.equal(itemMinimumLevel(item), 10);
}
assert.equal(itemMinimumLevel({ rarity: 'rare' }), Infinity);
assert.equal(itemMinimumLevel({ rarity: 'rare', minimumLevel: 20 }), 20);

const details = equipmentDetails(common, hero).description;
assert.ok(details.includes(getEquipmentDefinition(common.itemId).description));
assert.match(details, /Classes: Gladiator, Oathwarden/);
assert.match(details, /Minimum level: 1 \(Common\)/);
assert.match(details, /\+1 Strength \(\+0.05% Block, \+8 AP\)/);
assert.match(equipmentDetails({ ...common, stats: { strength: 50 } }, hero).description,
  /\+50 Strength \(\+2.5% Block, \+400 AP\)/);
assert.match(equipmentDetails({ ...common, stats: { constitution: 2 } }, hero).description,
  /\+2 Constitution \(\+20 Health, \+20 Armor\)/);
assert.match(equipmentDetails({ ...common, stats: { agility: 2 } }, { ...hero, className: 'Ranger' }).description,
  /\+12 AP/);
assert.match(equipmentDetails({ ...common, stats: { wisdom: 5 } }, { ...hero, className: 'Dawnwarden' }).description,
  /\+40 Spell Healing, \+25 Mana/);
assert.match(equipmentDetails({ ...common, stats: { strength: 6 }, enchantmentId: 'SCE001' }, hero).description,
  /\+6 Strength/);
const manaPack = { itemId: 'clarity-potion', slot: 'potion', rarity: 'common', charges: 3 };
assert.equal(canEquipItem(hero, manaPack), false);
assert.ok(canEquipItem({ ...hero, className: 'Dawnwarden', maxMana: 250 }, manaPack));
assert.match(equipmentDetails(manaPack).description, /Classes: Dawnwarden/);
assert.match(equipmentDetails(manaPack).description, /3\/3 uses/);

// A new level requirement removes only an invalid slot reference on load, keeping ownership.
hero.level = 1;
const saved = structuredClone(state.inventory);
saved.equipmentSchemaVersion = 2;
restoreEquipment(saved, new Map([[hero.id, { equipment: { weapon: uncommon.id } }]]), state);
assert.equal(hero.equipment.weapon, null);
assert.ok(state.inventory.equipment.some(item => item.id === uncommon.id));
