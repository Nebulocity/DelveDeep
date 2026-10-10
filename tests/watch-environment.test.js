// Verify the new floor and cosmetic lifecycle without needing a running browser.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import watch from '../data/levels/SunkenWatch.js';
import { getDelveArena } from '../combat/LayeredEnvironment.js';
import { createWatchEnvironmentEffects } from '../combat/WatchEnvironmentEffects.js';

const environment = watch.visuals.environment;
const image = readFileSync(new URL(environment.layers[0].url));
assert.equal(image.readUInt32BE(16), environment.width);
assert.equal(image.readUInt32BE(20), environment.height);
assert.equal(environment.forestEffects, undefined);
for (const [width, height] of [[2400, 1080], [915, 412]]) {
  const floor = getDelveArena(environment, width, height);
  assert.ok(floor.topY < floor.bottomY);
  assert.equal(floor.bottomY, height * 0.78 - 12);
}

// Record drawing operations so pause, resume and resource cleanup are observable.
const drawings = [];
const makeGraphic = () => {
  const graphic = {
    commands: [], alpha: 1, destroyed: false,
    fillStyle() { return this; }, lineStyle() { return this; },
    fillEllipse(...args) { this.commands.push(args); return this; },
    strokeEllipse(...args) { this.commands.push(args); return this; },
    fillPoints() { return this; }, setPosition() { return this; },
    setScale() { return this; }, setDepth() { return this; },
    setMask(mask) { this.mask = mask; return this; },
    clearMask() { this.mask = null; return this; },
    setAlpha(alpha) { this.alpha = alpha; return this; },
    clear() { this.commands = []; return this; },
    createGeometryMask() { return { destroyed: false, destroy() { this.destroyed = true; } }; },
    destroy() { this.destroyed = true; }
  };
  drawings.push(graphic);
  return graphic;
};
const scene = { events: new EventEmitter(), combatPaused: false,
  add: { graphics: makeGraphic }, make: { graphics: makeGraphic } };
const effects = createWatchEnvironmentEffects(scene, environment.watchEffects,
  { x: 0, y: 0, scale: 1 });
const water = effects.objects[0];
const mask = water.mask;
assert.ok(mask, 'All water drawing is clipped');
const before = JSON.stringify(water.commands);
scene.events.emit('update', 0, 100);
assert.notEqual(JSON.stringify(water.commands), before);
assert.notEqual(effects.objects[1].alpha, effects.objects[2].alpha);
scene.combatPaused = true;
const paused = drawings.map(graphic => [JSON.stringify(graphic.commands), graphic.alpha]);
scene.events.emit('update', 0, 100);
assert.deepEqual(drawings.map(graphic => [JSON.stringify(graphic.commands), graphic.alpha]), paused);
scene.combatPaused = false;
scene.events.emit('update', 0, 100);
assert.notDeepEqual(drawings.map(graphic => [JSON.stringify(graphic.commands), graphic.alpha]), paused);
scene.events.emit('shutdown');
assert.equal(scene.events.listenerCount('update'), 0);
assert.ok(mask.destroyed);
assert.ok(drawings.every(graphic => graphic.destroyed));
console.log('Sunken Watch artwork, floor, water clipping, animation pause and cleanup passed.');
