import assert from 'node:assert/strict';
import delves from '../data/delves.js';
import enemies from '../data/enemies.js';
import { createEncounterWaves, encounterWaveCounts } from '../data/encounters.js';
import { getBattleLayout } from '../ui/Layout.js';
import { loadLeaderProgression, saveLeaderProgression, grantLeaderLevels, recordDepthClear, purchaseLeaderAbility, toggleLeaderLoadoutAbility, leaderAbilities } from '../game/LeaderProgression.js';

const saved = new Map();
globalThis.localStorage = {
  getItem: (key) => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value)
};
const key = 'delveDeep.leaderProgression.v1';

// Existing point balances, purchases, and loadouts survive the TP rename.
localStorage.setItem(key, JSON.stringify({
  level: 10, highestClearedDepth: 9, inspirationPoints: 3,
  spentInspiration: 2, unlockedAbilities: ['focusFire', 'brace'],
  battleLoadout: ['brace', 'focusFire']
}));
let leader = loadLeaderProgression();
assert.equal(leader.tacticsPoints, 3);
assert.equal(leader.spentTacticsPoints, 2);
assert.deepEqual(leader.battleLoadout, ['brace', 'focusFire']);
assert.equal(purchaseLeaderAbility(leader, 'arise'), true);
assert.equal(leader.tacticsPoints, 1);
assert.equal(purchaseLeaderAbility(leader, 'arise'), false);
const migrated = JSON.parse(localStorage.getItem(key));
assert.equal(migrated.inspirationPoints, undefined);
assert.equal(migrated.spentInspiration, undefined);
assert.equal(loadLeaderProgression().tacticsPoints, 1);

// Retired Prepared Supplies is removed and its purchase is refunded once.
localStorage.setItem(key, JSON.stringify({
  tacticsPoints: 0, spentTacticsPoints: 1,
  unlockedAbilities: ['focusFire', 'preparedSupplies'],
  battleLoadout: ['preparedSupplies']
}));
leader = loadLeaderProgression();
assert.equal(leaderAbilities.some((ability) => ability.id === 'preparedSupplies'), false);
assert.deepEqual(leader.battleLoadout, []);
assert.equal(leader.tacticsPoints, 1);
assert.equal(leader.spentTacticsPoints, 0);
assert.deepEqual(JSON.parse(localStorage.getItem(key)).unlockedAbilities, ['focusFire']);
assert.equal(loadLeaderProgression().tacticsPoints, 1);

// Zero TP must not restore a legacy balance if both keys are present.
localStorage.setItem(key, JSON.stringify({ tacticsPoints: 0, inspirationPoints: 9 }));
assert.equal(loadLeaderProgression().tacticsPoints, 0);

// Developer levels use the existing milestone rule and cannot be undone
// or rewarded twice by clearing a lower depth afterwards.
saved.clear();
leader = loadLeaderProgression();
grantLeaderLevels(leader, 3);
assert.equal(leader.level, 4);
assert.equal(leader.tacticsPoints, 0);
grantLeaderLevels(leader);
assert.equal(leader.level, 5);
assert.equal(leader.tacticsPoints, 1);
recordDepthClear(leader, 2);
assert.equal(leader.level, 5);
assert.equal(leader.tacticsPoints, 1);
recordDepthClear(leader, 9);
assert.equal(leader.level, 10);
assert.equal(leader.tacticsPoints, 2);
recordDepthClear(leader, 9);
assert.equal(leader.tacticsPoints, 2);
saveLeaderProgression(leader);
assert.equal(loadLeaderProgression().level, 10);

// The player can equip exactly five unlocked tactics, not six or duplicates.
leader.unlockedAbilities = leaderAbilities.map((ability) => ability.id);
leader.battleLoadout = [];
for (const ability of leaderAbilities.slice(0, 5)) {
  assert.equal(toggleLeaderLoadoutAbility(leader, ability.id), true);
}
assert.equal(toggleLeaderLoadoutAbility(leader, 'arise'), false);
assert.equal(toggleLeaderLoadoutAbility(leader, 'brace'), true);
assert.equal(toggleLeaderLoadoutAbility(leader, 'arise'), true);
assert.equal(leader.battleLoadout.length, 5);

// Each delve ends with its intended boss group, and every spawn resolves.
const slimeCave = delves.find((delve) => delve.id === 'slime-cave');
assert.ok(slimeCave.visuals?.environment?.layers.length);
assert.ok(slimeCave.visuals?.environment?.pixelEffects.pools.length);
assert.equal(delves.filter((delve) => delve.visuals?.environment).length, 5);
for (const delve of delves) {
  const waves = createEncounterWaves(delve);
  const finalCounts = { 'slime-cave': 5, 'thornbriar-hollow': 10, 'dolmark-den': 6,
    'murmuring-abyss': 4, 'verdant-tear': 3 };
  assert.equal(waves.length, delve.id === 'verdant-tear' ? 4
    : delve.difficulty === 'Unknown' ? 6 : encounterWaveCounts[delve.difficulty]);
  assert.equal(delve.rooms, waves.length);
  const final = waves.at(-1);
  assert.equal(final.boss, true);
  assert.equal(final.enemies.length, finalCounts[delve.id]);
  assert.equal(final.enemies.filter((spawn) => enemies[spawn.type].boss).length, 1);
  assert.ok(enemies[final.enemies[0].type].maxHp >= 2600);
  assert.ok(enemies[final.enemies[0].type].bodyRadius > 45);
  for (const wave of waves) {
    for (const spawn of wave.enemies) assert.ok(enemies[spawn.type]);
  }
  waves[0].enemies[0].arenaX = -999;
  assert.notEqual(createEncounterWaves(delve)[0].enemies[0].arenaX, -999);
}
const thornbriar = delves.find((delve) => delve.id === 'thornbriar-hollow');
const banditWaves = createEncounterWaves(thornbriar);
assert.deepEqual(banditWaves.flatMap((wave) => wave.enemies.map((spawn) => spawn.type)).filter((type, index, all) => all.indexOf(type) === index), [
  'ruffian', 'lasher', 'hedgeMage', 'rongarTheCrusher'
]);
assert.equal(banditWaves.at(-1).enemies[0].type, 'rongarTheCrusher');
const thornbriarCounts = (random) => createEncounterWaves(thornbriar, 1400, random)
  .map(wave => ['ruffian', 'lasher', 'hedgeMage', 'rongarTheCrusher']
    .map(type => wave.enemies.filter(spawn => spawn.type === type).length));
