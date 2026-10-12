// Check the animation lifecycle and fixed ground placement without a renderer.
// These checks use saved status shapes, so they cover reloads as well as new casts.
import assert from 'node:assert/strict';
import { VERDANT_CLERIC_EFFECTS } from '../data/verdantClericEffects.js';
import { findAbilityEffect } from '../data/abilityEffects.js';
import { replacementAbilities } from '../data/replacementAbilities.js';
import { createAbilityEffect, updateAbilityEffects, clearAbilityEffects } from '../combat/AbilityEffect.js';
import { rangedTravelProfile } from '../data/rangedTravelEffects.js';

const kit = replacementAbilities('Cleric of the Verdant Covenant');

function fixture() {
  return { game: {}, time: { now: 100 }, currentWaveIndex: 0, partyUnits: [], enemies: [],
    events: { once() {} }, textures: { exists: () => true, get: () => ({ setFilter() {} }) },
    battlefield: { logicalWidth: 1000, arenaToScreen: (x, y) => ({ x, y, widthAtDepth: 1000 }),
      getGroundEllipseRadii: radius => ({ width: radius, height: radius * 0.4 }) },
    add: { image() {
      const image = { active: true };
      image.setOrigin = () => image;
      image.setScale = (x, y) => { image.scaleX = x; image.scaleY = y; return image; };
      image.setDepth = value => { image.depth = value; return image; };
      image.setCrop = (x, y, width, height) => { image.crop = { x, y, width, height }; return image; };
      image.setVisible = value => { image.visible = value; return image; };
      image.setAlpha = value => { image.alpha = value; return image; };
      image.setFrame = value => { image.frame = value; return image; };
      image.setPosition = (x, y) => { image.x = x; image.y = y; return image; };
      image.destroy = () => { image.active = false; };
      return image;
    } } };
}

