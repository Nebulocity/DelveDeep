// Check new-spawn tuning and preparation without altering catalog objects or old saves.
import assert from 'node:assert/strict';
import enemies from '../data/enemies.js';
import { getDelveById } from '../data/delves.js';
import { delveEnemyDefinition } from '../config/delveBalance.js';
import { abilityPower } from '../game/CharacterStats.js';

const profiles = [
  ['old-quarry', 'depthsSovereign', 20, 53600, 70, 1350, 945],
  ['sunken-watch', 'earthsinker', 25, 42500, 105, 1300, 1365],
  ['murmuring-abyss', 'abyssalSovereign', 30, 100800, 45.6, 2200, 1003.2]
];
for (const [id, type, level, health, power, potency, damage] of profiles) {
  const delve = getDelveById(id);
  assert.deepEqual(delve.bossPreparation, { level, gearRarity: id === 'murmuring-abyss' ? 'best' : 'uncommon',
    abilityCount: 4, spendSkillPoints: true });
  const before = structuredClone(enemies[type]);
  const boss = delveEnemyDefinition(enemies[type], delve, true);
  assert.equal(boss.maxHp, health);
  assert.ok(Math.abs(boss.attackPower - power) < 1e-9);
  assert.equal(boss.armor, before.armor);
  const warning = boss.abilities.tertiary;
  assert.equal(warning.power, potency);
  assert.equal(warning.powerUnit, 'percent');
  assert.equal(warning.telegraph, 6000);
  assert.equal(warning.windup, 6000);
  assert.equal(warning.cooldown, 18000);
  assert.equal(warning.radius, 500);
  assert.equal(warning.areaCenter, 'caster');
  assert.equal(warning.autoAvoid, false);
  assert.ok(Math.abs(abilityPower(boss, warning) - damage) < 1e-9);
  assert.deepEqual(enemies[type], before);
}

// Ordinary profiles and both saved farm checkpoints stay independent of boss tuning.
for (const [id, type, health, power] of [
  ['old-quarry', 'quarryWorm', 3120, 5.2],
  ['sunken-watch', 'sunkenWatcher', 3600, 9],
  ['murmuring-abyss', 'voidKeeper', 15000, 23]
]) {
  const delve = getDelveById(id);
  const normal = delveEnemyDefinition(enemies[type], delve, false);
  assert.equal(normal.maxHp, health);
  assert.ok(Math.abs(normal.attackPower - power) < 1e-9);
  assert.equal(normal.level, delve.recommendedLevel);
}
const abyss = getDelveById('murmuring-abyss');
assert.deepEqual(abyss.campWaves, [15, 33]);
assert.deepEqual(abyss.entryPreparation,
  { level: 25, farmLevel: 26, gearRarity: 'best', abilityCount: 4, spendSkillPoints: true });
assert.equal(getDelveById('march-west-delves').bossPreparation.level, 20);
assert.equal(getDelveById('verge-delves').bossPreparation.level, 25);
console.log('Quarry, Watch and Abyss preparation, warnings, spawn scales and stable identities passed.');
