// Check the new art's placement, saved-status lifetime and paused flight/fade clock.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RANGER_ABILITY_EFFECTS, RANGER_FLIGHT_SHEETS } from '../data/rangerAbilityEffects.js';
import { replacementAbilities } from '../data/replacementAbilities.js';
import { findAbilityEffect } from '../data/abilityEffects.js';
import { createAbilityEffect, updateAbilityEffects, clearAbilityEffects } from '../combat/AbilityEffect.js';
import { startTravelingEffect, updateTravelingEffects, finishTravelingEffect } from '../combat/TravelingEffects.js';
import { rangedTravelProfile } from '../data/rangedTravelEffects.js';

const kit = replacementAbilities('Ranger');
function fixture() {
  const drawable = () => {
    const image = { active: true, destroy() { this.active = false; } };
    for (const method of ['setOrigin', 'setTint', 'clear']) image[method] = () => image;
    image.setPosition = (x, y) => { Object.assign(image, { x, y }); return image; };
    image.setScale = (x, y = x) => { Object.assign(image, { scaleX: x, scaleY: y }); return image; };
    for (const [method, property] of [['setRotation', 'rotation'], ['setFrame', 'frame'],
      ['setVisible', 'visible'], ['setAlpha', 'alpha'], ['setDepth', 'depth']]) {
      image[method] = value => { image[property] = value; return image; };
    }
    return image;
  };
  return { game: {}, time: { now: 100 }, partyUnits: [], enemies: [], currentWaveIndex: 0,
    events: { once() {} }, textures: { exists: () => true, get: () => ({ setFilter() {} }) },
    battlefield: { logicalWidth: 1000, arenaToScreen: (x, y) => ({ x, y, widthAtDepth: 1000 }),
      getGroundEllipseRadii: radius => ({ width: radius, height: radius * 0.4 }) },
    add: { image: drawable, graphics: drawable } };
}

for (const definition of RANGER_ABILITY_EFFECTS) {
  const scene = fixture();
  const caster = { id: 'ranger', alive: true, className: 'Ranger', arenaX: 100, arenaY: 300, status: {}, abilities: kit };
  const recipient = { id: 'target', alive: true, arenaX: 500, arenaY: 300, status: {} };
  const target = definition.targetCaster || definition.groundZone ? caster : recipient;
  scene.partyUnits = [caster];
  scene.enemies = [recipient];
  const ability = { ...kit[definition.abilityId], vfxPhase: definition.vfxPhase };
  assert.equal(findAbilityEffect(caster, ability), definition);
  const record = { ability, until: 6100, point: { arenaX: 450, arenaY: 350 }, wave: 0 };
  const kind = definition.rangerStatus;
  if (['beneficial', 'harmful', 'secondary'].includes(kind)) target.status.replacementEffects = [{
    key: ability.id + (kind === 'secondary' ? ':secondary:harmful' : ':' + kind), until: 6100 }];
  if (kind === 'root') target.status.rootedUntil = 6100;
  if (kind === 'zone') target.status.replacementZones = [record];
  if (kind === 'periodic') target.status.replacementPeriodic = [record];
  if (kind === 'preparation') target.status.replacementPreparations = [record];
  const saved = structuredClone(target.status);
  assert(createAbilityEffect(scene, caster, target, ability, [target]));
  const effect = scene.abilityEffects[0];
  updateAbilityEffects(scene, 500);
  assert.equal(effect.pieces[0].image.frame, 10);
  scene.combatPaused = true;
  updateAbilityEffects(scene, 1000);
  assert.equal(effect.elapsed, 500);
  assert.deepEqual(target.status, saved, 'Animation must not modify saved gameplay records');
  scene.combatPaused = false;
  if (definition.groundZone) {
    caster.arenaX += 200;
    recipient.arenaX += 200;
    updateAbilityEffects(scene, 0);
    assert.equal(effect.origin.x, 450, 'An armed trap stays on its saved ground point');
    assert.equal(effect.origin.y, 350);
  }
  if (definition.persistentStatus) {
    clearAbilityEffects(scene);
    updateAbilityEffects(scene, 0);
    assert.equal(scene.abilityEffects.length, definition.restoreFromStatus === false ? 0 : 1);
    if (!scene.abilityEffects.length) createAbilityEffect(scene, caster, target, ability, [target]);
    target.status = {};
    updateAbilityEffects(scene, 0);
    updateAbilityEffects(scene, 200);
  } else updateAbilityEffects(scene, 900);
  const fading = scene.abilityEffects[0];
  assert(Math.abs(fading.pieces[0].image.alpha - definition.opacity * 0.5) < 0.001);
  scene.combatPaused = true;
  updateAbilityEffects(scene, 1000);
  assert(fading.pieces[0].image.active, 'Pause retains the fading artwork');
  scene.combatPaused = false;
  updateAbilityEffects(scene, 200);
  assert.equal(scene.abilityEffects.length, 0);
  assert.equal(fading.pieces[0].image.active, false);
}