assert.equal(VERDANT_CLERIC_EFFECTS.length, 12);
for (const definition of VERDANT_CLERIC_EFFECTS) {
  const scene = fixture();
  const caster = { id: 'caster', alive: true, arenaX: 100, arenaY: 200, status: {} };
  const recipient = { id: 'recipient', alive: true, arenaX: 400, arenaY: 300, status: {} };
  scene.partyUnits = [caster, recipient];
  const ability = kit[definition.abilityId];
  assert(ability, 'Every effect binds to the current catalog');
  assert.equal(findAbilityEffect(caster, ability), definition);
  const target = definition.groundZone ? caster : recipient;
  const record = { ability, until: 6100, wave: 0, point: { arenaX: 500, arenaY: 350 } };
  if (definition.verdantStatus === 'modifier') target.status.replacementEffects = [{ key: ability.id + ':beneficial', until: 6100 }];
  if (definition.verdantStatus === 'root') target.status.rootedUntil = 6100;
  if (definition.verdantStatus === 'zone') target.status.replacementZones = [record];
  if (definition.verdantStatus === 'periodic') target.status.replacementPeriodic = [record];
  if (['reaction', 'shield'].includes(definition.verdantStatus)) target.status.replacementReactions = [record];
  if (definition.verdantStatus === 'shield') Object.assign(target.status, { temporaryHp: 50, temporaryHpUntil: 6100 });
  const savedStatus = structuredClone(target.status);
  assert.equal(createAbilityEffect(scene, caster, recipient, ability, [recipient]), true);
  const effect = scene.abilityEffects[0];
  updateAbilityEffects(scene, 500);
  assert.equal(effect.pieces[0].image.frame, 10);
  scene.combatPaused = true;
  updateAbilityEffects(scene, 1000);
  assert.equal(effect.elapsed, 500, 'Pause freezes frame time');
  scene.combatPaused = false;

  if (definition.slug === 'natures-embrace') {
    assert.equal(effect.pieces[1].image.depth - effect.pieces[0].image.depth, 2, 'The body separates rear and front leaves');
    assert.equal(effect.origin.y, 160 + 160 * 0.58, 'Embrace sits at the visible waist');
    assert.equal(effect.pieces[0].image.frame, effect.pieces[1].image.frame);
  }
  if (definition.slug === 'entangling-roots') {
    assert.equal(effect.origin.y, 320, 'Roots wrap the feet rather than the torso');
    assert.equal(effect.pieces[0].image.crop.height + effect.pieces[1].image.crop.height, 96);
  }
  if (definition.slug === 'lifequake') {
    assert.equal(effect.pieces[1].image.visible, false, 'Spreading cracks play before the eruption');
    updateAbilityEffects(scene, 1100);
    assert.equal(effect.pieces[0].image.frame, 31, 'The spread holds its final crack shape');
    assert.equal(effect.pieces[1].image.frame, 0, 'The second effect starts at 1.6 combat seconds');
    assert.equal(effect.pieces[1].image.visible, true);
    assert.equal(effect.pieces[1].image.scaleY, effect.scaleX, 'Light rises upright from the ground');
    assert.notEqual(effect.pieces[0].image.scaleY, effect.pieces[1].image.scaleY);
    scene.combatPaused = true;
    updateAbilityEffects(scene, 1000);
    assert.equal(effect.pieces[1].image.frame, 0, 'Pause freezes the phase change and eruption');
    scene.combatPaused = false;
    updateAbilityEffects(scene, 400);
    assert.equal(effect.pieces[1].image.frame, 8);
    assert(effect.pieces[1].image.depth < effect.pieces[2].image.depth);
  }

  if (definition.groundZone) {
    assert.equal(effect.origin.x, 500);
    assert.equal(effect.scaleX * 37, 200, 'Field fits the saved gameplay radius');
    caster.arenaX += 80;
    recipient.arenaX += 80;
    updateAbilityEffects(scene, 0);
    assert.equal(effect.origin.x, 500, 'Both moving units leave the captured field in place');
    record.point = { arenaX: 600, arenaY: 350 };
    createAbilityEffect(scene, caster, recipient, ability);
    assert.equal(effect.origin.x, 500, 'A replaced field fades at its old point');
    assert.equal(scene.abilityEffects[1].origin.x, 600, 'The recast starts at its new captured ground point');
    assert.equal(scene.abilityEffects.length, 2);
  }
  if (definition.persistentStatus) {
    target.status = {};
    updateAbilityEffects(scene, 0);
  } else updateAbilityEffects(scene, definition.holdMs - effect.elapsed);
  updateAbilityEffects(scene, 200);
  const alpha = effect.pieces[0].image.alpha;
  assert.equal(alpha, definition.opacity * (definition.clips[0].opacity ?? 1) / 2, 'Art fades halfway before cleanup');
  scene.combatPaused = true;
  updateAbilityEffects(scene, 1000);
  assert.equal(effect.pieces[0].image.alpha, alpha, 'Pause freezes the fade');
  scene.combatPaused = false;
  updateAbilityEffects(scene, 200);
  assert.equal(effect.pieces[0].image.active, false);
  clearAbilityEffects(scene);

  // Restored armor, healing and reflection recreate from records. The generic root
  // deadline cannot identify its source, so reload does not guess a Roots visual.
  target.status = savedStatus;
  updateAbilityEffects(scene, 0);
  const restored = definition.persistentStatus && definition.restoreFromStatus !== false;
  assert.equal(scene.abilityEffects.length, restored ? 1 : 0);
  if (definition.groundZone) assert.equal(scene.abilityEffects[0].origin.x, 500);
  updateAbilityEffects(scene, 0, true);
  assert.equal(scene.abilityEffects.length, 0, 'Historical replay immediately releases artwork');

  // Local growth is not a projectile. Only Wrath launches a bolt from the caster.
  const profile = rangedTravelProfile(caster, ability);
  assert.equal(profile?.type ?? null, definition.slug === 'wrath' ? 'bolt' : null);
}
console.log('Verdant Cleric animation lifecycle checks passed');
