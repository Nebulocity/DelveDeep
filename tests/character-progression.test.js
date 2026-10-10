// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import adventurers from '../data/adventurers.js';
import GameState from '../game/GameState.js';
import { loadProfile, saveProfile } from '../game/GameStorage.js';
import { grantAdventurerLevels } from '../game/AdventurerProgression.js';
import { getEquippedAdventurer } from '../game/Equipment.js';
import assert from 'node:assert/strict';
import { progressionResources, progressionAttributes, armorReduction, cappedChance } from '../config/characterProgression.js';

const tank = progressionResources('Gladiator');
assert.equal(tank.maxHp, 500); assert.equal(tank.armor, 100); assert.equal(tank.dodge, 0.1); assert.equal(tank.block, 0);
assert.equal(progressionResources('Oathwarden').block, 0.05);
const dawn = progressionResources('Dawnwarden');
assert.equal(dawn.maxMana, 250); assert.equal(dawn.wisdom, 40); assert.equal(dawn.spellDamage, 150); assert.equal(dawn.spellHealing, 150);
assert.equal(progressionResources('Gladiator', 2).maxHp, 540);
assert.equal(progressionResources('Dawnwarden', 2).maxHp, 533);

assert.equal(progressionResources('Barbarian', 2).maxHp, 372);
assert.equal(progressionResources('Ranger', 2).maxHp, 367.5);
assert.equal(progressionResources('Mage of the Crimson Spire', 2).maxHp, 161);
assert.equal(progressionResources('Cleric of the Everbright', 2).maxHp, 268);
assert.equal(progressionResources('Mage of the Crimson Spire', 20).spellDamage, 804);
assert.equal(progressionResources('Cleric of the Everbright', 20).spellHealing, 804);
assert.equal(progressionResources('Ranger', 2).attackPower, 520);

assert.equal(progressionResources('Barbarian', 2).attackPower, 516);
assert.equal(progressionResources('Scoundrel', 2).attackPower, 525);
assert.equal(progressionAttributes('Gladiator', 2).intellect, 10.25);
assert.equal(progressionResources('Barbarian', 20).maxMana, 0);
assert.equal(progressionResources('Mage of the Crimson Spire', 2).maxMana, 530);
assert.equal(progressionResources('Dawnwarden', 2).maxMana, 270);
assert.equal(progressionResources('Ranger', 1, { agility: 2, constitution: 3 }).attackPower, 512);

assert.equal(progressionResources('Ranger', 1, { constitution: 3 }).maxHp, 380);
assert.equal(armorReduction(100), 0.2); assert.equal(armorReduction(400), 0.5);
assert.ok(armorReduction(100000) < 1);
console.log('Authored level-1 totals, archetype growth, fractional attributes and derived resources passed.');

// A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
// object; get/set read and write that same key.
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
loadProfile(adventurers);

// find returns the first matching entry, or undefined when none matches. Check for that
// missing result before using its fields.
const mage = GameState.roster.find(hero => hero.id === 'raistlin');
mage.xp = 17; mage.happiness = 65; mage.delvesCompleted = 3; mage.abilityRanks.arcflare = 2;
grantAdventurerLevels(mage, 19);
assert.equal(mage.maxHp, 359); assert.equal(mage.spellDamage, 804); assert.equal(mage.xp, 17);
const before = { level: mage.level, strength: mage.strength, intellect: mage.intellect, maxHp: mage.maxHp, mana: mage.maxMana, spellDamage: mage.spellDamage, spellHealing: mage.spellHealing };
saveProfile(); loadProfile(adventurers);
const restored = GameState.roster.find(hero => hero.id === 'raistlin');

assert.deepEqual({
  level: restored.level,
  strength: restored.strength,
  intellect: restored.intellect,
  maxHp: restored.maxHp,
  mana: restored.maxMana,
  spellDamage: restored.spellDamage,
  spellHealing: restored.spellHealing
}, before);
assert.equal(restored.happiness, 65); assert.equal(restored.delvesCompleted, 3); assert.equal(restored.abilityRanks.arcflare, 2); assert.equal(restored.xp, 17);
restored.equipment = { weapon: 'attribute-gear' };
GameState.inventory.equipment = [{ id: 'attribute-gear', slot: 'weapon', usableBy: [restored.className], stats: { intellect: 3, wisdom: 2, constitution: 1, spellDamage: 4 } }];
const equipped = getEquippedAdventurer(restored);
assert.equal(equipped.spellDamage, restored.spellDamage + 28);
assert.equal(equipped.spellHealing, restored.spellHealing + 16);

assert.equal(equipped.maxMana, restored.maxMana + 25);
assert.equal(equipped.maxHp, restored.maxHp + 10);
assert.equal(restored.spellDamage, before.spellDamage);
console.log('Live levels, save restoration, morale, ranks and attribute equipment preserve progression without double application.');

const grown = progressionResources('Oathwarden', 2);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
close(grown.dodge, 0.0504); close(grown.block, 0.05075); close(grown.critChance, 0.000625); close(grown.hitChance, 0.00025);
const itemChances = getEquippedAdventurer({ className: 'Gladiator', level: 1000, statProgressionVersion: 2, equipment: {} }, { inventory: { equipment: [] } });
close(itemChances.dodge, progressionResources('Gladiator', 1000).dodge);
close(itemChances.critChance, progressionResources('Gladiator', 1000).critChance);
assert.equal(cappedChance('dodge', 10), 0.3); assert.equal(cappedChance('block', 10), 0.35);

assert.equal(cappedChance('critChance', 10), 0.4); assert.equal(cappedChance('hitChance', 10), 0.2);
close(cappedChance('critChance', 0.29), 0.26);
console.log('Uniform Dodge growth, shared AGI/INT/WIS critical chance, hit/block gains and chance caps passed.');
