// Ordinary-wave tuning must not leak into the boss group, another Delve or the catalog.
import assert from 'node:assert/strict';
import enemies from '../data/enemies.js';
import { thornbriarEnemyDefinition } from '../config/thornbriarBalance.js';
import { abilityPower } from '../game/CharacterStats.js';

for (const type of ['ruffian', 'lasher', 'hedgeMage']) {
  const original = enemies[type];
  const before = structuredClone(original);
  const ordinary = thornbriarEnemyDefinition(type, original, 'thornbriar-hollow', false);
  assert.notEqual(ordinary, original);
  assert.equal(ordinary.abilities, original.abilities);
  assert.equal(thornbriarEnemyDefinition(type, original, 'thornbriar-hollow', true), original);
  assert.equal(thornbriarEnemyDefinition(type, original, 'dolmark-den', false), original);
  assert.deepEqual(original, before);
}
const boss = enemies.rongarTheCrusher;
assert.equal(thornbriarEnemyDefinition('rongarTheCrusher', boss, 'thornbriar-hollow', true), boss);
const lasher = thornbriarEnemyDefinition('lasher', enemies.lasher, 'thornbriar-hollow', false);
const mage = thornbriarEnemyDefinition('hedgeMage', enemies.hedgeMage, 'thornbriar-hollow', false);
assert.equal(abilityPower(lasher, lasher.abilities.primary), 12);
assert.equal(abilityPower(mage, mage.abilities.primary), 10.8);
console.log('Thornbriar ordinary-wave tuning preserves boss groups, other Delves and authored skills.');
