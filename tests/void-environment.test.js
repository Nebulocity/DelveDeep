import assert from 'node:assert/strict';
import fs from 'node:fs';
import delves from '../data/delves.js';
import { getEnvironmentFloor, getEnvironmentTransform } from '../combat/LayeredEnvironment.js';

const abyss = delves.find(delve => delve.id === 'murmuring-abyss');
const environment = abyss.visuals.environment;
assert.equal(abyss.type, 'void');
assert.equal(abyss.depth, 4);
assert.deepEqual(abyss.prerequisites, ['thornbriar-hollow']);
assert.equal(environment.pixelArt, true);
assert.ok(fs.existsSync(new URL(environment.layers[0].url)));
assert.equal(environment.foreground.sourceKey, environment.layers[0].key);
assert.ok(environment.foreground.depth > 4000);

for (const [width, height] of [[2400, 1080], [960, 432]]) {
  const transform = getEnvironmentTransform(environment, width, height);
  const floor = getEnvironmentFloor(environment, width, height);
  assert.ok(floor.topLeftX < floor.topRightX);
  assert.ok(floor.bottomLeftX < floor.bottomRightX);
  assert.ok(floor.topY < floor.bottomY);
  assert.ok(floor.bottomY < height * 0.78, 'Combat floor stays above the party HUD');
  assert.equal(floor.topY, transform.y + environment.floor.topY * transform.scale);
}

for (const polygon of environment.foreground.polygons) {
  assert.ok(polygon.length >= 3);
  for (const [x, y] of polygon) {
    assert.ok(x >= 0 && x <= environment.width);
    assert.ok(y >= 0 && y <= environment.height);
  }
}

const effects = environment.voidEffects;
assert.ok(effects.portal.particles >= 24);
assert.ok(effects.clouds.length >= 3);
assert.ok(effects.flames.length >= 4);
assert.ok(effects.lightning.length >= 3);
for (const point of [effects.portal, ...effects.clouds, ...effects.flames]) {
  assert.ok(point.x >= 0 && point.x <= environment.width);
  assert.ok(point.y >= 0 && point.y <= environment.height);
}
for (const bolt of effects.lightning) {
  assert.ok(bolt.startX >= 0 && bolt.endX <= environment.width);
  assert.ok(bolt.startY >= 0 && bolt.endY <= environment.height);
}
console.log('Void environment asset, projection and effect placement checks passed.');
