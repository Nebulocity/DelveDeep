import assert from 'node:assert/strict';
import fs from 'node:fs';
import slimeCave from '../data/levels/SlimeCave.js';
import delves from '../data/delves.js';
import { getEnvironmentTransform, getEnvironmentFloor, getDelveGridFloor } from '../combat/LayeredEnvironment.js';

const env = slimeCave.visuals.environment;
assert.equal(slimeCave.id, 'slime-cave', 'Saved progression keeps the same location ID');
assert.equal(slimeCave.depth, 1);
assert.equal(slimeCave.difficulty, 'Easy');
for (const asset of env.layers) {
  assert.ok(fs.existsSync(new URL(asset.url)), `Missing level asset: ${asset.key}`);
}
assert.equal(env.pixelArt, true);
for (const [width, height] of [[2400, 1080], [960, 432]]) {
  const t = getEnvironmentTransform(env, width, height);
  const floor = getEnvironmentFloor(env, width, height);
  assert.deepEqual(getDelveGridFloor(width, height), floor);
  assert.equal(floor.topY, t.y + env.floor.topY * t.scale);
  assert.equal(floor.bottomRightX, t.x + env.floor.bottomRightX * t.scale);
  assert.ok(floor.topLeftX < floor.topRightX);
  assert.ok(floor.bottomLeftX < floor.bottomRightX);
  assert.ok(floor.topY < floor.bottomY);
  assert.ok(floor.bottomY < height * 0.78, 'Floor remains above party HUD');
}
for (const delve of delves) {
  if (delve.id !== slimeCave.id) {
    assert.equal(delve.visuals.environment.floor, undefined,
      `${delve.name} must use the shared Slime Cave grid`);
  }
}
assert.ok(env.layers.some(layer => layer.key === env.foreground.sourceKey));
assert.ok(env.foreground.depth > 4000 && env.foreground.depth < 4500);
for (const polygon of env.foreground.polygons) {
  assert.ok(polygon.length >= 3);
  for (const [x, y] of polygon) {
    assert.ok(x >= 0 && x <= env.width);
    assert.ok(y >= 0 && y <= env.height);
  }
}
for (const pool of env.pixelEffects.pools) {
  assert.ok(pool.x >= 0 && pool.x + pool.width <= env.width);
  assert.ok(pool.y >= 0 && pool.y <= env.height);
}
for (const effect of [...env.pixelEffects.crystals, ...env.pixelEffects.rockSlime,
  ...env.pixelEffects.mushrooms]) {
  assert.ok(effect.x >= 0 && effect.x <= env.width);
  assert.ok(effect.y >= 0 && effect.y <= env.height);
}
assert.ok(env.pixelEffects.rockSlime.some(slime => slime.depth > env.foreground.depth));
assert.ok(env.pixelEffects.mushrooms.length >= 2);
console.log('Layered environment assets, projection and progression checks passed.');
