// Exercise travel against moving recipients and interrupted actions without a renderer.
import assert from 'node:assert/strict';
import { rangedTravelProfile } from '../data/rangedTravelEffects.js';
import { startTravelingEffect, finishTravelingEffect, updateTravelingEffects, travelPose } from '../combat/TravelingEffects.js';
import { startThornbriarAbilityEffect, updateThornbriarAbilityEffects } from '../combat/ThornbriarAbilityEffects.js';

const caster = { name: 'Hedge Mage', alive: true, arenaX: 100, arenaY: 100 };
const target = { alive: true, arenaX: 500, arenaY: 100 };
const from = { x: 100, y: 100 }, to = { x: 500, y: 200 };
const bolt = rangedTravelProfile(caster, { name: 'Briar Bolt' });
const lob = rangedTravelProfile(caster, { name: 'Stone Spit' });
assert.equal(rangedTravelProfile(caster, { name: 'Bramble Shroud' }), null);
const whip = rangedTravelProfile(caster, { name: 'Whip Lash' });
assert.equal(whip.type, 'whip');
assert.equal(bolt.arc, undefined);
assert.equal(lob.arc, true);

// Direct flight reaches the midpoint; a lob rises above it and lands at the same endpoint.
assert.equal(travelPose(from, to, 0.5, bolt).x, 300);
assert.equal(travelPose(from, to, 0.5, bolt).y, 150);
assert(travelPose(from, to, 0.5, lob).y < 100);
assert.equal(travelPose(from, to, 0, lob).y, from.y);
assert.equal(travelPose(from, to, 1, lob).y, to.y);
assert(Math.abs(travelPose(to, from, 0.5, bolt).angle) > Math.PI / 2);
assert(travelPose(from, to, 0.1, lob).angle < travelPose(from, to, 0.9, lob).angle);

function graphics() {
  const drawing = { active: true, alpha: 1 };
  for (const method of ['clear', 'setDepth', 'lineStyle', 'fillStyle', 'beginPath',
    'moveTo', 'lineTo', 'strokePath', 'lineBetween', 'fillCircle', 'fillTriangle', 'fillRect',
    'strokeCircle', 'strokeEllipse', 'fillEllipse']) {
    drawing[method] = () => drawing;
  }
  drawing.setAlpha = alpha => { drawing.alpha = alpha; return drawing; };
  drawing.setVisible = visible => { drawing.visible = visible; return drawing; };
  drawing.destroy = () => { drawing.active = false; };
  return drawing;
}

const scene = {
  game: {}, time: { now: 0 }, combatPaused: false,
  battlefield: { arenaToScreen: (x, y) => ({ x, y }) },
  add: { graphics }, events: { once() {} },
  resolveDamage() { throw new Error('Cosmetic flight must not resolve damage'); }
};
const action = { startAt: 0, duration: 1000 };
caster.pendingAction = action;
const ability = { name: 'Briar Bolt' };
assert(startTravelingEffect(scene, caster, target, ability, action));
assert(startTravelingEffect(scene, caster, target, ability, action));
assert.equal(scene.travelingEffects.length, 1, 'The same cast cannot launch two projectiles');
const effect = scene.travelingEffects[0];
assert.equal(effect.graphics.visible, false, 'Flight waits for the final part of a long cast');
scene.time.now = 740;
updateTravelingEffects(scene, 740);
assert.equal(effect.pose.x, 300);
scene.combatPaused = true;
updateTravelingEffects(scene, 500);
assert.equal(effect.pose.x, 300);
scene.combatPaused = false;
target.arenaX = 600;
scene.time.now = 840;
updateTravelingEffects(scene, 100);
assert(effect.pose.x > 400, 'Flight tracks a recipient who moves during the cast');
scene.time.now = 1000;
finishTravelingEffect(scene, caster, action);
assert.equal(effect.pose.x, 600, 'The flight touches the current target at the scheduled hit');
assert.equal(effect.fadeElapsed, 0);
scene.combatPaused = true;
updateTravelingEffects(scene, 500);
assert.equal(effect.graphics.alpha, 1);
scene.combatPaused = false;
updateTravelingEffects(scene, 200);
assert.equal(effect.graphics.alpha, 0.5);
updateTravelingEffects(scene, 200);
assert.equal(effect.graphics.active, false);

// Interrupting halfway freezes the flight in place while its opacity fades on combat time.
scene.time.now = 2000;
const interrupted = { startAt: 2000, duration: 1000 };
caster.pendingAction = interrupted;
startTravelingEffect(scene, caster, target, { name: 'Stone Spit' }, interrupted);
scene.time.now = 2740;
updateTravelingEffects(scene, 740);
const canceled = scene.travelingEffects[0];
const stopped = { ...canceled.pose };
caster.pendingAction = null;
updateTravelingEffects(scene, 0);
updateTravelingEffects(scene, 200);
assert.deepEqual(canceled.pose, stopped);
assert.equal(canceled.graphics.alpha, 0.5);
updateTravelingEffects(scene, 0, true);
assert.equal(scene.travelingEffects.length, 0);
assert.equal(canceled.graphics.active, false);

// Thornbriar's contact burst shares the flight's chest anchor, including its fallback.
scene.isThornbriarHollow = true;
scene.time.now = 3000;
assert(startThornbriarAbilityEffect(scene, caster, target, ability, 'impact'));
const impact = scene.thornbriarEffects[0];
assert.equal(impact.endX, target.arenaX);
assert.equal(impact.endY, target.arenaY - 65);
updateThornbriarAbilityEffects(scene);
scene.time.now = 3200;
caster.alive = false;
updateThornbriarAbilityEffects(scene);
assert.equal(impact.fadeAt, 3200);
scene.combatPaused = true;
updateThornbriarAbilityEffects(scene);
assert.equal(impact.graphics.alpha, 1);
scene.combatPaused = false;
scene.time.now = 3400;
updateThornbriarAbilityEffects(scene);
assert.equal(impact.graphics.alpha, 0.5);
scene.time.now = 3600;
updateThornbriarAbilityEffects(scene);
assert.equal(impact.graphics.active, false);

// Canceled area windups fade early; replay discards their remaining cosmetic artwork.
caster.alive = true;
caster.pendingAction = { startAt: 3600, duration: 1000 };
assert(startThornbriarAbilityEffect(scene, caster, target, { name: 'Mace Sweep', windup: 1000 }));
scene.time.now = 3800;
caster.pendingAction = null;
updateThornbriarAbilityEffects(scene);
assert.equal(scene.thornbriarEffects[0].stoppedProgress, 0.2);
scene.idleSimulating = true;
const remaining = scene.thornbriarEffects[0].graphics;
updateThornbriarAbilityEffects(scene);
assert.equal(scene.thornbriarEffects.length, 0);
assert.equal(remaining.active, false);

console.log('Thornbriar flight paths, target tracking, arrival, pause and interrupted fades passed.');
