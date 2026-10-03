import assert from 'node:assert/strict';
import fs from 'node:fs';
import delves from '../data/delves.js';
import { getEnvironmentFloor } from '../combat/LayeredEnvironment.js';

const dolmark = delves.find(delve => delve.id === 'dolmark-den');
const environment = dolmark.visuals.environment;

assert.equal(dolmark.depth, 3);
assert.deepEqual(dolmark.prerequisites, ['thornbriar-hollow']);
assert.equal(dolmark.requiresLocation, 'duskfall');
assert.equal(dolmark.rooms, 6);
assert.equal(environment.pixelArt, true);
assert.ok(fs.existsSync(new URL(environment.layers[0].url)));
const image = fs.readFileSync(new URL(environment.layers[0].url));
assert.equal(image.readUInt32BE(16), environment.width);
assert.equal(image.readUInt32BE(20), environment.height);
assert.equal(environment.foreground.sourceKey, environment.layers[0].key);
assert.ok(environment.foreground.depth > 4000);

for (const [width, height] of [[2400, 1080], [960, 432]]) {
  const floor = getEnvironmentFloor(environment, width, height);
  assert.ok(floor.topLeftX < floor.topRightX);
  assert.ok(floor.bottomLeftX < floor.bottomRightX);
  assert.ok(floor.topY < floor.bottomY);
  assert.ok(floor.bottomY < height * 0.78, 'Combat floor stays above the party HUD');
}

for (const polygon of environment.foreground.polygons) {
  assert.ok(polygon.length >= 3);
  for (const [x, y] of polygon) {
    assert.ok(x >= 0 && x <= environment.width);
    assert.ok(y >= 0 && y <= environment.height);
  }
}

for (const effect of [...environment.denEffects.lanterns, ...environment.denEffects.fungi]) {
  assert.ok(effect.x >= 0 && effect.x <= environment.width);
  assert.ok(effect.y >= 0 && effect.y <= environment.height);
}

console.log('Dolmark Den environment and progression checks passed.');
