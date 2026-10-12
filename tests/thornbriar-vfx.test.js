import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THORNBRIAR_ABILITY_EFFECTS } from '../data/thornbriarAbilityEffects.js';
import { rangedTravelProfile } from '../data/rangedTravelEffects.js';
import { startTravelingEffect, updateTravelingEffects, clearTravelingEffects } from '../combat/TravelingEffects.js';
import { startThornbriarAbilityEffect, updateThornbriarAbilityEffects, clearThornbriarAbilityEffects } from '../combat/ThornbriarAbilityEffects.js';

// Lightweight images record real placement, frames and cleanup without launching Phaser.
function drawing() {
  const object = { active: true };
  for (const method of ['clear', 'setTint']) object[method] = () => object;
  object.setOrigin = (x, y = x) => { object.originX = x; object.originY = y; return object; };
  object.setScale = (x, y = x) => { object.scaleX = x; object.scaleY = y; return object; };
  object.setPosition = (x, y) => { object.x = x; object.y = y; return object; };
  object.setCrop = (x, y, width, height) => { object.crop = { x, y, width, height }; return object; };
  for (const [method, field] of [['setFrame', 'frame'], ['setAlpha', 'alpha'], ['setDepth', 'depth'],
    ['setVisible', 'visible'], ['setRotation', 'rotation']]) {
    object[method] = value => { object[field] = value; return object; };
  }
  object.destroy = () => { object.active = false; };
  return object;
}

const caster = { id: 'lasher', alive: true, arenaX: 100, arenaY: 200, container: { depth: 300 }, status: {} };
const target = { id: 'hero', alive: true, arenaX: 500, arenaY: 200, container: { depth: 300 }, status: {} };
const scene = { game: {}, time: { now: 0 }, isThornbriarHollow: true, partyUnits: [target],
  battlefield: { logicalWidth: 1000, arenaToScreen: (x, y) => ({ x, y, widthAtDepth: 1000 }),
    getGroundEllipseRadii: radius => ({ width: radius, height: radius * 0.4 }) },
  events: { once() {} }, textures: { exists: () => true, get: () => ({ setFilter() {} }) },
  add: { image: drawing, graphics: drawing } };
const action = { startAt: 0, duration: 500 };
assert.equal(rangedTravelProfile({ name: 'Lasher', attackRange: 300 }, { name: 'Attack' }).sheet, 'thorn-whip',
  'Basic Lasher attacks must use the textured vine too');
caster.pendingAction = action;
assert(startTravelingEffect(scene, caster, target, { name: 'Whip Lash' }, action));
const whip = scene.travelingEffects[0];
assert.equal(whip.sheet.name, 'thorn-whip');
scene.time.now = 250;
updateTravelingEffects(scene, 250);
assert.equal(whip.image.x, caster.arenaX, 'The vine stays attached to its caster');
assert.equal(whip.image.crop.width, 80, 'Only the grown half is visible');
assert.equal(whip.image.scaleY, 1.25, 'Distance stretches length without flattening the thorns');
const frame = whip.image.frame;
scene.combatPaused = true;
updateTravelingEffects(scene, 1000);
assert.equal(whip.image.frame, frame);
scene.combatPaused = false;
target.arenaX = 620;
scene.time.now = 500;
updateTravelingEffects(scene, 250);
assert.equal(whip.image.x + 152 * whip.image.scaleX, 620, 'The tip touches the moving recipient at hit time');
assert.equal(whip.image.crop.width, 156);
clearTravelingEffects(scene);
assert(!whip.image.active && !whip.graphics.active);

// Each impact sheet has exactly the declared playable cells, with no cropped padding.
for (const [name, sheet] of Object.entries(THORNBRIAR_ABILITY_EFFECTS)) {
  const png = readFileSync(new URL(sheet.url));
  assert.equal(png.readUInt32BE(16), sheet.width * 6);
  assert.equal(png.readUInt32BE(20), sheet.height * 6);
  scene.time.now = 1000;
  const center = sheet.area ? { x: 350, y: 260 } : null;
  assert(startThornbriarAbilityEffect(scene, caster, target, { name, radius: 145 }, 'impact', center));
  const effect = scene.thornbriarEffects[0];
  assert(effect.image, `${name} must use its authored artwork`);
  const oldX = effect.image.x;
  target.arenaX += 20;
  scene.time.now = 1100;
  updateThornbriarAbilityEffects(scene);
  assert.equal(effect.image.x, sheet.area ? oldX : oldX + 20, 'Area centers stay fixed while recipient effects follow');
  scene.time.now = 2300;
  updateThornbriarAbilityEffects(scene);
  assert.equal(effect.image.frame, 26);
  assert(effect.image.alpha > 0 && effect.image.alpha < (sheet.opacity ?? 0.9));
  scene.time.now = 2600;
  updateThornbriarAbilityEffects(scene);
  assert(!effect.image.active && !effect.graphics.active);
  assert.equal(scene.thornbriarEffects.length, 0);
}

// A canceled or dead recipient freezes the current impact, then fades both drawings.
scene.time.now = 3000;
startThornbriarAbilityEffect(scene, caster, target, { name: 'Bramble Shroud' }, 'impact');
const bramble = scene.thornbriarEffects[0];
scene.time.now = 3300;
target.alive = false;
updateThornbriarAbilityEffects(scene);
const stoppedFrame = bramble.image.frame;
scene.time.now = 3500;
updateThornbriarAbilityEffects(scene);
assert.equal(bramble.image.frame, stoppedFrame);
assert.equal(bramble.image.alpha, 0.45);
clearThornbriarAbilityEffects(scene);
assert(!bramble.image.active && !bramble.graphics.active);
console.log('Thornbriar textured lash, impact anchors, fixed areas, frames, fades and cleanup passed.');
