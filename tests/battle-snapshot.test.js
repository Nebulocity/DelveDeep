// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import { packBattleValue, unpackBattleValue, captureBattle, validBattleSnapshot } from '../game/BattleSnapshot.js';
import GameState from '../game/GameState.js';
import { loadProfile, saveProfile, setBattleSaveProvider, clearSavedProfile } from '../game/GameStorage.js';
import adventurers from '../data/adventurers.js';
import { PROFILE_STORAGE_KEY } from '../game/BuildSave.js';

// A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
// object; get/set read and write that same key.
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null,

  // We bring item up to date here. The assignments below are the new values other code
  // will read after this step.
  setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };

// A Set keeps each value once. has checks membership without searching a list for
// duplicate entries.
const model = { start: -Infinity, end: Infinity, cooldowns: new Map([['attack', -Infinity]]),
  held: new Set(['hero']), status: { poison: { next: 1000, until: 4000 } } };
assert.deepEqual(unpackBattleValue(JSON.parse(JSON.stringify(packBattleValue(model)))), model);

loadProfile(adventurers);
GameState.activeParty = [GameState.roster[0]];
GameState.currentDelve = { id: 'slime-cave' };
GameState.run = { entry: 'farm', startedAt: 100, summary: null };
const unit = { id: GameState.roster[0].id, hp: 123, maxHp: 500, mana: 0, arenaX: 500, arenaY: 300,
  status: { stunnedUntil: 1200 }, lastAttackAt: -Infinity,
  pendingAction: { id: 1, name: 'Attack', startAt: 900, duration: 250 },
  container: new (class Visual {})(), scene: {}, battlefield: {}, abilities: { attack: { power: 100 } } };

const scene = { time: { now: 1000 }, currentWaveIndex: 4, waveRetreating: false,
  battleOver: false, combatPaused: false, heldUnitIds: new Set([unit.id]),
  partyUnits: [unit], enemies: [], battleEvents: new Set([{ data: {
    kind: 'attack', unitId: unit.id, targetId: 'enemy', actionId: 1, actionStartAt: 900, actionName: 'Attack'
  }, timer: { hasDispatched: false, getRemaining: () => 150 } }]),
  classAbilitySystem: { traps: [] }, movement: { slots: new Map(), rangeStates: new Map() },
  tactics: { preferences: new Map() }, combatLog: { entries: [], record: { entries: [], summary: {} }, startedAt: 100 } };

const snapshot = captureBattle(scene, GameState, 10000);
assert.equal(validBattleSnapshot(snapshot, GameState.roster), true);
assert.equal(snapshot.party[0].container, undefined);
assert.equal(snapshot.party[0].scene, undefined);
assert.equal(snapshot.events[0].remainingMs, 150);
assert.equal(unpackBattleValue(snapshot.party[0]).lastAttackAt, -Infinity);

// ... copies the source's own fields into this object; fields listed later replace earlier
// ones. This is a shallow copy, so nested objects are still shared.
assert.equal(validBattleSnapshot({ ...snapshot, version: 99 }, GameState.roster), false);
assert.equal(validBattleSnapshot({ ...snapshot, partyIds: ['missing'] }, GameState.roster), false);
assert.equal(validBattleSnapshot({ ...snapshot, events: [{ remainingMs: -1, data: { kind: 'attack' } }] }, GameState.roster), false);

// Intermediate reward writes wait for the completed transition, committing one coherent
// profile.
GameState.gold = 10;
saveProfile();
setBattleSaveProvider(() => captureBattle(scene, GameState, 10000));
GameState.gold += 24;
saveProfile();
assert.equal(JSON.parse(storage.get(PROFILE_STORAGE_KEY)).gold, 10);
scene.waveRetreating = true;

scene.waveTransitioning = true;
await Promise.resolve();
let committed = JSON.parse(storage.get(PROFILE_STORAGE_KEY));
assert.equal(committed.gold, 34);
assert.equal(committed.activeBattle.scene.waveRetreating, true);
assert.equal(committed.activeBattle.scene.waveTransitioning, true);
setBattleSaveProvider(null);

loadProfile(adventurers);
assert.equal(GameState.gold, 34);
assert.equal(GameState.activeBattle.events[0].remainingMs, 150);

// Legacy and invalid profiles keep their progress while safely returning to the world map.
delete committed.activeBattle;
storage.set(PROFILE_STORAGE_KEY, JSON.stringify(committed));
loadProfile(adventurers);
assert.equal(GameState.activeBattle, null);
assert.equal(GameState.gold, 34);
committed.activeBattle = { version: 99 };
storage.set(PROFILE_STORAGE_KEY, JSON.stringify(committed));

loadProfile(adventurers);
assert.equal(GameState.activeBattle, null);
assert.equal(GameState.gold, 34);

// Reset invalidates a queued write so it cannot resurrect a cleared session.
setBattleSaveProvider(() => snapshot);
saveProfile();
clearSavedProfile();
setBattleSaveProvider(null);
await Promise.resolve();
assert.equal(storage.has(PROFILE_STORAGE_KEY), false);
assert.equal(GameState.activeBattle, null);

console.log('Battle snapshot models, timers, atomic rewards, legacy saves, validation and reset passed.');
