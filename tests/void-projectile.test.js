// Exercise the effect's clock and cleanup without Phaser or any gameplay damage.
import assert from 'node:assert/strict';
import { createVoidProjectile, updateVoidProjectiles } from '../combat/VoidProjectile.js';

const image = {
  active: true, x: 0, y: 0,
  setOrigin() { return this; }, setScale() { return this; }, setDepth() { return this; },
  setRotation(value) { this.rotation = value; return this; },
  setTexture(key, frame) { this.frame = frame; return this; },
  setPosition(x, y) { this.x = x; this.y = y; return this; },
  destroy() { this.active = false; }
};
let shutdown;
const scene = {
  textures: { exists: () => true, get: () => ({ setFilter() {} }) },
  add: { image: () => image }, events: { once: (name, callback) => { shutdown = callback; } }
};
const attacker = { x: 0, y: 100, spriteVisual: { definition: { projectile: { key: 'void-bolt', columns: 8, frameMs: 75 } } } };
const target = { x: 180, y: 100 };
assert.equal(createVoidProjectile(scene, {}, target), false);
assert.equal(createVoidProjectile(scene, attacker, target), true);
updateVoidProjectiles(scene, 90);
assert.equal(image.x, 90);
assert.equal(image.frame, 4, 'the full eight-frame bolt sequence spans the short flight');
scene.combatPaused = true;
updateVoidProjectiles(scene, 1000);
assert.equal(image.x, 90, 'Pause holds the flight');
scene.combatPaused = false;
updateVoidProjectiles(scene, 90);
assert.equal(image.active, false);
assert.equal(scene.voidProjectiles.length, 0);
image.active = true;
createVoidProjectile(scene, attacker, target);
updateVoidProjectiles(scene, 0, true);
assert.equal(image.active, false, 'background catch-up discards old effects');
image.active = true;
createVoidProjectile(scene, attacker, target);
shutdown();
assert.equal(image.active, false);
assert.equal(scene.voidProjectiles, null);

// The Keeper's beam reaches its target immediately and shares the same pause/cleanup.
const graphics = {
  active: true, lines: [],
  setDepth() { return this; },
  clear() { this.lines = []; return this; },
  lineStyle() { return this; },
  lineBetween(...points) { this.lines.push(points); return this; },
  destroy() { this.active = false; }
};
scene.add.graphics = () => graphics;
createVoidProjectile(scene, attacker, target, 'beam');
updateVoidProjectiles(scene, 0);
assert.deepEqual(graphics.lines[0], [0, 35, 180, 35]);
scene.combatPaused = true;
updateVoidProjectiles(scene, 1000);
assert.equal(graphics.active, true);
assert.equal(scene.voidProjectiles[0].elapsed, 0);
scene.combatPaused = false;
updateVoidProjectiles(scene, 180);
assert.equal(graphics.active, false);
console.log('Void projectile flight, frame clock, Pause, background and shutdown cleanup passed.');
