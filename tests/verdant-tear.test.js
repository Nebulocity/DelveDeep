import assert from 'node:assert/strict';
import fs from 'node:fs';
import delves from '../data/delves.js';
import { createEncounterWaves } from '../data/encounters.js';
import { getDelveGridFloor } from '../combat/LayeredEnvironment.js';

const tear = delves.find(delve => delve.id === 'verdant-tear');
const abyss = delves.find(delve => delve.id === 'murmuring-abyss');
const environment = tear.visuals.environment;
const waves = createEncounterWaves(tear);

assert.equal(tear.name, 'The Verdant Tear');
assert.equal(tear.type, 'void');
assert.deepEqual(tear.prerequisites, ['slime-cave', 'thornbriar-hollow', 'dolmark-den']);
assert.equal(tear.requiresLocation, 'duskfall');
assert.ok(fs.existsSync(new URL(environment.layers[0].url)));
assert.equal(waves.length, 4);
assert.ok(waves.length < createEncounterWaves(abyss).length);
assert.deepEqual(waves[0].enemies.map(enemy => enemy.type), ['voidStalker', 'riftSentinel']);
assert.equal(waves.at(-1).boss, true);
assert.equal(waves.at(-1).enemies[0].type, 'abyssalSovereign');
assert.ok(environment.voidEffects.portal.radiusX < abyss.visuals.environment.voidEffects.portal.radiusX);

for (const [width, height] of [[2400, 1080], [960, 432]]) {
  const floor = getDelveGridFloor(width, height);
  assert.ok(floor.topLeftX < floor.topRightX);
  assert.ok(floor.bottomLeftX < floor.bottomRightX);
  assert.ok(floor.topY < floor.bottomY);
  assert.ok(floor.bottomY < height * 0.78);
}

console.log('Verdant Tear environment and encounter checks passed.');
