import assert from 'node:assert/strict';
import { rangedTravelProfile } from '../data/rangedTravelEffects.js';
import { startTravelingEffect, finishTravelingEffect, updateTravelingEffects, travelPose } from '../combat/TravelingEffects.js';

const caster = { alive: true, arenaX: 100, arenaY: 300, attackRange: 600, className: 'Ranger' };
const target = { alive: true, arenaX: 700, arenaY: 300 };

// The same weapon-reach skill travels only when delivered by a ranged weapon.
assert.equal(rangedTravelProfile(caster, { name: 'Lacerate' }).type, 'arrow');
assert.equal(rangedTravelProfile({ className: 'Barbarian', attackRange: 74 }, { name: 'Lacerate' }), null);
assert.equal(rangedTravelProfile(caster, { name: 'Lacerate', target: 'self' }), null);

// Numeric range alone must not give these stationary skills a moving payload.
for (const name of ['Hex', 'Nullify', 'Spellbind', 'Spellward', "Hunter's Mark", 'Brand',
  'Damper', 'Smite', 'Vengeance', 'Mend', 'Sunlit Ward', 'Entangling Roots', 'Gloomburst',
  'Prism Burst', 'Wrath', 'Bramble Shroud', 'Sinkhole', 'Cleansing Fire']) {
  assert.equal(rangedTravelProfile(caster, { name, castRange: 600, damageType: 'spell' }), null, name);
}
for (const name of ['Piercing Shot', 'Crippling Shot', 'Pinning Arrow', 'Magic Missile',
  'Radiant Bolt', 'Radiant Spear', 'Blood Lance', 'Stone Spit', 'Venom Spit',
  'Seaspray Orb', 'Refraction Beam', 'Judgement Ray', 'Siphon', 'Volley', 'Tray Toss']) {
  assert(rangedTravelProfile(caster, { name }), name);
}

const from = { x: 0, y: 0 }, to = { x: 400, y: 0 };
assert.equal(travelPose(from, to, 0.5, {}).y, 0);
assert(travelPose(from, to, 0.5, { arc: true }).y < -50);
assert.equal(travelPose(from, to, 0, { arc: true }).y, 0);
assert.equal(travelPose(from, to, 1, { arc: true }).y, 0);

function fixture() {
  const graphics = { active: true, destroy() { this.active = false; } };
  for (const name of ['clear', 'setVisible', 'setAlpha', 'setDepth', 'lineStyle', 'beginPath',
    'moveTo', 'lineTo', 'strokePath', 'lineBetween', 'fillStyle', 'fillTriangle', 'fillCircle', 'fillRect']) {
    graphics[name] = function (...args) { this[name + 'Args'] = args; return this; };
  }
  const scene = { game: {}, time: { now: 100 }, combatPaused: false,
    events: { once() {} }, add: { graphics: () => graphics },
    battlefield: { arenaToScreen: (x, y) => ({ x, y }) } };
  const action = { startAt: 100, duration: 1000 };
  caster.pendingAction = action;
  return { scene, action, graphics };
}

// Flights use the current action, wait for release, follow targets and pause fully.
let { scene, action, graphics } = fixture();
assert(startTravelingEffect(scene, caster, target, { name: 'Stone Spit' }, action));
const flight = scene.travelingEffects[0];
assert.equal(graphics.setVisibleArgs[0], false);
caster.arenaX += 20;
updateTravelingEffects(scene, 400);
assert.equal(flight.from.x, caster.arenaX);
updateTravelingEffects(scene, 200);
const position = { ...flight.pose };
scene.combatPaused = true;
updateTravelingEffects(scene, 1000);
assert.deepEqual(flight.pose, position);
scene.combatPaused = false;
caster.arenaX += 20;
target.arenaX += 40;
updateTravelingEffects(scene, 100);
assert.notEqual(flight.from.x, caster.arenaX);
assert.equal(flight.to.x, target.arenaX);

// Interrupted missiles fade where they stop and never pretend to hit the target.
const stopped = { ...flight.pose };
caster.pendingAction = null;
updateTravelingEffects(scene, 0);
assert.deepEqual(flight.pose, stopped);
scene.combatPaused = true;
updateTravelingEffects(scene, 1000);
assert.equal(flight.fadeElapsed, 0);
scene.combatPaused = false;
updateTravelingEffects(scene, 200);
assert.equal(graphics.setAlphaArgs[0], 0.5);
updateTravelingEffects(scene, 200);
assert.equal(scene.travelingEffects.length, 0);
assert.equal(graphics.active, false);

({ scene, action, graphics } = fixture());
startTravelingEffect(scene, caster, target, { name: 'Piercing Shot' }, action);
scene.time.now = action.startAt + action.duration;
finishTravelingEffect(scene, caster, action);
assert.equal(scene.travelingEffects[0].pose.x, target.arenaX);
updateTravelingEffects(scene, 0, true);
assert.equal(graphics.active, false);

// A warning center is ground, not a creature's chest. Moving the threat target
// cannot redirect a launched beam away from the captured warning location.
({ scene, action } = fixture());
const center = { arenaX: 400, arenaY: 280, alive: true, groundDestination: true };
startTravelingEffect(scene, caster, center, { name: 'Stasis Beam' }, action);
assert.equal(scene.travelingEffects[0].to.y, 280);
target.arenaX += 50;
updateTravelingEffects(scene, 500);
assert.equal(scene.travelingEffects[0].to.x, center.arenaX);
assert.equal(scene.travelingEffects[0].to.y, center.arenaY);
console.log('Selective travel, straight/lob geometry, release, tracking, pause, cancellation and replay passed.');
