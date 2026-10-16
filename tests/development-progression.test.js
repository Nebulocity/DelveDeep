import assert from 'node:assert/strict';
import GameState from '../game/GameState.js';
import adventurers from '../data/adventurers.js';
import { loadProfile, saveProfile } from '../game/GameStorage.js';
import { loadLeaderProgression } from '../game/LeaderProgression.js';
import { applyDevelopmentBoost, BOOST_PRESETS, setDevelopmentExpeditionWave } from '../game/DevelopmentProgression.js';
import { equippedItem } from '../game/Equipment.js';
import { restoreEverdeep } from '../game/EverdeepState.js';
import { settleEverdeep, everdeepTimers, claimEverdeepChest } from '../game/Everdeep.js';
import { purchaseAdventurerAbility, abilityEntries } from '../game/AdventurerAbilities.js';

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
loadProfile(adventurers);
GameState.leader = loadLeaderProgression();

// Every authored class receives usable owned copies, and reapplying a preset
// keeps inventory size, wallets and character stats stable across save restoration.
for (const preset of BOOST_PRESETS) {
  assert.equal(applyDevelopmentBoost(preset.level).ok, true);
  for (const hero of GameState.roster) {
    assert.equal(hero.level, preset.level);
    assert.equal(hero.skillPoints, preset.level);
    assert.ok(equippedItem(hero, 'weapon'), hero.className);
    assert.ok(equippedItem(hero, 'armor'), hero.className);
  }
  const count = GameState.inventory.equipment.length;
  const leader = JSON.stringify(GameState.leader);
  applyDevelopmentBoost(preset.level);
  assert.equal(GameState.inventory.equipment.length, count);
  assert.equal(JSON.stringify(GameState.leader), leader);
  saveProfile();
  loadProfile(adventurers);
  assert.equal(GameState.gold, preset.gold);
  assert.ok(GameState.roster.every(hero => equippedItem(hero, 'weapon') && equippedItem(hero, 'armor')));
}
assert.equal(GameState.world.clearedDelves.length, 5);
assert.equal(GameState.leader.level, 12);
assert.equal(GameState.leader.renownPoints, 12);

const hero = GameState.roster[0];
const key = abilityEntries(hero).find(([id]) => hero.abilityRanks[id] === 1)[0];
assert.ok(purchaseAdventurerAbility(hero.id, key).ok);
applyDevelopmentBoost(30);
assert.equal(hero.skillPoints, 28);
assert.equal(hero.abilityRanks[key], 2);
applyDevelopmentBoost(5);
assert.equal(hero.skillPoints, 3);
assert.equal(applyDevelopmentBoost(6).ok, false);

const now = 1800000000000;
const run = id => ({ id, party: GameState.roster.slice(0, 5).map(hero => ({ id: hero.id, level: 5, power: 9999 })),
  startedAtMs: now, endsAtMs: now + 7200000, waveIntervalMs: 120000, durationMs: 7200000,
  resolvedWave: 0, earnedChestCount: 0, claimedChestCount: 0, stoppedAtMs: null,
  seed: id, rulesVersion: 1, rewardTableVersion: 2, regionId: 'pineshire-reach' });
GameState.everdeep = { schemaVersion: 2, runs: [run('a'), run('b')], totals: { runsStarted: 2, chestsClaimed: 0 } };
assert.equal(setDevelopmentExpeditionWave(20, 'a', now), 1);
assert.equal(GameState.everdeep.runs[1].resolvedWave, 0);
assert.equal(everdeepTimers(GameState.everdeep.runs[0], now).nextWaveMs, 120000);
assert.equal(setDevelopmentExpeditionWave(40, null, now), 2);
assert.equal(claimEverdeepChest(GameState, 'a').ok, true);
setDevelopmentExpeditionWave(10, null, now);
assert.equal(GameState.everdeep.runs[0].claimedChestCount, 1);
assert.equal(claimEverdeepChest(GameState, 'a').ok, false);
setDevelopmentExpeditionWave('Complete', 'a', now);
assert.equal(GameState.everdeep.runs[0].resolvedWave, 60);
assert.equal(GameState.everdeep.runs[0].earnedChestCount, 6);
assert.equal(GameState.everdeep.runs[0].stoppedAtMs, now);
GameState.everdeep = restoreEverdeep(JSON.parse(JSON.stringify(GameState.everdeep)));
settleEverdeep(now, GameState);
assert.equal(GameState.everdeep.runs[0].resolvedWave, 60);
assert.equal(GameState.everdeep.runs[1].resolvedWave, 10);
console.log('Boost tiers, compatible gear, repeat/reload, training budgets and independent expedition clocks pass.');
