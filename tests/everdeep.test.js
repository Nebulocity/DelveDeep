// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import GameState from '../game/GameState.js';
import adventurers from '../data/adventurers.js';
import { loadProfile, saveProfile } from '../game/GameStorage.js';
import { restoreEverdeep } from '../game/EverdeepState.js';
import { startEverdeepRun, settleEverdeep, everdeepTimers, recallEverdeep, claimEverdeepChest, finishEverdeepRun } from '../game/Everdeep.js';
let writes = 0;

// A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
// object; get/set read and write that same key.
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => {
  writes++;
  storage.set(key, value);
} };
loadProfile(adventurers);
GameState.development.unlockAll = true;
GameState.gold = 1000;

// find returns the first matching entry, or undefined when none matches. Check for that
// missing result before using its fields. ... expands these entries into the new list or
// call. It does not deep-copy the objects inside. filter keeps entries whose callback
// returns true. It builds a new list and leaves the original list in place.
const party = [GameState.roster.find(hero => hero.role === 'Tank'), GameState.roster.find(hero => hero.role === 'Healer'), ...GameState.roster.filter(hero => !['Tank', 'Healer'].includes(hero.role)).slice(0, 3)].map(hero => hero.id);
const now = 1800000000000;
const first = startEverdeepRun(party, now).run;
const second = startEverdeepRun(party, now + 1000).run;
assert.ok(first && second);
assert.notEqual(first.id, second.id);
assert.equal(GameState.gold, 760);

assert.equal(GameState.everdeep.runs.length, 2);
assert.equal(startEverdeepRun([party[0], ...party.slice(0, 4)], now).ok, false);
const timers = everdeepTimers(first, now + 1000);
assert.equal(timers.nextWaveMs, 119000);
assert.equal(timers.remainingMs, 7199000);
assert.equal(everdeepTimers(first, now + 2000).remainingMs, timers.remainingMs - 1000);
const before = writes;

settleEverdeep(now + 2000);
assert.equal(writes, before, 'Timer ticks do not write saves');

// structuredClone makes an independent copy of supported data, including nested values.
// This differs from a shallow ... copy.
const snapshot = structuredClone(first.party);
GameState.roster[0].level += 5;
assert.deepEqual(first.party, snapshot);
assert.equal(recallEverdeep(now + 2000, GameState, second.id).ok, true);
assert.equal(first.stoppedAtMs, null);
assert.equal(second.stopReason, 'recalled');
assert.equal(finishEverdeepRun(GameState, second.id).ok, true);

assert.deepEqual(GameState.everdeep.runs.map(run => run.id), [first.id]);
first.earnedChestCount = 1;
const oldGold = GameState.gold;
assert.equal(claimEverdeepChest(GameState, 'missing').ok, false);
assert.equal(claimEverdeepChest(GameState, first.id).ok, true);
assert.ok(GameState.gold > oldGold);
assert.equal(claimEverdeepChest(GameState, first.id).ok, false);

saveProfile(); loadProfile(adventurers);
assert.equal(GameState.everdeep.runs[0].id, first.id);
assert.equal(GameState.everdeep.runs[0].claimedChestCount, 1);
const migrated = restoreEverdeep({ schemaVersion: 1, activeRun: first, totals: { runsStarted: 9, chestsClaimed: 1 } });
assert.equal(migrated.runs[0].id, first.id);
assert.equal(migrated.totals.runsStarted, 9);
assert.equal(restoreEverdeep({ schemaVersion: 2, runs: [first, first, { ...first, id: 'bad', waveIntervalMs: 0 }] }).runs.length, 1);

first.earnedChestCount = 0;
first.claimedChestCount = 0;
for (let i = 0; i < 1000; i++) {
  const trial = structuredClone(first);
  trial.seed = `trial-${i}`;
  trial.resolvedWave = 0;
  trial.stoppedAtMs = null;
  trial.party.forEach(hero => hero.power = 10000);
  GameState.everdeep.runs = [trial];
  settleEverdeep(trial.endsAtMs);

  if (trial.stopReason === 'expired') {
    assert.equal(trial.resolvedWave, 60);
    assert.equal(trial.earnedChestCount, 6);
    assert.equal(finishEverdeepRun(GameState, trial.id).ok, false);

    for (let chest = 0; chest < 6; chest++) assert.equal(claimEverdeepChest(GameState, trial.id).ok, true);
    assert.equal(finishEverdeepRun(GameState, trial.id).ok, true);
    break;
  }

  if (i === 999) assert.fail('No successful seeded run found');
}

console.log('Everdeep concurrent expeditions, timer seconds, save migration, snapshots, recall, expiry and chest claims passed.');
