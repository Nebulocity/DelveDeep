import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RANGED_DELIVERY_SHEETS } from '../data/rangedDelivery.js';
import { rangedTravelProfile } from '../data/rangedTravelEffects.js';
import { startTravelingEffect, finishTravelingEffect, updateTravelingEffects, clearTravelingEffects, travelPose } from '../combat/TravelingEffects.js';

// Exercise real sprite flights with lightweight drawing doubles instead of Phaser.
const images = [];
const graphics = () => {
  const object = { active: true, destroy() { this.active = false; } };
  for (const method of ['clear', 'setVisible', 'setAlpha', 'setDepth']) object[method] = () => object;
  return object;
};
const scene = { time: { now: 0 }, game: {},
  battlefield: { arenaToScreen: (x, y) => ({ x, y }) },
  events: { once() {} }, textures: { exists: () => true, get: () => ({ setFilter() {} }) },
  add: { graphics, image(x, y) {
    const image = { x, y, active: true, destroy() { this.active = false; } };
    for (const method of ['setOrigin', 'setScale', 'setTint', 'setDepth']) image[method] = () => image;
    image.setPosition = (x, y) => { Object.assign(image, { x, y }); return image; };
    image.setRotation = rotation => { image.rotation = rotation; return image; };
    image.setFrame = frame => { image.frame = frame; return image; };
    image.setVisible = visible => { image.visible = visible; return image; };
    image.setAlpha = alpha => { image.alpha = alpha; return image; };
    images.push(image);
    return image;
  } } };
const caster = { alive: true, arenaX: 100, arenaY: 100, className: 'Ranger' };
const target = { alive: true, arenaX: 600, arenaY: 100 };
const action = { startAt: 0, duration: 1000 };
caster.pendingAction = action;
assert(startTravelingEffect(scene, caster, target, { name: 'Piercing Shot' }, action));
const arrow = scene.travelingEffects[0];
assert.equal(arrow.sheet.name, 'arrow');
assert.equal(arrow.image.visible, false, 'Long casts hold the projectile until the final flight window');
updateTravelingEffects(scene, 740);
assert.equal(arrow.image.frame, 17);
assert.equal(arrow.image.x, 350);
scene.combatPaused = true;
updateTravelingEffects(scene, 1000);
assert.equal(arrow.image.x, 350);
assert.equal(arrow.image.frame, 17);
scene.combatPaused = false;
target.arenaX = 700;
scene.time.now = 1000;
finishTravelingEffect(scene, caster, action);
assert.equal(arrow.image.x, 700, 'Successful cast lands at the current recipient');
updateTravelingEffects(scene, 200);
assert.equal(arrow.image.alpha, 0.5);
scene.combatPaused = true;
updateTravelingEffects(scene, 1000);
assert.equal(arrow.image.alpha, 0.5);
scene.combatPaused = false;
updateTravelingEffects(scene, 200);
assert.equal(arrow.image.active, false);
assert.equal(scene.travelingEffects.length, 0);

// Cancellation fades at the current point instead of pretending to hit its target.
scene.time.now = 0;
startTravelingEffect(scene, caster, target, { name: 'Blood Lance' }, action);
const lance = scene.travelingEffects[0];
assert.equal(lance.sheet.name, 'lance');
updateTravelingEffects(scene, 740);
const interruptedX = lance.image.x;
caster.pendingAction = null;
updateTravelingEffects(scene, 100);
assert.equal(lance.image.x, interruptedX);
assert(lance.image.alpha < 1 && lance.image.active);
updateTravelingEffects(scene, 0, true);
assert.equal(lance.image.active, false);
caster.pendingAction = action;
startTravelingEffect(scene, caster, target, { name: 'Seaspray Orb' }, action);
const orb = scene.travelingEffects[0];
assert.equal(orb.sheet.name, 'bolt');
clearTravelingEffects(scene);
assert.equal(orb.image.active, false);

// A lob rises at its midpoint and lands exactly on the intended endpoint.
const from = { x: 0, y: 100 }, to = { x: 400, y: 100 };
const profile = rangedTravelProfile(caster, { name: 'Stone Spit' });
assert.equal(travelPose(from, to, 0, profile).y, 100);
assert(travelPose(from, to, 0.5, profile).y < 100);
assert.equal(travelPose(from, to, 1, profile).y, 100);
for (const name of ['Brand', 'Damper', 'Smite', 'Vengeance', 'Arcane Focus', 'Quick Casting', 'Ready Weapon', 'Combat Footwork', 'Bramble Shroud']) {
  assert.equal(rangedTravelProfile(caster, { name, range: 600 }), null, `${name} does not travel solely because of range`);
}
for (const sheet of RANGED_DELIVERY_SHEETS.filter(entry => entry.name !== 'stone')) {
  const png = readFileSync(new URL(sheet.url));
  assert.equal(png.readUInt32BE(16), sheet.width * 6);
  assert.equal(png.readUInt32BE(20), sheet.height * 6);
}
console.log('PixelLab delivery art follows cast travel, pause, tracking, cancellation and fade without adding flights to direct effects.');
