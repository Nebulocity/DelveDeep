import assert from 'node:assert/strict';
import fs from 'node:fs';
import slimeCave from '../data/levels/SlimeCave.js';
import oldSlimeCave from '../data/levels/_old_SlimeCave.js';
import { getEnvironmentTransform, getEnvironmentFloor } from '../combat/LayeredEnvironment.js';

const env = slimeCave.visuals.environment;
assert.equal(slimeCave.id, oldSlimeCave.id, 'Saved progression keeps the same location ID');
assert.equal(slimeCave.depth, oldSlimeCave.depth);
assert.equal(slimeCave.difficulty, oldSlimeCave.difficulty);
for (const asset of [...env.layers, env.ambient]) {
  assert.ok(fs.existsSync(new URL(asset.url)), `Missing level asset: ${asset.key}`);
}
for (const [width, height] of [[2400, 1080], [960, 432]]) {
  const t = getEnvironmentTransform(env, width, height);
  const floor = getEnvironmentFloor(env, width, height);
  assert.equal(floor.topY, t.y + env.floor.topY * t.scale);
  assert.equal(floor.bottomRightX, t.x + env.floor.bottomRightX * t.scale);
  assert.ok(floor.topLeftX < floor.topRightX);
  assert.ok(floor.bottomLeftX < floor.bottomRightX);
  assert.ok(floor.topY < floor.bottomY);
  assert.ok(floor.bottomY < height * 0.78, 'Floor remains above party HUD');
}
assert.ok(env.layers.find(l => l.key.endsWith('foreground')).depth > 4000);
assert.ok(env.layers.find(l => l.key.endsWith('foreground')).depth < 4500);
for (const region of env.ambient.regions) {
  assert.ok(region.y >= env.ambient.sourceY, 'Do not expose the old flickering ceiling');
  assert.ok(region.x >= 0 && region.x + region.width <= env.width);
  assert.ok(region.y + region.height <= env.height);
}
console.log('Layered environment assets, projection and progression checks passed.');
