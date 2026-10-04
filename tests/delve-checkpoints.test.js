import assert from 'node:assert/strict';
import GameState from '../game/GameState.js';
import { awardOrdinaryWave, getDelveCheckpoint, WAVE_REWARDS } from '../game/DelveCheckpoints.js';
import { loadProfile } from '../game/GameStorage.js';
import { PROFILE_STORAGE_KEY } from '../game/BuildSave.js';

const saved = new Map();
globalThis.localStorage = {
  getItem: (key) => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value)
};

const delve = { id: 'slime-cave', type: 'delve', difficulty: 'Easy', rooms: 6 };
const hero = { id: 'hero', name: 'Hero', level: 1, xp: 0, happiness: 70, maxHp: 100, attackPower: 10 };
GameState.world.clearedDelves = [];
GameState.delveCheckpoints = {};
GameState.inventory.materials = {};
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
assert.equal(farm.xp, 4);
assert.equal(GameState.gold, beforeFarm + farm.gold);
assert.ok(awardOrdinaryWave(delve, 4, 5, true));
assert.deepEqual(getDelveCheckpoint(delve, 5), { nextWave: 5, campUnlocked: true });
assert.equal(awardOrdinaryWave({ ...delve, type: 'void' }, 0, 5), null);

saved.set(PROFILE_STORAGE_KEY, JSON.stringify({ gold: 7, world: { clearedDelves: ['slime-cave'] } }));
loadProfile([hero]);
assert.deepEqual(getDelveCheckpoint(delve, 5), { nextWave: 5, campUnlocked: true });
console.log('Delve checkpoint tests passed.');
