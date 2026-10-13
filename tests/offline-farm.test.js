// Compare the batch payout against actual per-wave rewards, including level caps that
// change Gold partway through an absence. A seeded random stream also verifies loot.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import GameState from '../game/GameState.js';
import { awardOfflineFarmWaves } from '../game/OfflineFarmRewards.js';
import { awardOrdinaryWave, delveFarmWaveIndex, getDelveCheckpoint, isOrdinaryDelve } from '../game/DelveCheckpoints.js';
import { xpRequired } from '../game/AdventurerProgression.js';
import { getDelveById } from '../data/delves.js';
import { farmCycleMs, recordFarmClear } from '../combat/FarmTiming.js';
import { OFFLINE_FARM } from '../config/offlineFarm.js';

globalThis.localStorage = { getItem: () => null, setItem() {} };
const delve = getDelveById('thornbriar-hollow');
const cap = delve.bossPreparation.level;
const initial = [
  { id: 'almost', level: cap - 1, xp: xpRequired(cap - 1) - 3 },
  { id: 'later', level: cap - 1, xp: xpRequired(cap - 1) - 11 },
  { id: 'capped', level: cap, xp: 17 },
  { id: 'fallen', level: cap - 1, xp: 0 },
  { id: 'growing', level: cap - 2, xp: 0 }
].map(hero => ({ ...hero, maxHp: 100, attackPower: 10, happiness: 25, skillPoints: 0 }));

function run(batch, waveCount) {
  GameState.roster = structuredClone(initial);
  GameState.activeParty = structuredClone(initial);
  GameState.gold = 0;
  GameState.inventory.materials = {};
  GameState.world.clearedDelves = [];
  GameState.delveCheckpoints = { [delve.id]: { nextWave: 9, campUnlocked: true } };
  const units = initial.map(hero => ({ id: hero.id, alive: hero.id !== 'fallen' }));
  let seed = 12345;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  let rewards;
  if (batch) rewards = awardOfflineFarmWaves(delve, 8, 9, waveCount, units, random);
  else for (let wave = 0; wave < waveCount; wave++) awardOrdinaryWave(delve, 8, 9, true, units, random);
  return { gold: GameState.gold, roster: structuredClone(GameState.roster),
    materials: { ...GameState.inventory.materials }, seed, rewards };
}

for (const count of [0, 1, 3, 4, 11, 12, 500, 10000]) {
  const actual = run(true, count);
  const expected = run(false, count);
  assert.deepEqual({ ...actual, rewards: undefined }, { ...expected, rewards: undefined }, `Batch equals ${count} real farm payouts`);
  assert.equal(actual.rewards.xpByHero.fallen ?? 0, 0);
  assert.equal(actual.roster.find(hero => hero.id === 'capped').xp, 17, 'Preserve preexisting capped XP');
}

const before = run(true, 1);
assert.equal(awardOfflineFarmWaves(delve, 7, 9, 1000, [], () => 0), null, 'Reject a nonfarm wave');
GameState.delveCheckpoints = {};
assert.equal(awardOfflineFarmWaves(delve, 8, 9, 1000, [], () => 0), null, 'Reject a locked camp');
assert.equal(GameState.gold, before.gold);

const scene = { time: { now: 10000 }, currentWaveIndex: 8, combatLog: { entries: [] } };
assert.equal(farmCycleMs(scene), 60000, 'Old saves without history get a conservative one-minute cycle');
scene.combatLog.entries = [
  { type: 'wave', wave: 8, time: 0 },
  { type: 'wave', wave: 9, time: 30 },
  { type: 'wave', wave: 9, time: 70 },
  { type: 'wave', wave: 9, time: 120 }
];
assert.equal(farmCycleMs(scene), 45000, 'Legacy logs seed full repeated cycles only');
scene.farmTiming = { samples: [] };
recordFarmClear(scene);
scene.time.now += 42000;
recordFarmClear(scene);
assert.equal(farmCycleMs(scene), 42000);
scene.farmTiming.measuredClearAt = null;
scene.time.now += 9000;
recordFarmClear(scene);
assert.deepEqual(scene.farmTiming.samples, [42000], 'Staged short fight never teaches the average');
console.log('Offline farm batch payouts match per-wave caps, Happiness, random loot and XP; measured timing migrates safely.');

