// Check the authored floor, saved map identity, independent lights and their lifecycle.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import quarry from '../data/levels/OldQuarry.js';
import dolmark from '../data/levels/DolmarkDen.js';
import { getDelveById } from '../data/delves.js';
import { getDelveArena } from '../combat/LayeredEnvironment.js';
import { createQuarryEnvironmentEffects } from '../combat/QuarryEnvironmentEffects.js';

const environment = quarry.visuals.environment;
const image = readFileSync(new URL(environment.layers[0].url));
assert.equal(image.readUInt32BE(16), environment.width);
assert.equal(image.readUInt32BE(20), environment.height);
assert.notDeepEqual(environment.walkable, dolmark.visuals.environment.walkable);
assert.deepEqual(getDelveById('march-west-delves').visuals, quarry.visuals);
assert.equal(environment.denEffects, undefined);
for (const [width, height] of [[2400, 1080], [915, 412]]) {
  const floor = getDelveArena(environment, width, height);
  assert.ok(floor.topY < floor.bottomY);
  assert.equal(floor.bottomY, height * 0.78 - 12);
  assert.ok(floor.boundary.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
}

// Record graphics state so real time changes, both pause paths and shutdown can be
// checked without requiring WebGL. Lighting must never call combat random methods.
const makeGraphic = () => ({
  alpha: 1, destroyed: false, faces: [],
  fillStyle() { return this; }, fillEllipse() { return this; },
  fillPoints(points) { this.faces.push(points); return this; },
  setPosition(x, y) { this.position = [x, y]; return this; },
  setScale(scale) { this.scale = scale; return this; },
  setDepth(depth) { this.depth = depth; return this; },
  setAlpha(alpha) { this.alpha = alpha; return this; },
  destroy() { this.destroyed = true; }
});
const scene = { events: new EventEmitter(), combatPaused: false,
  add: { graphics: makeGraphic } };
const effects = createQuarryEnvironmentEffects(scene, environment.quarryEffects,
  { x: 14, y: -28, scale: 0.5 });
const objects = effects.objects;
const alphas = () => objects.map(object => object.alpha);
assert.equal(objects.length, 11);
assert.ok(objects.every(object => object.depth < 0 && object.scale === 0.5));
assert.ok(objects.every(object => object.position[0] === 14 && object.position[1] === -28));
assert.ok(objects.slice(4).every(object => object.faces.length > 0));
const before = alphas();
scene.events.emit('update', 0, 100);
assert.ok(alphas().every((alpha, index) => alpha !== before[index]));
assert.equal(new Set(alphas().slice(0, 4)).size, 4);
assert.equal(new Set(alphas().slice(4)).size, 7);
for (let frame = 0; frame < 240; frame += 1) {
  scene.events.emit('update', frame * 100, 100);
  assert.ok(alphas().every(alpha => alpha >= 0 && alpha <= 1));
}
for (const pauseMode of ['combat', 'scene']) {
  if (pauseMode === 'combat') scene.combatPaused = true;
  else scene.events.emit('pause');
  const frozen = alphas();
  scene.events.emit('update', 0, 100);
  assert.deepEqual(alphas(), frozen);
  if (pauseMode === 'combat') scene.combatPaused = false;
  else scene.events.emit('resume');
  scene.events.emit('update', 0, 100);
  assert.notDeepEqual(alphas(), frozen);
}
scene.events.emit('shutdown');
assert.ok(objects.every(object => object.destroyed));
for (const event of ['update', 'pause', 'resume']) assert.equal(scene.events.listenerCount(event), 0);
console.log('Quarry floor, saved identity, light animation, pause and cleanup passed.');
