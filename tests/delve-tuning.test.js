// Check the new preparation targets and two-camp progression with real saved rewards.
import assert from 'node:assert/strict';
import GameState from '../game/GameState.js';
import { getDelveById } from '../data/delves.js';
import { delveMaterialIds } from '../game/DelveDrops.js';
import { CRAFTING_MATERIALS } from '../data/items.js';
import enemies from '../data/enemies.js';
import { delveEnemyDefinition } from '../config/delveBalance.js';
import { WAVE_REWARDS, FARM_REWARDS, awardOrdinaryWave, getDelveCheckpoint,
  delveFarmWaveIndex, isOrdinaryDelve } from '../game/DelveCheckpoints.js';

globalThis.localStorage = { getItem: () => null, setItem() {} };
const targets = [
  ['slime-cave', 1, 5, 'Easy', 2, 2, 6],
  ['thornbriar-hollow', 5, 10, 'Difficult', 3, 2, 10],
  ['dolmark-den', 10, 15, 'Tough', 2, 3, 16],
  ['march-west-delves', 15, 20, 'Very Tough', 3, 3, 24],
  ['verge-delves', 20, 25, 'Very Tough', 2, 4, 24],
  ['murmuring-abyss', 25, 30, 'Incredibly Tough', 3, 4, 34]
];
for (const [id, start, boss, difficulty, count, rank, waves] of targets) {
  const delve = getDelveById(id);
  assert.equal(delve.recommendedLevel, start);
  assert.equal(delve.difficulty, difficulty);
  assert.equal(delve.rooms, waves);
  assert.deepEqual(delve.bossPreparation, { level: boss, gearRarity: 'common', abilityCount: count, abilityRank: rank });

  // Fresh spawn metadata follows the encounter while the reusable catalog stays intact.
  const original = enemies.caveSlime;
  const before = structuredClone(original);
  assert.equal(delveEnemyDefinition(original, delve, false).level, start);
  assert.equal(delveEnemyDefinition(original, delve, true).level, boss);
  assert.deepEqual(original, before);
}

// Pin fixed payouts independently of the tables, including later first-clear waves.
for (const [index, difficulty] of Object.keys(WAVE_REWARDS).entries()) {
  const delve = { ...getDelveById('slime-cave'), difficulty };
  GameState.roster = [{ id: 'hero', level: 1, xp: 0, happiness: 70 }];
  GameState.activeParty = GameState.roster;
  GameState.world.clearedDelves = [];
  GameState.delveCheckpoints = {};
  for (let wave = 0; wave < 5; wave++) {
    const reward = awardOrdinaryWave(delve, wave, 5);
    assert.equal(reward.gold, index + 1);
    assert.equal(reward.xp, index + 1);
  }
  assert.equal(FARM_REWARDS[difficulty].xp, 1);
  const reward = awardOrdinaryWave(delve, 4, 5, true, [{ id: 'hero', alive: true }], () => 0.99);
  assert.deepEqual(reward.xpByHero, { hero: 1 });
}

// Abyss keeps its portal type while using ordinary banking at both authored camps.
const abyss = getDelveById('murmuring-abyss');
GameState.world.clearedDelves = [];
GameState.delveCheckpoints = {};
assert.equal(abyss.type, 'void');
assert.equal(isOrdinaryDelve(abyss), true);
assert.equal(isOrdinaryDelve(getDelveById('verdant-tear')), false);
assert.deepEqual(new Set(delveMaterialIds(abyss)), new Set(Object.values(CRAFTING_MATERIALS)
  .filter(material => material.environment !== 'Crafted' && ['common', 'uncommon'].includes(material.rarity))
  .map(material => material.id)));
assert.equal(awardOrdinaryWave(abyss, 14, 33, true), null);
for (let wave = 0; wave < 15; wave++) assert.ok(awardOrdinaryWave(abyss, wave, 33));
assert.deepEqual(getDelveCheckpoint(abyss), { nextWave: 15, campUnlocked: true });
assert.equal(delveFarmWaveIndex(abyss), 14);
assert.ok(awardOrdinaryWave(abyss, 14, 33, true));
assert.equal(awardOrdinaryWave(abyss, 32, 33, true), null);
assert.equal(awardOrdinaryWave(abyss, 14, 33), null);
for (let wave = 15; wave < 33; wave++) assert.ok(awardOrdinaryWave(abyss, wave, 33));
assert.deepEqual(getDelveCheckpoint(abyss), { nextWave: 33, campUnlocked: true });
assert.equal(delveFarmWaveIndex(abyss), 32);
assert.ok(awardOrdinaryWave(abyss, 32, 33, true));
assert.equal(awardOrdinaryWave(abyss, 14, 33, true), null);

// Difficulty extensions preserve boss access already earned in older single-camp saves.
GameState.delveCheckpoints = { 'thornbriar-hollow': { nextWave: 5, campUnlocked: true } };
assert.deepEqual(getDelveCheckpoint(getDelveById('thornbriar-hollow')), { nextWave: 9, campUnlocked: true });
console.log('Pineshire targets, fixed wave payouts, Abyss camps and older boss access passed.');
