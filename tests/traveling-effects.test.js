// Travel is cosmetic: endpoints, pause, interruption and restoration must not
// change the action's scheduled gameplay time or create duplicate projectiles.
import assert from 'node:assert/strict';
import { rangedTravelProfile } from '../data/rangedTravelEffects.js';
import { startTravelingEffect, updateTravelingEffects, finishTravelingEffect, travelPose } from '../combat/TravelingEffects.js';

function fixture() {
  const drawings = [];
  const scene = { game: {}, time: { now: 0 }, battlefield: {
    arenaToScreen: (x, y) => ({ x, y }) }, textures: { exists: () => false },
    events: { once(name, callback) { scene.shutdown = callback; } },
    add: { graphics() {
      const graphics = { active: true };
      for (const name of ['clear', 'lineStyle', 'fillStyle', 'beginPath', 'moveTo', 'lineTo',
        'strokePath', 'lineBetween', 'fillCircle', 'fillTriangle', 'fillRect']) graphics[name] = () => graphics;
      graphics.setAlpha = value => { graphics.alpha = value; return graphics; };
      graphics.setVisible = value => { graphics.visible = value; return graphics; };
      graphics.setDepth = value => { graphics.depth = value; return graphics; };
      graphics.destroy = () => { graphics.active = false; };
      drawings.push(graphics);
      return graphics;
    } }, drawings };
  return scene;
}

for (const name of ['Piercing Shot', 'Magic Missile', 'Stone Spit', 'Refraction Beam', 'Whip Lash']) {
  const scene = fixture();
  const caster = { id: 'caster', alive: true, arenaX: 100, arenaY: 300, className: 'Ranger' };
  const target = { id: 'target', alive: true, arenaX: 500, arenaY: 300 };
  const action = { startAt: 0, duration: 1000 };
  caster.pendingAction = action;
  const ability = { name };
  assert(startTravelingEffect(scene, caster, target, ability, action));
  assert(startTravelingEffect(scene, caster, target, ability, action));
  assert.equal(scene.travelingEffects.length, 1);
  const effect = scene.travelingEffects[0];
  assert.equal(effect.graphics.visible, false, 'Long casts prepare before releasing');
  updateTravelingEffects(scene, 480);
  updateTravelingEffects(scene, 260);
  assert(effect.pose.x > 100 && effect.pose.x < 500);
  if (name === 'Stone Spit') assert(effect.pose.y < effect.from.y, 'Thrown stone rises above its direct path');
  const mid = { ...effect.pose };
  scene.combatPaused = true;
  updateTravelingEffects(scene, 2000);
  assert.deepEqual(effect.pose, mid);
  scene.combatPaused = false;
  target.arenaX = 600;
  scene.time.now = 1000;
  finishTravelingEffect(scene, caster, action);
  assert.equal(effect.pose.x, 600, 'Arrival tracks the recipient at the actual damage deadline');
  assert.equal(effect.pose.y, 235);
  caster.pendingAction = null;
  updateTravelingEffects(scene, 200);
  assert.equal(effect.graphics.alpha, 0.5);
  scene.combatPaused = true;
  updateTravelingEffects(scene, 1000);
  assert.equal(effect.graphics.alpha, 0.5);
  scene.combatPaused = false;
  updateTravelingEffects(scene, 200);
  assert.equal(effect.graphics.active, false);
}

const scene = fixture();
const caster = { id: 'a', alive: true, arenaX: 500, arenaY: 300, className: 'Ranger', attackRange: 600 };
const target = { id: 'b', alive: true, arenaX: 100, arenaY: 300 };
caster.pendingAction = { startAt: 0, duration: 300 };
assert(startTravelingEffect(scene, caster, target, { name: 'Attack' }, caster.pendingAction));
updateTravelingEffects(scene, 150);
const flight = scene.travelingEffects[0];
assert(Math.abs(flight.pose.angle) > 3, 'An arrow shot to the left points left');
const canceledPoint = { ...flight.pose };
caster.pendingAction = null;
updateTravelingEffects(scene, 0);
updateTravelingEffects(scene, 100);
assert.deepEqual(flight.pose, canceledPoint, 'Interrupted projectiles fade without traveling to a false impact');
updateTravelingEffects(scene, 300);
assert.equal(scene.travelingEffects.length, 0);

// A saved event recreates only its still-current action, at its existing elapsed time.
caster.pendingAction = { startAt: 0, duration: 1000 };
scene.time.now = 740;
scene.partyUnits = [caster];
scene.enemies = [target];
scene.battleEvents = new Set([{ data: { kind: 'attack', unitId: 'a', targetId: 'b', actionStartAt: 0 } }]);
updateTravelingEffects(scene, 0);
assert.equal(scene.travelingEffects.length, 1);
assert.equal(scene.travelingEffects[0].elapsed, 740);
updateTravelingEffects(scene, 0);
assert.equal(scene.travelingEffects.length, 1);
updateTravelingEffects(scene, 0, true);
assert.equal(scene.travelingEffects.length, 0);
scene.battleEvents.clear();
assert(startTravelingEffect(scene, caster, target, { name: 'Attack' }, caster.pendingAction));
scene.shutdown();
assert(scene.drawings.every(drawing => !drawing.active));

const start = { x: 0, y: 0 }, end = { x: 400, y: 40 };
for (const profile of [{ arc: true }, { curve: true }, {}]) {
  assert.equal(travelPose(start, end, 0, profile).x, 0);
  assert.equal(travelPose(start, end, 1, profile).x, 400);
  assert(Math.abs(travelPose(start, end, 1, profile).y - 40) < 0.0001);
}
for (const name of ['Life Anchor', 'Rejuvenation Aura', 'Smite', 'Mindfire', 'Entangling Roots', 'Vengeance']) {
  assert.equal(rangedTravelProfile(caster, { name }), null, `${name} resolves directly rather than inventing a thrown object`);
}
console.log('Ranged travel: straight, arced and curved endpoints, pause, fade, cancellation and saved restoration passed.');
