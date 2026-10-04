import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import delves from '../data/delves.js';
import slimeCave from '../data/levels/SlimeCave.js';
import { getDelveGridFloor } from '../combat/LayeredEnvironment.js';
import { createDenEnvironmentEffects } from '../combat/DenEnvironmentEffects.js';

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

for (const effect of [...environment.denEffects.lanterns,
  ...environment.denEffects.candles, ...environment.denEffects.fungi]) {
  assert.ok(effect.x >= 0 && effect.x <= environment.width);
  assert.ok(effect.y >= 0 && effect.y <= environment.height);
}

for (const surface of environment.denEffects.waterSurfaces) {
  assert.ok(surface.x >= 0 && surface.x + surface.width <= environment.width);
  assert.ok(surface.y >= 0 && surface.y + surface.height < slimeCave.visuals.environment.floor.topY);
  assert.ok(surface.width > 24 && surface.height > 8 && surface.speed > 0);
}

for (const fall of environment.denEffects.waterfalls) {
  assert.ok(fall.x >= 0 && fall.x + fall.width <= environment.width);
  assert.ok(fall.y >= 0 && fall.y + fall.height < slimeCave.visuals.environment.floor.topY);
  assert.ok(fall.speed > 0);
}

const graphics = [];
const scene = {
  add: { graphics: () => {
    const graphic = {
      rectangles: [], destroyed: false,
      fillStyle() { return this; }, fillEllipse() { return this; },
      fillRect(...args) { this.rectangles.push(args); return this; },
      setPosition() { return this; }, setScale() { return this; },
      setDepth(depth) { this.depth = depth; return this; },
      setAlpha(alpha) { this.alpha = alpha; return this; },
      clear() { this.rectangles = []; return this; },
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
assert.ok(graphics[0].rectangles.some(([, y, width]) => width >= 8 && y >= 416 && y <= 506),
  'Pool surfaces draw moving highlights');
assert.notEqual(graphics[1].alpha, graphics[2].alpha, 'Lanterns flicker independently');
assert.notEqual(graphics[7].alpha, graphics[8].alpha, 'Candles flicker independently');
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
