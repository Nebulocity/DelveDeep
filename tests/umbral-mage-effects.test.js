// Focused checks cover animation frames, placement, pause, fade and existing
// resolved callbacks. They do not exercise unrelated balance or gameplay systems.

import assert from 'node:assert/strict';
import { UMBRAL_MAGE_EFFECTS } from '../data/umbralMageEffects.js';
import { replacementAbilities } from '../data/replacementAbilities.js';
import { findAbilityEffect } from '../data/abilityEffects.js';
import { createAbilityEffect, updateAbilityEffects, clearAbilityEffects } from '../combat/AbilityEffect.js';
import { startTravelingEffect, updateTravelingEffects } from '../combat/TravelingEffects.js';
import { retireUmbralDecoy, updateUmbralDecoyEffects } from '../combat/UmbralDecoyEffects.js';
import ReplacementAbilitySystem from '../combat/ReplacementAbilitySystem.js';

const kit = replacementAbilities('Mage of the Umbral Veil');
const PREFIX = 'ability_v2_umbral_mage_';

function fixture() {
  const drawing = () => {
    const image = { active: true };
    for (const name of ['clear', 'lineStyle', 'fillStyle', 'beginPath', 'moveTo', 'lineTo',
      'strokePath', 'lineBetween', 'fillCircle', 'fillTriangle', 'fillRect', 'setOrigin', 'setTint']) image[name] = () => image;
    for (const [method, key] of Object.entries({ setAlpha: 'alpha', setVisible: 'visible', setFrame: 'frame', setDepth: 'depth', setRotation: 'rotation' })) {
      image[method] = value => { image[key] = value; return image; };
    }
    image.setPosition = (x, y) => { Object.assign(image, { x, y }); return image; };
    image.setScale = (x, y = x) => { Object.assign(image, { scaleX: x, scaleY: y }); return image; };
    image.setCrop = (x, y, width, height) => { image.crop = { x, y, width, height }; return image; };
    image.destroy = () => { image.active = false; };
    return image;
  };
  return { game: {}, time: { now: 100 }, currentWaveIndex: 0, partyUnits: [], enemies: [], abilityDecoys: [], events: { once() {} },
    textures: { exists: () => true, get: () => ({ setFilter() {} }) },
    battlefield: { logicalWidth: 1000, arenaToScreen: (x, y) => ({ x, y, widthAtDepth: 1000 }),
      getGroundEllipseRadii: radius => ({ width: radius, height: radius / 2 }) },
    add: { image: drawing, graphics: drawing } };
}

function giveStatus(target, definition, ability) {
  const record = { ability, until: 6000, point: { arenaX: 300, arenaY: 280 }, wave: 0 };
  const kind = definition.umbralStatus;
  if (kind === 'channel') target.status.replacementChannel = record;
  if (kind === 'reaction') target.status.replacementReactions = [record];
  if (kind === 'zone') target.status.replacementZones = [record];
  if (kind === 'preparation') target.status.replacementPreparations = [record];
  if (kind === 'decoy') Object.assign(target, { isDecoy: true, decoyUntil: 6000, decoyWave: 0 });
}

for (const definition of UMBRAL_MAGE_EFFECTS) {
  const scene = fixture();
  const target = { id: 'target', alive: true, arenaX: 450, arenaY: 250, status: {} };
  const caster = definition.targetCaster || definition.groundZone ? target
    : { id: 'caster', alive: true, arenaX: 100, arenaY: 250, status: {} };
  // Retired sheets still support historical battle definitions.
  const ability = { id: definition.abilityId, ...kit[definition.abilityId], vfxPhase: definition.vfxPhase };
  giveStatus(target, definition, ability);
  scene.partyUnits = target.isDecoy ? [caster] : [...new Set([caster, target])];
  if (target.isDecoy) scene.abilityDecoys = [target];
  const savedStatus = structuredClone(target.status);
  assert.equal(findAbilityEffect(caster, ability), definition);
  assert(createAbilityEffect(scene, caster, target, ability));
  const effect = scene.abilityEffects[0];
  updateAbilityEffects(scene, 500);
  assert.equal(effect.pieces[0].image.frame, 10);
  scene.combatPaused = true;
  updateAbilityEffects(scene, 1000);
  assert.equal(effect.elapsed, 500);
  const originalX = effect.origin.x;
  target.arenaX += 30;
  updateAbilityEffects(scene, 0);
  assert.equal(effect.origin.x, definition.groundZone ? originalX : originalX + 30);
  scene.combatPaused = false;
  target.status = {};
  if (target.isDecoy) target.decoyUntil = 0;
  if (definition.persistentStatus) updateAbilityEffects(scene, 0);
  else updateAbilityEffects(scene, 700);
  updateAbilityEffects(scene, 200);
  const half = effect.pieces[0].image.alpha;
  assert.equal(half, definition.opacity / 2);
  scene.combatPaused = true;
  updateAbilityEffects(scene, 1000);
  assert.equal(effect.pieces[0].image.alpha, half);
  scene.combatPaused = false;
  updateAbilityEffects(scene, 200);
  assert.equal(effect.pieces[0].image.active, false);
  clearAbilityEffects(scene);
  target.status = savedStatus;
  if (target.isDecoy) target.decoyUntil = 6000;
  updateAbilityEffects(scene, 0);
  assert.equal(scene.abilityEffects.length, definition.persistentStatus ? 1 : 0);
  updateAbilityEffects(scene, 0, true);
  assert.equal(scene.abilityEffects.length, 0);
}

