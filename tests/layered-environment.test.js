// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import slimeCave from '../data/levels/SlimeCave.js';
import delves from '../data/delves.js';
import { getEnvironmentTransform, getDelveArena } from '../combat/LayeredEnvironment.js';

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
  const floor = getDelveArena(env, width, height);

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound. ... expands these entries into the new list or call.
  // It does not deep-copy the objects inside. map builds one output entry for each input
  // entry, in the same order. The callback's return value becomes that output entry.
  assert.equal(floor.topY, t.y + Math.min(...env.walkable.map(p => p[1])) * t.scale);
  assert.equal(floor.bottomRightX, t.x + Math.max(...env.walkable.map(p => p[0])) * t.scale);
  assert.ok(floor.bottomY < height * 0.78);
  assert.ok(floor.topLeftX < floor.topRightX);
  assert.ok(floor.bottomLeftX < floor.bottomRightX);
  assert.ok(floor.topY < floor.bottomY);
  assert.ok(floor.bottomY < height * 0.88, 'Floor remains above party HUD');
}

for (const delve of delves) {
  assert.ok(delve.visuals.environment.walkable.length >= 8, `${delve.name} has an authored perimeter`);
}

// some stops with true as soon as one entry passes the check; an empty list gives false.
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
