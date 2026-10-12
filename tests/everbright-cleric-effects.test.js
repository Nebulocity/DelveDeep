// Verify paused playback, status restoration and fading with the real catalogs.
import assert from 'node:assert/strict';
import { EVERBRIGHT_CLERIC_EFFECTS } from '../data/everbrightClericEffects.js';
import { findAbilityEffect } from '../data/abilityEffects.js';
import { replacementAbilities } from '../data/replacementAbilities.js';
import { createAbilityEffect, updateAbilityEffects, clearAbilityEffects } from '../combat/AbilityEffect.js';
import { startTravelingEffect, updateTravelingEffects } from '../combat/TravelingEffects.js';

const kit = replacementAbilities('Cleric of the Everbright');

// Minimal drawing objects record only what the animation changes, without Phaser.
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
  return { game: {}, time: { now: 100 }, partyUnits: [], enemies: [], events: { once() {} },
    textures: { exists: () => true, get: () => ({ setFilter() {} }) },
    battlefield: { logicalWidth: 1000, arenaToScreen: (x, y) => ({ x, y, widthAtDepth: 1000 }) },
    add: { image: drawing, graphics: drawing } };
}

for (const definition of EVERBRIGHT_CLERIC_EFFECTS) {
  const scene = fixture();
  const caster = { id: 'caster', alive: true, arenaX: 100, arenaY: 250, status: {} };
  const target = { id: 'target', alive: true, arenaX: 450, arenaY: 250, status: {} };
  scene.partyUnits = [caster, target];
  const ability = { ...kit[definition.abilityId], vfxPhase: definition.vfxPhase };
  assert.equal(findAbilityEffect(caster, ability), definition);
  const kind = definition.everbrightStatus;
  if (kind === 'periodic') target.status.replacementPeriodic = [{ ability, until: 6000 }];
  else if (kind) target.status.replacementEffects = [{ key: ability.id
    + (kind.startsWith('secondary-') ? ':secondary:' + kind.slice(10) : ':' + kind), until: 6000 }];
  if (definition.ward) Object.assign(target.status, { temporaryHp: 50, temporaryHpUntil: 6000, sunlitWardVisualUntil: 6000 });
  const savedStatus = structuredClone(target.status);
  assert(createAbilityEffect(scene, caster, target, ability, [target]));
  const effect = scene.abilityEffects[0];
  updateAbilityEffects(scene, 500);
  assert.equal(effect.pieces[0].image.frame, 10);
  scene.combatPaused = true;
  updateAbilityEffects(scene, 1000);
  assert.equal(effect.elapsed, 500);
  target.arenaX += 30;
  updateAbilityEffects(scene, 0);
  assert.equal(effect.origin.x, 480, 'Recipient artwork follows its moving unit');
  scene.combatPaused = false;
  if (definition.layers) assert.equal(effect.pieces[1].image.depth - effect.pieces[0].image.depth, 2);
  target.status = {};
  if (definition.persistentStatus || definition.ward) updateAbilityEffects(scene, 0);
  else updateAbilityEffects(scene, 700);
  updateAbilityEffects(scene, 200);
  const alpha = effect.pieces[0].image.alpha;
  assert.equal(alpha, definition.opacity * (definition.clips[0].opacity ?? 1) / 2);
  scene.combatPaused = true;
  updateAbilityEffects(scene, 1000);
  assert.equal(effect.pieces[0].image.alpha, alpha);
  scene.combatPaused = false;
  updateAbilityEffects(scene, 200);
  assert.equal(effect.pieces[0].image.active, false);
  clearAbilityEffects(scene);
  target.status = savedStatus;
  updateAbilityEffects(scene, 0);
  assert.equal(scene.abilityEffects.length, definition.persistentStatus || definition.ward ? 1 : 0);
  updateAbilityEffects(scene, 0, true);
  assert.equal(scene.abilityEffects.length, 0);
}

// The ray stays connected and reveals half its length at half the cast. The bolt
// moves independently, follows a moving recipient and freezes during a fade.
for (const suffix of ['radiant_bolt', 'judgement_ray']) {
  const scene = fixture();
  const caster = { alive: true, arenaX: 100, arenaY: 250 };
  const target = { alive: true, arenaX: 500, arenaY: 250 };
  caster.pendingAction = { startAt: 100, duration: 300 };
  const ability = kit['ability_v2_everbright_cleric_' + suffix];
  assert(startTravelingEffect(scene, caster, target, ability, caster.pendingAction));
  updateTravelingEffects(scene, 150);
  const flight = scene.travelingEffects[0];
  assert.equal(flight.pose.x, 300);
  if (suffix === 'judgement_ray') {
    assert.equal(flight.image.x, flight.from.x);
    assert.equal(flight.image.crop.width, 81);
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
console.log('Everbright playback, status, travel, pause and fade checks passed');
