// Verify restoration, status consumption, measured aura placement and paused fades
// without needing a renderer. Gameplay records remain the source of visual lifetime.
import assert from 'node:assert/strict';
import { createAbilityEffect, updateAbilityEffects, clearAbilityEffects } from '../combat/AbilityEffect.js';
import { GENERIC_RESTORE_EFFECTS } from '../data/genericRestoreEffects.js';
import { findAbilityEffect } from '../data/abilityEffects.js';

function sceneFixture() {
  return {
    game: {}, time: { now: 100 }, currentWaveIndex: 0, combatPaused: false,
    partyUnits: [], enemies: [], events: { once() {} },
    textures: { exists: () => true, get: () => ({ setFilter() {} }) },
    battlefield: { logicalWidth: 1000,
      arenaToScreen: (x, y) => ({ x, y, widthAtDepth: 1000 }),
      getGroundEllipseRadii: radius => ({ width: radius, height: radius * 0.4 }) },
    add: { image() {
      return { active: true,
        setOrigin() { return this; }, setScale(x, y) { this.scaleX = x; this.scaleY = y; return this; },
        setDepth(depth) { this.depth = depth; return this; }, setVisible(value) { this.visible = value; return this; },
        setAlpha(value) { this.alpha = value; return this; }, setFrame(value) { this.frame = value; return this; },
        setCrop(x, y, width, height) { this.crop = { x, y, width, height }; return this; },
        setPosition(x, y) { this.x = x; this.y = y; return this; }, destroy() { this.active = false; }
      };
    } }
  };
}

for (const definition of GENERIC_RESTORE_EFFECTS) {
  const scene = sceneFixture();
  const caster = { id: 'caster', alive: true, arenaX: 100, arenaY: 200, status: {} };
  const ally = { id: 'ally', alive: true, arenaX: 400, arenaY: 300, status: {} };
  scene.partyUnits = [caster, ally];
  const ability = { id: definition.abilityId, name: definition.abilityName, replacement: true,
    anchor: definition.floorAura ? 'Caster' : 'None', radius: 240, shape: definition.floorAura ? 'Circle' : 'None' };
  const target = definition.floorAura ? caster : ally;
  const property = definition.restoreStatus === 'reaction' ? 'replacementReactions'
    : definition.restoreStatus === 'zone' ? 'replacementZones' : 'replacementPeriodic';
  if (definition.persistentStatus) target.status[property] = [{ ability, until: 6100, wave: 0 }];
  assert.equal(findAbilityEffect(caster, ability), definition, 'Generic binding works for any class');
  assert.equal(createAbilityEffect(scene, caster, ally, ability), true);
  const effect = scene.abilityEffects[0];
  assert.equal(effect.target, target);
  updateAbilityEffects(scene, 500);
  assert.equal(effect.pieces[0].image.frame, 12);
  if (definition.floorAura) {
    assert.equal(effect.scaleX * 39, 240);
    assert.equal(effect.scaleY * 19.5, 96);
    assert.equal(effect.pieces[0].image.depth, 299);
  }

  // Two complementary crops share one animation and bracket the sprite's depth.
  if (definition.clips[0].wrapHalf) {
    const [rear, front] = effect.pieces;
    assert.equal(front.image.depth - rear.image.depth, 2);
    assert.equal(rear.image.crop.height, front.image.crop.y);
    assert.equal(rear.image.crop.height + front.image.crop.height, 96);
    assert.equal(rear.image.frame, front.image.frame);
  }
  target.arenaX += 20;
  const previousX = effect.origin.x;
  scene.combatPaused = true;
  updateAbilityEffects(scene, 1000);
  assert.equal(effect.elapsed, 500);
  assert.notEqual(effect.origin.x, previousX);
  scene.combatPaused = false;
  if (definition.persistentStatus) {
    target.status[property][0].until = 0;
    updateAbilityEffects(scene, 0);
  } else updateAbilityEffects(scene, 700);
  updateAbilityEffects(scene, 200);
  assert.equal(effect.pieces[0].image.alpha, 0.4, 'Effect fades halfway before cleanup');
  scene.combatPaused = true;
  updateAbilityEffects(scene, 1000);
  assert.equal(effect.pieces[0].image.alpha, 0.4);
  scene.combatPaused = false;
  updateAbilityEffects(scene, 200);
  assert.equal(effect.pieces[0].image.active, false);
  if (definition.persistentStatus) {
    target.status[property][0].until = 6100;
    updateAbilityEffects(scene, 0);
    assert.equal(scene.abilityEffects.length, 1, 'Saved active statuses recreate their artwork');
    assert.equal(scene.abilityEffects[0].target, target, 'Restored aura uses the real caster position');
    scene.battleOver = true;
    updateAbilityEffects(scene, 0);
    updateAbilityEffects(scene, 200);
    assert.equal(scene.abilityEffects[0].pieces[0].image.alpha, 0.4);
  }
  clearAbilityEffects(scene);
  scene.game.backgroundProgress = { isReplaying: true };
  assert.equal(createAbilityEffect(scene, caster, ally, ability), false);
}

console.log('Generic Restore playback, restoration, aura bounds and paused fades passed.');
