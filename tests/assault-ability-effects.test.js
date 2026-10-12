import assert from 'node:assert/strict';
import { createPhysicalAbilityEffect, updatePhysicalAbilityEffects, clearPhysicalAbilityEffects } from '../combat/PhysicalAbilityEffects.js';
import { updateAbilityEffects } from '../combat/AbilityEffect.js';

// Exercise multiple landed recipients, actual movement, saved periodic state and cleanup.
const caster = { id: 'caster', alive: true, arenaX: 100, arenaY: 100, status: {} };
const enemy = { id: 'enemy', alive: true, arenaX: 400, arenaY: 100, status: {} };
const other = { id: 'other', alive: true, arenaX: 500, arenaY: 160, status: {} };
const scene = { game: {}, time: { now: 0 }, partyUnits: [caster], enemies: [enemy, other],
  battlefield: { arenaToScreen: (x, y) => ({ x, y: y * 0.5 }) },
  textures: { exists: () => true, get: () => ({ setFilter() {} }) },
  add: { image() {
    return { active: true, frame: 0, setOrigin() { return this; },
      setFrame(value) { this.frame = value; return this; }, setFlipX() { return this; },
      setPosition(x, y) { this.x = x; this.y = y; return this; }, setScale() { return this; },
      setRotation(value) { this.rotation = value; return this; }, setDepth(value) { this.depth = value; return this; },
      setAlpha(value) { this.alpha = value; return this; }, destroy() { this.active = false; } };
  } } };
const bounds = (scene, unit) => ({ left: unit.arenaX - 40, right: unit.arenaX + 40, top: unit.arenaY - 100, bottom: unit.arenaY });
const update = delta => updatePhysicalAbilityEffects(scene, delta, bounds);
const ability = name => ({ id: 'ability_v2_generic_physical_' + name });
createPhysicalAbilityEffect(scene, caster, enemy, ability('cleave'), [other, other]);
assert.equal(scene.physicalAssaultEffects.length, 1);
assert.equal(scene.physicalAssaultEffects[0].target, other, 'Artwork follows the actual landed recipient');
update(800);
const cleave = scene.physicalAssaultEffects[0];
assert.equal(cleave.fadeElapsed, 100, 'Only the leftover part of a long frame advances fading');
assert(cleave.image.active && cleave.image.alpha > 0 && cleave.image.alpha < 0.85);
scene.combatPaused = true;
const frame = cleave.image.frame;
update(2000);
assert.equal(cleave.fadeElapsed, 100);
assert.equal(cleave.image.frame, frame);
scene.combatPaused = false;
update(300);
assert(!cleave.image.active);

caster.charge = { ability: ability('charge'), startX: 100, startY: 100, point: { x: 400, y: 100 } };
update(100);
const trail = scene.physicalAssaultEffects[0];
assert.equal(trail.type, 'charge-trail');
assert(trail.image.x < caster.arenaX, 'Charge streaks sit behind the moving body');
assert.equal(trail.image.rotation, 0);
const x = trail.image.x;
caster.arenaX += 50;
update(0);
assert.equal(trail.image.x, x + 50);
caster.charge = null;
update(200);
assert.equal(trail.fadeElapsed, 200, 'Canceled movement fades its trail');
assert(trail.image.active);
update(200);
assert(!trail.image.active);
assert.equal(scene.physicalAssaultEffects.length, 0, 'Cancellation does not invent an impact');

caster.charge = { ability: ability('charge'), startX: 400, startY: 100, point: { x: 100, y: 300 } };
update(0);
assert(scene.physicalAssaultEffects[0].image.rotation > Math.PI / 2, 'Diagonal and leftward trails face actual screen movement');
clearPhysicalAbilityEffects(scene);
caster.charge = null;

enemy.status.replacementPeriodic = [{ ability: ability('lacerate'), kind: 'damage', remaining: 3, until: 6000 }];
update(200);
const wound = scene.physicalAssaultEffects[0];
assert.equal(wound.type, 'lacerate-status', 'Saved Lacerate restores its current cue');
assert(wound.image.x > enemy.arenaX + 40, 'Lasting scratches leave the body readable');
enemy.status.replacementPeriodic = [];
update(100);
assert.equal(wound.fadeElapsed, 100, 'Cleanse fades the existing cue');
const woundFrame = wound.image.frame;
update(100);
assert.equal(wound.image.frame, woundFrame, 'A fading loop retains its visible frame');
update(200);
assert(!wound.image.active);

for (const name of ['charge', 'kick', 'lacerate']) createPhysicalAbilityEffect(scene, caster, enemy, ability(name));
update(0);
const strikes = [...scene.physicalAssaultEffects];
enemy.alive = false;
update(200);
assert(strikes.every(effect => effect.image.active && effect.fadeElapsed === 200));
update(200);
assert(strikes.every(effect => !effect.image.active));
enemy.alive = true;
createPhysicalAbilityEffect(scene, caster, enemy, ability('kick'));
const replay = scene.physicalAssaultEffects[0];
updateAbilityEffects(scene, 0, true);
assert(!replay.image.active && scene.physicalAssaultEffects.length === 0, 'Replay clears Assault art even without other active effects');
console.log('Assault effects track recipients, directions, periodic state, pause, cancellation, fading and replay.');
