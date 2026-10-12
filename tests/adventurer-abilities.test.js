// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import GameState from '../game/GameState.js';
import adventurers from '../data/adventurers.js';
import { loadProfile, saveProfile } from '../game/GameStorage.js';
import { battleAbilities, purchaseAdventurerAbility, toggleAdventurerAbility } from '../game/AdventurerAbilities.js';

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

// find returns the first matching entry, or undefined when none matches. Check for that
// missing result before using its fields.
const caramon = GameState.roster.find((hero) => hero.id === 'caramon-gladiator');
assert.deepEqual(caramon.abilityLoadout, ['ability_v2_gladiator_defiant_roar', 'ability_v2_gladiator_offensive_drill', 'ability_v2_generic_physical_interpose']);
assert.deepEqual(Object.keys(battleAbilities(caramon)), ['ability_v2_gladiator_defiant_roar', 'ability_v2_gladiator_offensive_drill', 'ability_v2_generic_physical_interpose']);
assert.equal(caramon.skillPoints, 1);
assert.equal(purchaseAdventurerAbility(caramon.id, 'ability_v2_gladiator_offensive_drill').ok, false);
caramon.level = 5;
caramon.skillPoints = 5;

GameState.gold = 500;
assert.equal(purchaseAdventurerAbility(caramon.id, 'ability_v2_gladiator_offensive_drill').ok, true);
assert.equal(caramon.abilityLoadout.includes('ability_v2_gladiator_offensive_drill'), true);
assert.equal(purchaseAdventurerAbility(caramon.id, 'ability_v2_gladiator_brutal_thrust').ok, true);
assert.ok(Math.abs(battleAbilities(caramon).ability_v2_gladiator_offensive_drill.power - 102.6) < 1e-9);
assert.equal(battleAbilities(caramon).ability_v2_gladiator_offensive_drill.cooldown, 9800);
assert.equal(caramon.skillPoints, 2);

assert.equal(toggleAdventurerAbility(caramon.id, 'ability_v2_gladiator_brutal_thrust').ok, true);
assert.equal(battleAbilities(caramon).ability_v2_gladiator_brutal_thrust, undefined);
assert.equal(toggleAdventurerAbility(caramon.id, 'ability_v2_gladiator_brutal_thrust').ok, true);
saveProfile();
loadProfile(adventurers);
const restored = GameState.roster.find((hero) => hero.id === caramon.id);
assert.equal(restored.abilityRanks.ability_v2_gladiator_offensive_drill, 2);

assert.equal(restored.abilityLoadout.includes('ability_v2_gladiator_brutal_thrust'), true);
assert.equal(restored.skillPoints, 2);

storage.clear();
storage.set('delveDeep.profile.v2', JSON.stringify({ roster: [{ id: caramon.id, level: 3 }] }));
loadProfile(adventurers);
const legacy = GameState.roster.find((hero) => hero.id === caramon.id);
assert.deepEqual(Object.keys(legacy.abilityRanks), ['ability_v2_gladiator_defiant_roar', 'ability_v2_gladiator_offensive_drill', 'ability_v2_generic_physical_interpose']);
assert.deepEqual(Object.keys(battleAbilities(legacy)), ['ability_v2_gladiator_defiant_roar', 'ability_v2_gladiator_offensive_drill', 'ability_v2_generic_physical_interpose']);

// Hall interaction and layout checks run against Phaser in tests/visual/hall.spec.js.
console.log('Adventurer ability unlocks, ranks, loadout, combat values, and legacy saves passed.');