assert.deepEqual(thornbriarCounts(() => 0), [
  [5, 0, 0, 0], [4, 2, 0, 0], [3, 1, 1, 0], [4, 2, 2, 0], [6, 3, 3, 0], [4, 3, 2, 1]
]);
assert.deepEqual(thornbriarCounts(() => 0.999), [
  [8, 0, 0, 0], [10, 8, 0, 0], [6, 3, 1, 0], [6, 4, 2, 0], [8, 5, 3, 0], [4, 3, 2, 1]
]);
const thornbriarRolls = [0, 0, 0.999, 0, 0.999];
assert.deepEqual(thornbriarCounts(() => thornbriarRolls.shift() ?? 0)[1], [7, 5, 0, 0]);
const dolmark = delves.find((delve) => delve.id === 'dolmark-den');
assert.equal(dolmark.difficulty, 'Easy');
const dolmarkCounts = (random) => createEncounterWaves(dolmark, 1400, random)
  .map(wave => ['denWarden', 'denProtector', 'silvanarkTheForestLord']
    .map(type => wave.enemies.filter(spawn => spawn.type === type).length));
assert.deepEqual(dolmarkCounts(() => 0), [
  [5, 0, 0], [6, 0, 0], [4, 1, 0], [4, 2, 0], [4, 4, 0], [3, 2, 1]
]);
assert.deepEqual(dolmarkCounts(() => 0.999), [
  [8, 0, 0], [12, 0, 0], [10, 1, 0], [4, 2, 0], [4, 4, 0], [3, 2, 1]
]);
const dolmarkRolls = [0, 0.999, 0, 0.999, 0, 0.999];
assert.deepEqual(dolmarkCounts(() => dolmarkRolls.shift() ?? 0)[2], [7, 1, 0]);
for (const [difficulty, count] of Object.entries(encounterWaveCounts)) {
  const waves = createEncounterWaves({ difficulty });
  assert.equal(waves.length, count);
  assert.equal(waves.at(-1).boss, true);
}
assert.equal(createEncounterWaves({ type: 'void', difficulty: 'Unknown' }).length, 6);
assert.equal(createEncounterWaves(slimeCave).at(-1).enemies[0].type, 'slimeSovereign');
const slimeCounts = (random) => createEncounterWaves(slimeCave, 1400, random)
  .map(wave => ['caveSlime', 'elderSlime', 'slimeSovereign']
    .map(type => wave.enemies.filter(spawn => spawn.type === type).length));
assert.deepEqual(slimeCounts(() => 0), [
  [3, 0, 0], [4, 0, 0], [4, 1, 0], [2, 2, 0], [4, 3, 0], [2, 2, 1]
]);
assert.deepEqual(slimeCounts(() => 0.999), [
  [6, 0, 0], [10, 0, 0], [10, 1, 0], [2, 2, 0], [4, 3, 0], [2, 2, 1]
]);
const rolls = [0, 0.25, 0.5, 0.75, 0];
assert.deepEqual(slimeCounts(() => rolls.shift()), [
  [3, 0, 0], [7, 0, 0], [7, 1, 0], [2, 2, 0], [4, 3, 0], [2, 2, 1]
]);
const oldBossX = createEncounterWaves(slimeCave).at(-1).enemies[0].arenaX;
assert.equal(createEncounterWaves(slimeCave, 1750).at(-1).enemies[0].arenaX, oldBossX + 175);
const milestone = createEncounterWaves({ difficulty: 'Easy', depth: 5 });
assert.equal(milestone.length, 7);
assert.equal(milestone.at(-2).milestoneBoss, true);
assert.equal(milestone.at(-1).enemies[0].type, 'slimeSovereign');

// Check the entire button group, internal text rows, and header separation
// at the game's logical resolution. Phaser FIT preserves this geometry on
// landscape phones; the widest boss label offsets also clear the controls.
for (let count = 1; count <= 5; count++) {
  const layout = getBattleLayout(2400, 1080, count);
  assert.equal((layout.positions[0] + layout.positions.at(-1)) / 2, 1200);
  assert.ok(layout.positions[0] - layout.buttonWidth / 2 >= 345);
  assert.ok(layout.positions.at(-1) + layout.buttonWidth / 2 <= 2055);
  assert.ok(layout.titleY + 29 < layout.messageY - 24);
  assert.ok(layout.messageY + 24 < layout.statusY - 20);
  assert.ok(layout.statusY + 20 < layout.labelY - 17);
  assert.ok(layout.labelY + 17 < layout.buttonY - layout.buttonHeight / 2);
  assert.ok(layout.arenaTop - 169 * 0.74 - 14 > layout.buttonY + layout.buttonHeight / 2);
  for (let index = 1; index < count; index++) {
    assert.ok(layout.positions[index] - layout.positions[index - 1] > layout.buttonWidth);
  }
}
console.log('Progression, encounter, and layout checks passed.');
