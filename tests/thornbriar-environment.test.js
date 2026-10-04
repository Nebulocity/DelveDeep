import assert from 'node:assert/strict';
import fs from 'node:fs';
import delves from '../data/delves.js';
import { getDelveGridFloor } from '../combat/LayeredEnvironment.js';

const thornbriar = delves.find(delve => delve.id === 'thornbriar-hollow');
const environment = thornbriar.visuals.environment;
assert.equal(thornbriar.depth, 2);
assert.deepEqual(thornbriar.prerequisites, ['slime-cave']);
assert.equal(environment.pixelArt, true);
assert.equal(environment.layers.length, 1);
assert.ok(fs.existsSync(new URL(environment.layers[0].url)));
assert.equal(environment.foreground.sourceKey, environment.layers[0].key);
assert.ok(environment.foreground.depth > 4000);

for (const [width, height] of [[2400, 1080], [960, 432]]) {
  const floor = getDelveGridFloor(width, height);
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

for (const effect of [...environment.forestEffects.fires, ...environment.forestEffects.embers]) {
  assert.ok(effect.x >= 0 && effect.x <= environment.width);
  assert.ok(effect.y >= 0 && effect.y <= environment.height);
}

console.log('Thornbriar environment asset, projection and progression checks passed.');
