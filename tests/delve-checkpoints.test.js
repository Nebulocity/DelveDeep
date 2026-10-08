// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import { delveDropNames, delveMaterialIds } from '../game/DelveDrops.js';
import delves from '../data/delves.js';
import { getDelveById } from '../data/delves.js';
import { CRAFTING_MATERIALS } from '../data/items.js';
import assert from 'node:assert/strict';
import GameState from '../game/GameState.js';
import { awardOrdinaryWave, getDelveCheckpoint, WAVE_REWARDS, FARM_REWARDS } from '../game/DelveCheckpoints.js';
import { loadProfile } from '../game/GameStorage.js';
import { PROFILE_STORAGE_KEY } from '../game/BuildSave.js';

// A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
// object; get/set read and write that same key.
const saved = new Map();
globalThis.localStorage = {

  // We work out item here so callers can use the result. Keep the calculation together
  // with the checks below that decide which inputs are usable.
  getItem: (key) => saved.get(key) ?? null,

  // We bring item up to date here. The assignments below are the new values other code
  // will read after this step.
  setItem: (key, value) => saved.set(key, value)
};

const delve = getDelveById('slime-cave');
const hero = { id: 'hero', name: 'Hero', level: 1, xp: 0, happiness: 70, maxHp: 100, attackPower: 10 };
GameState.world.clearedDelves = [];
GameState.delveCheckpoints = {};
GameState.inventory.materials = {};

// ... copies the source's own fields into this object; fields listed later replace earlier
// ones. This is a shallow copy, so nested objects are still shared.
GameState.roster = [{ ...hero }];
GameState.activeParty = [{ ...hero }];
GameState.gold = 0;

assert.deepEqual(getDelveCheckpoint(delve, 5), { nextWave: 0, campUnlocked: false });
const first = awardOrdinaryWave(delve, 0, 5);
assert.equal(first.gold, WAVE_REWARDS.Easy.gold);
assert.equal(GameState.gold, first.gold);
assert.equal(GameState.roster[0].xp, first.xp);
assert.equal(GameState.inventory.materials[first.materialId], 1);
assert.equal(awardOrdinaryWave(delve, 0, 5), null);

assert.equal(awardOrdinaryWave(delve, 2, 5), null);
assert.equal(GameState.gold, first.gold);
assert.deepEqual(getDelveCheckpoint(delve, 5), { nextWave: 1, campUnlocked: false });

loadProfile([hero]);
assert.deepEqual(getDelveCheckpoint(delve, 5), { nextWave: 1, campUnlocked: false });
assert.equal(GameState.gold, first.gold);
for (let index = 1; index < 5; index += 1) assert.ok(awardOrdinaryWave(delve, index, 5));
assert.deepEqual(getDelveCheckpoint(delve, 5), { nextWave: 5, campUnlocked: true });
const beforeFarm = GameState.gold;
const farm = awardOrdinaryWave(delve, 4, 5, true);

assert.equal(farm.xp, 1);
assert.equal(GameState.gold, beforeFarm + farm.gold);
assert.ok(awardOrdinaryWave(delve, 4, 5, true));
assert.deepEqual(getDelveCheckpoint(delve, 5), { nextWave: 5, campUnlocked: true });
assert.equal(awardOrdinaryWave({ ...delve, type: 'void' }, 0, 5), null);

saved.set(PROFILE_STORAGE_KEY, JSON.stringify({ gold: 7, world: { clearedDelves: ['slime-cave'] } }));
loadProfile([hero]);
assert.deepEqual(getDelveCheckpoint(delve, 5), { nextWave: 5, campUnlocked: true });
console.log('Delve checkpoint tests passed.');

// filter keeps entries whose callback returns true. It builds a new list and leaves the
// original list in place.
const ordinary = delves.filter(entry => entry.type === 'delve');

// A Set keeps each value once. has checks membership without searching a list for
// duplicate entries.

// Reused encounters inherit their environment's pool. Sharing cave materials is valid;
// a short run need not award every entry in the possible-drop list.
assert.deepEqual(delveMaterialIds(getDelveById('dolmark-den')), delveMaterialIds(delve));
for (const entry of ordinary) {
  GameState.world.clearedDelves = [];
  GameState.delveCheckpoints = {};
  const earned = new Set();

  for (let wave = 0; wave < entry.rooms - 1; wave++) earned.add(awardOrdinaryWave(entry, wave, entry.rooms - 1).materialId);

  // sort rearranges this array in place. A negative comparator result puts a before b;
  // positive puts it after; zero keeps them tied.
  assert.ok([...earned].every(id => delveMaterialIds(entry).includes(id)));
  assert.deepEqual(delveDropNames(entry), ['Gold / Adventurer XP', ...delveMaterialIds(entry).map(id => CRAFTING_MATERIALS[id].name)]);
}

assert.deepEqual(delveMaterialIds({ type: 'void' }), []);
console.log('Named Delve drop lists match authored environment reward pools.');

// Farm awards XP and Happiness only to living roster members, while Gold and materials
// remain shared. Check every authored difficulty so each tier keeps its intended payout.
for (const [difficulty, values] of Object.entries(FARM_REWARDS)) {
  const encounter = { ...delve, difficulty };
  GameState.roster = [{ ...hero }, { ...hero, id: 'fallen' }];
  GameState.world.clearedDelves = [];
  GameState.delveCheckpoints = { [delve.id]: { nextWave: 5, campUnlocked: true } };
  const units = [{ id: 'hero', alive: true }, { id: 'fallen', alive: false }];
  const beforeGold = GameState.gold;
  const reward = awardOrdinaryWave(encounter, 4, 5, true, units, () => 0.99);
  assert.equal(GameState.gold, beforeGold + values.gold);
  assert.deepEqual(reward.xpByHero, { hero: values.xp });
  assert.equal(GameState.roster[0].xp, values.xp);
  assert.equal(GameState.roster[0].happiness, 70 + values.happiness);
  assert.equal(GameState.roster[1].xp, 0);
  assert.equal(GameState.roster[1].happiness, 70);
  assert.equal(Object.values(reward.materials).reduce((sum, count) => sum + count, 0), values.materialCount);
  assert.ok(Object.keys(reward.materials).every(id => delveMaterialIds(encounter).includes(id)));
  assert.equal(awardOrdinaryWave(encounter, 3, 5, true, units), null);
}
console.log('All farm tiers preserve living-recipient rewards and pre-boss wave guards.');
