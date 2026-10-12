// Check the cosmetic clock and cleanup without allocating a Phaser renderer.
import assert from 'node:assert/strict';
import { createLevelUpEffect, updateLevelUpEffects, clearLevelUpEffects } from '../combat/LevelUpEffect.js';

function drawing() {
  return {
    width: 260, active: true,
    setOrigin() { return this; }, setDepth() { return this; }, setName() { return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setAlpha(alpha) { this.alpha = alpha; return this; },
    clear() { this.stars = 0; return this; }, fillStyle() { return this; },
    fillPoints() { this.stars++; return this; }, destroy() { this.active = false; }
  };
}
const scene = {
  game: {}, time: { now: 100 }, scale: { width: 2400 },
  battlefield: { topY: 100, arenaToScreen: (x, y) => ({ x, y }) },
  add: { text: () => drawing(), graphics: () => drawing() }
};
const unit = { arenaX: 500, arenaY: 600, container: { active: true, scaleX: 1 } };
assert.equal(createLevelUpEffect(scene, unit), true);
const effect = scene.levelUpEffects[0];
assert.equal(effect.sparkles.stars, 8);
const startY = effect.label.y;
unit.arenaX += 80;
scene.time.now += 2000;
updateLevelUpEffects(scene);
assert.equal(effect.label.x, 580);
assert.ok(effect.label.y < startY);
assert.equal(effect.label.alpha, 1);

// Simultaneous neighboring level-ups use different rows without reducing text size.
const neighbor = { ...unit, arenaX: unit.arenaX + 100 };
createLevelUpEffect(scene, neighbor);
assert.ok(Math.abs(scene.levelUpEffects[1].label.y - effect.label.y) >= 90);
scene.levelUpEffects[1].startedAt = effect.startedAt;

// A paused combat clock repeats the same pose, including sparkle phases and opacity.
const pausedY = effect.label.y;
updateLevelUpEffects(scene);
assert.equal(effect.label.y, pausedY);
scene.time.now = 3700;
updateLevelUpEffects(scene);
assert.equal(effect.label.alpha, 0.5);
scene.time.now = 4100;
updateLevelUpEffects(scene);
assert.equal(scene.levelUpEffects.length, 0);
assert.equal(effect.label.active, false);
assert.equal(effect.sparkles.active, false);

// Another level refreshes one label, and replay never leaves historical artwork alive.
createLevelUpEffect(scene, unit);
createLevelUpEffect(scene, unit);
assert.equal(scene.levelUpEffects.length, 1);
scene.game.backgroundProgress = { isReplaying: true };
updateLevelUpEffects(scene);
assert.equal(scene.levelUpEffects.length, 0);
assert.equal(createLevelUpEffect(scene, unit), false);
scene.game.backgroundProgress.isReplaying = false;
scene.idleSimulating = true;
assert.equal(createLevelUpEffect(scene, unit), false);
scene.idleSimulating = false;
createLevelUpEffect(scene, unit);
const last = scene.levelUpEffects[0];
clearLevelUpEffects(scene);
assert.equal(last.label.active, false);
assert.equal(last.sparkles.active, false);
console.log('Level-up feedback follows characters, holds, pauses, fades and cleans up.');