// Direct flights move; tethers reveal outward from the source. Moving recipients
// change the endpoint while pausing freezes animation and the retirement fade.
for (const suffix of ['shadow_bolt', 'siphon', 'essence_drain']) {
  const scene = fixture();
  const caster = { alive: true, arenaX: 100, arenaY: 250 };
  const target = { alive: true, arenaX: 500, arenaY: 250 };
  caster.pendingAction = { startAt: 100, duration: 300 };
  assert(startTravelingEffect(scene, caster, target, kit[PREFIX + suffix], caster.pendingAction));
  updateTravelingEffects(scene, 150);
  const flight = scene.travelingEffects[0];
  assert.equal(flight.pose.x, 300);
  if (suffix !== 'shadow_bolt') {
    assert.equal(flight.image.x, flight.from.x);
    assert.equal(flight.image.crop.width, 80);
  } else assert.equal(flight.image.x, 300);
  target.arenaX = 600;
  updateTravelingEffects(scene, 150);
  assert.equal(flight.pose.x, 600);
  caster.pendingAction = null;
  updateTravelingEffects(scene, 200);
  assert.equal(flight.image.alpha, 0.5);
  scene.combatPaused = true;
  updateTravelingEffects(scene, 1000);
  assert.equal(flight.image.alpha, 0.5);
  scene.combatPaused = false;
  updateTravelingEffects(scene, 200);
  assert.equal(flight.image.active, false);
}

// Retired decoys are absent from targeting and saves while their drawing fades.
{
  const scene = fixture();
  const decoy = { className: 'Mage of the Umbral Veil', container: scene.add.image(), hitZone: { disableInteractive() {} } };
  decoy.container.setAlpha(0.6);
  retireUmbralDecoy(scene, decoy);
  assert.equal(decoy.umbralVisualRetired, true);
  updateUmbralDecoyEffects(scene, 200);
  assert.equal(decoy.container.alpha, 0.3);
  scene.combatPaused = true;
  updateUmbralDecoyEffects(scene, 1000);
  assert.equal(decoy.container.alpha, 0.3);
  scene.combatPaused = false;
  updateUmbralDecoyEffects(scene, 200);
  assert.equal(decoy.container.active, false);
}

// Special handlers return early, so confirm that their real callbacks start art
// after channel, reaction, drain, summon and revival records have been resolved.
{
  const scene = fixture();
  const calls = [];
  scene.createAbilityEffect = (caster, target, ability) => calls.push({ target, ability });
  const caster = { id: 'mage', className: 'Mage of the Umbral Veil', alive: true, arenaX: 100, arenaY: 200,
    hp: 50, maxHp: 100, mana: 20, maxMana: 100, status: {} };
  const target = { id: 'enemy', alive: true, mana: 80, maxMana: 100, status: {} };
  const system = new ReplacementAbilitySystem({ scene, escapePoint: () => ({ x: 400, y: 300 }) });
  const decoy = { alive: true, status: {}, isDecoy: true };
  scene.createAbilityDecoy = () => decoy;
  system.resolve(caster, caster, kit[PREFIX + 'dark_meditation'], 100);
  system.resolve(caster, caster, kit[PREFIX + 'shadow_trap'], 100);
  system.resolve(caster, target, kit[PREFIX + 'essence_drain'], 100);
  scene.getLivingEnemies = () => [];
  system.resolve(caster, caster, kit[PREFIX + 'shadow_image'], 100);
  const fallen = { alive: false, revive() { this.alive = true; } };
  const revival = Object.values(replacementAbilities('Cleric of the Sanguine Song')).find(ability => ability.name === 'Soul Reclamation');
  system.resolve(caster, fallen, revival, 100);
  assert.deepEqual(calls.map(call => [call.ability.name, call.ability.vfxPhase]), [
    ['Dark Meditation', undefined], ['Shadow Trap', undefined], ['Essence Drain', undefined],
    ['Essence Drain', 'mana'], ['Shadow Image', undefined], ['Soul Reclamation', undefined]
  ]);
  assert.equal(calls[4].target, decoy);
  assert.equal(calls[5].target, fallen);
}
console.log('Umbral frames, placement, status restore, travel, pause, fade and callback checks passed');