// Run the settlement function with a minimal scene. Phaser drawing is deliberately absent:
// background arithmetic must never require a rendered frame or a simulated attack.
const context = { GameState, OFFLINE_FARM, awardOfflineFarmWaves, delveFarmWaveIndex,
  getDelveCheckpoint, isOrdinaryDelve, farmCycleMs,
  beginIdleBattle(scene) {
    scene.idleSummary ??= { waves: 0, gold: 0, xp: 0, materials: {}, deaths: [], casualties: [] };
  }
};
vm.createContext(context);
vm.runInContext(readFileSync(new URL('../combat/OfflineFarm.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?$/gm, '').replaceAll('export function ', 'function ')
  + '\nglobalThis.advanceFarm = advanceOfflineFarm;', context);

function settlement(parts) {
  run(true, 0);
  GameState.currentDelve = delve;
  GameState.run.entry = 'farm';
  let seed = 12345;
  const farmScene = {
    currentWaveIndex: 8, bossWaveIndex: 9, time: { now: 0 }, game: { backgroundProgress: { hidden: true } },
    partyUnits: initial.map(hero => ({ id: hero.id, alive: hero.id !== 'fallen', hp: 1 })),
    farmTiming: { samples: [40000], startedAt: 0 },
    combatRandom: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32),
    isWaitingForPlayer() { return this.combatPaused || this.battleOver || this.awaitingRevive || GameState.run.entry === 'camp'; }
  };
  for (const duration of parts) assert.equal(context.advanceFarm(farmScene, duration).consumedMs, duration);
  return { farmScene, gold: GameState.gold, materials: { ...GameState.inventory.materials }, seed };
}

const once = settlement([125000]);
const split = settlement([5000, 30000, 20000, 70000]);
assert.equal(once.farmScene.offlineFarm.carryMs, 5000);
assert.equal(once.farmScene.offlineFarm.waves, 3);
assert.equal(split.farmScene.offlineFarm.carryMs, once.farmScene.offlineFarm.carryMs);
assert.equal(split.gold, once.gold);
assert.deepEqual(split.materials, once.materials);
assert.equal(split.seed, once.seed);
assert(split.farmScene.partyUnits.every(unit => unit.hp === 1), 'Hidden settlement applies no attacks or healing ticks');

const paused = settlement([]).farmScene;
paused.combatPaused = true;
assert.equal(context.advanceFarm(paused, 3600000), false, 'Pause stays on the waiting-state path');
paused.combatPaused = false;
GameState.run.entry = 'boss';
assert.equal(context.advanceFarm(paused, 3600000), false, 'Bosses are never estimated');
GameState.run.entry = 'progress';
assert.equal(context.advanceFarm(paused, 3600000), false, 'Progression is never estimated');
GameState.run.entry = 'farm';
assert.equal(context.advanceFarm(paused, 250).consumedMs, 0, 'Brief hidden gaps retain their debt without changing the fight');
assert.equal(paused.offlineFarm, undefined);

const huge = settlement([]).farmScene;
const duration = (OFFLINE_FARM.maxWavesPerBatch + 1) * 40000;
const first = context.advanceFarm(huge, duration);
assert.equal(first.consumedMs, OFFLINE_FARM.maxWavesPerBatch * 40000);
assert.equal(context.advanceFarm(huge, duration - first.consumedMs).consumedMs, 40000);
assert.equal(huge.offlineFarm.waves, OFFLINE_FARM.maxWavesPerBatch + 1);
console.log('Split background batches retain fractions and deterministic loot; pause, bosses, progression and large gaps stay bounded.');
