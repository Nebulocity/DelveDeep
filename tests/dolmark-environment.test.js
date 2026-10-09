// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import delves from '../data/delves.js';
import slimeCave from '../data/levels/SlimeCave.js';
import { getDelveArena } from '../combat/LayeredEnvironment.js';
import { createDenEnvironmentEffects } from '../combat/DenEnvironmentEffects.js';

// find returns the first matching entry, or undefined when none matches. Check for that
// missing result before using its fields.
const dolmark = delves.find(delve => delve.id === 'dolmark-den');
const environment = dolmark.visuals.environment;

assert.equal(dolmark.depth, 3);
assert.deepEqual(dolmark.prerequisites, ['thornbriar-hollow']);
assert.equal(dolmark.requiresLocation, 'duskfall');
assert.equal(dolmark.rooms, 10);
assert.equal(environment.pixelArt, true);
assert.ok(fs.existsSync(new URL(environment.layers[0].url)));
const image = fs.readFileSync(new URL(environment.layers[0].url));

assert.equal(image.readUInt32BE(16), environment.width);
assert.equal(image.readUInt32BE(20), environment.height);
assert.equal(environment.foreground.sourceKey, environment.layers[0].key);
assert.ok(environment.foreground.depth > 4000);

for (const [width, height] of [[2400, 1080], [960, 432]]) {
  const floor = getDelveArena(environment, width, height);
  assert.ok(floor.topLeftX < floor.topRightX);
  assert.ok(floor.bottomLeftX < floor.bottomRightX);
  assert.ok(floor.topY < floor.bottomY);
  assert.ok(floor.bottomY < height * 0.88, 'Combat floor stays above the party HUD');
}

for (const polygon of environment.foreground.polygons) {
  assert.ok(polygon.length >= 3);
  for (const [x, y] of polygon) {
    assert.ok(x >= 0 && x <= environment.width);
    assert.ok(y >= 0 && y <= environment.height);
  }
}

// ... expands these entries into the new list or call. It does not deep-copy the objects
// inside.
for (const effect of [...environment.denEffects.lanterns,
  ...environment.denEffects.candles, ...environment.denEffects.fungi]) {
  assert.ok(effect.x >= 0 && effect.x <= environment.width);
  assert.ok(effect.y >= 0 && effect.y <= environment.height);
}

for (const surface of environment.denEffects.waterSurfaces) {
  assert.ok(surface.x >= 0 && surface.x + surface.width <= environment.width);

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound. map builds one output entry for each input entry, in
  // the same order. The callback's return value becomes that output entry.
  assert.ok(surface.y >= 0 && surface.y + surface.height <= Math.min(...environment.walkable.map(p => p[1])));
  assert.ok(surface.width > 24 && surface.height > 8 && surface.speed > 0);
}

for (const fall of environment.denEffects.waterfalls) {
  assert.ok(fall.x >= 0 && fall.x + fall.width <= environment.width);
  assert.ok(fall.y >= 0 && fall.y + fall.height < Math.min(...environment.walkable.map(p => p[1])));
  assert.ok(fall.speed > 0);
}

const graphics = [];
const scene = {
  add: { graphics: () => {
    const graphic = {
      rectangles: [], destroyed: false,

      // We handle fill style here, keeping this operation in one place for its callers.
      fillStyle() { return this; }, fillEllipse() { return this; },

      // We handle fill rect here, keeping this operation in one place for its callers.
      fillRect(...args) {
        this.rectangles.push(args);
        return this;
      },

      // We bring position up to date here. The assignments below are the new values other
      // code will read after this step.
      setPosition() { return this; }, setScale() { return this; },

      // We bring depth up to date here. The assignments below are the new values other
      // code will read after this step. depth controls draw order; higher values draw over
      // lower values.
      setDepth(depth) {
        this.depth = depth;
        return this;
      },

      // We bring alpha up to date here. The assignments below are the new values other
      // code will read after this step.
      setAlpha(alpha) {
        this.alpha = alpha;
        return this;
      },

      // We handle clear here, keeping this operation in one place for its callers.
      clear() {
        this.rectangles = [];
        return this;
      },

      // We release the objects and handlers owned here. Scene changes can happen more than
      // once, so cleanup must not leave a listener or timer operating on a screen that has
      // already gone away.
      destroy() { this.destroyed = true; }
    };

    graphics.push(graphic);
    return graphic;
  } },

  events: new EventEmitter(), combatPaused: false
};

const effects = createDenEnvironmentEffects(scene, environment.denEffects,
  { x: 0, y: 0, scale: 1 });
assert.ok(graphics[0].rectangles.length > 0, 'Waterfall draws moving highlights');

// some stops with true as soon as one entry passes the check; an empty list gives false.
assert.ok(graphics[0].rectangles.some(([, y, width]) => width >= 8 && y >= 416 && y <= 506),
  'Pool surfaces draw moving highlights');
assert.notEqual(graphics[1].alpha, graphics[2].alpha, 'Lanterns flicker independently');
assert.notEqual(graphics[7].alpha, graphics[8].alpha, 'Candles flicker independently');

// every requires all entries to pass the check; an empty list gives true.
assert.ok(graphics.slice(11).every(graphic => graphic.depth > environment.foreground.depth),
  'Foreground mushroom glows stay visible above the root layer');
const firstFrame = graphics[0].rectangles.map(rect => rect.join(',')).join('|');
scene.events.emit('update', 0, 100);
assert.notEqual(graphics[0].rectangles.map(rect => rect.join(',')).join('|'), firstFrame);
scene.combatPaused = true;
const pausedFrame = graphics[0].rectangles.map(rect => rect.join(',')).join('|');
const pausedGlows = graphics.slice(1).map(graphic => graphic.alpha);
scene.events.emit('update', 0, 100);
assert.equal(graphics[0].rectangles.map(rect => rect.join(',')).join('|'), pausedFrame);
assert.deepEqual(graphics.slice(1).map(graphic => graphic.alpha), pausedGlows);
scene.events.emit('shutdown');
assert.ok(effects.objects.every(graphic => graphic.destroyed));

console.log('Dolmark Den environment and progression checks passed.');