// Fly the actual sheets, including all three Volley arrows, through contact and cancellation.
for (const name of ['Piercing Shot', 'Pinning Arrow', 'Crippling Shot', 'Exploding Arrow', 'Volley']) {
  const scene = fixture();
  const caster = { alive: true, className: 'Ranger', arenaX: 100, arenaY: 300 };
  const target = { alive: true, arenaX: 500, arenaY: 300 };
  const ability = Object.values(kit).find(entry => entry.name === name);
  const action = { startAt: 100, duration: 300 };
  caster.pendingAction = action;
  assert(startTravelingEffect(scene, caster, target, ability, action));
  const flight = scene.travelingEffects[0];
  updateTravelingEffects(scene, 150);
  assert.equal(flight.image.x, 300);
  assert.equal(flight.image.frame, 3);
  if (name === 'Volley') {
    assert.equal(flight.volleyImages.length, 2);
    assert(flight.pose.y < (flight.from.y + flight.to.y) / 2, 'Volley rises before landing');
    assert(flight.volleyImages[0].x < flight.image.x && flight.volleyImages[1].x > flight.image.x);
  }
  const midway = { ...flight.pose };
  scene.combatPaused = true;
  updateTravelingEffects(scene, 1000);
  assert.deepEqual(flight.pose, midway);
  scene.combatPaused = false;
  target.arenaX = 600;
  scene.time.now = 400;
  finishTravelingEffect(scene, caster, action);
  assert.equal(flight.image.x, 600);
  caster.pendingAction = null;
  updateTravelingEffects(scene, 200);
  assert.equal(flight.image.alpha, 0.5);
  updateTravelingEffects(scene, 200);
  assert.equal(flight.image.active, false);
  assert((flight.volleyImages ?? []).every(image => !image.active));

  scene.time.now = 100;
  caster.pendingAction = action;
  startTravelingEffect(scene, caster, target, ability, action);
  updateTravelingEffects(scene, 100);
  const canceled = scene.travelingEffects[0];
  const position = { ...canceled.pose };
  caster.pendingAction = null;
  updateTravelingEffects(scene, 100);
  assert.deepEqual(canceled.pose, position, 'Interrupted arrows fade where they stopped');
}
for (const name of ['Camouflage', 'Farsight', 'Field Dressing', "Hunter's Mark", "Hunter's Trap", "Scout's Route", 'Covering Fire']) {
  const ability = Object.values(kit).find(entry => entry.name === name);
  assert.equal(rangedTravelProfile({ className: 'Ranger' }, ability), null);
}
for (const clip of [...RANGER_ABILITY_EFFECTS.flatMap(effect => effect.clips), ...RANGER_FLIGHT_SHEETS]) {
  const png = readFileSync(new URL(clip.url));
  assert.equal(png.readUInt32BE(16), clip.width * 6);
  assert.equal(png.readUInt32BE(20), clip.height * 6);
}
console.log('Ranger artwork, saved statuses, trap placement, flights, pause and fades passed.');
