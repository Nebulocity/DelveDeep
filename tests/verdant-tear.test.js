// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import delves from '../data/delves.js';
import { createEncounterWaves } from '../data/encounters.js';
import { getDelveArena } from '../combat/LayeredEnvironment.js';

// find returns the first matching entry, or undefined when none matches. Check for that
// missing result before using its fields.
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

// map builds one output entry for each input entry, in the same order. The callback's
// return value becomes that output entry.
assert.deepEqual(waves[0].enemies.map(enemy => enemy.type), ['voidStalker', 'voidStalker', 'riftSentinel']);
assert.equal(waves.at(-1).boss, true);
assert.equal(waves.at(-1).enemies[0].type, 'abyssalSovereign');
assert.ok(environment.voidEffects.portal.radiusX < abyss.visuals.environment.voidEffects.portal.radiusX);

for (const [width, height] of [[2400, 1080], [960, 432]]) {
  const floor = getDelveArena(environment, width, height);
  assert.ok(floor.topLeftX < floor.topRightX);
  assert.ok(floor.bottomLeftX < floor.bottomRightX);
  assert.ok(floor.topY < floor.bottomY);
  assert.ok(floor.bottomY < height * 0.88);
}

console.log('Verdant Tear environment and encounter checks passed.');
