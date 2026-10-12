import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAGICAL_ASSAULT_EFFECTS } from '../data/magicalAssaultEffects.js';
import { findAbilityEffect } from '../data/abilityEffects.js';
import { createAbilityEffect, createAbilityTelegraph, updateAbilityEffects, clearAbilityEffects } from '../combat/AbilityEffect.js';

// A small Phaser stand-in checks the real lifecycle without a browser or wall clock.
function makeScene() {
  const scene = { game: {}, time: { now: 0 }, partyUnits: [], enemies: [],
    events: { once() {} }, textures: { exists: () => true, get: () => ({ setFilter() {} }) },
    battlefield: { logicalWidth: 1000, arenaToScreen: (x, y) => ({ x, y, widthAtDepth: 1000 }) },
    add: { graphics() { throw new Error('Direct magical Assault spells must not launch traveling drawings'); }, image() {
      return { active: true, setOrigin() { return this; }, setScale() { return this; },
        setDepth() { return this; }, setVisible() { return this; },
        setAlpha(alpha) { this.alpha = alpha; return this; },
        setFrame(frame) { this.frame = frame; return this; },
        setPosition(x, y) { this.x = x; this.y = y; return this; },
        destroy() { this.active = false; } };
    } } };
  return scene;
}

for (const definition of MAGICAL_ASSAULT_EFFECTS) {
  const scene = makeScene();
  const caster = { className: 'Everbright Cleric', alive: true };
  const target = { alive: true, arenaX: 500, arenaY: 400, status: {} };
  const ability = { id: definition.abilityId, name: definition.abilityName, replacement: true,
    shape: definition.abilityName === 'Vengeance' ? 'Circle' : 'None', radius: 200, anchor: 'Target' };
  scene.enemies = [target];
  target.status.replacementEffects = [{ key: `${ability.id}:secondary:harmful`, until: 8000 }];
  assert.equal(findAbilityEffect(caster, ability), definition, 'Generic artwork follows the skill ID, regardless of caster class');
  assert.equal(findAbilityEffect(caster, ability, true), undefined, 'No unconfirmed projectile impacts');

  // All four have direct delivery despite their ranged targeting. This also checks
  // the shared travel dispatcher, so future projectile work cannot add flights here.
  const action = { duration: 300, startAt: 0 };
  caster.pendingAction = action;
  assert.equal(createAbilityTelegraph(scene, caster, target, ability, action), false);

  // PNG headers and cell geometry confirm all 32 frames are bundled locally.
  const clip = definition.clips[0];
  const png = readFileSync(new URL(clip.url));
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.equal(width % clip.width, 0);
  assert.equal(height % clip.height, 0);
  assert(width / clip.width * height / clip.height >= 32);
  assert.equal(definition.frameMs, 1000 / 24);
  assert(createAbilityEffect(scene, caster, target, ability));
  const effect = scene.abilityEffects[0], image = effect.pieces[0].image;
  updateAbilityEffects(scene, 200);
  scene.combatPaused = true;
  const frame = image.frame;
  updateAbilityEffects(scene, 1000);
  assert.equal(image.frame, frame, 'Pause freezes animation');
  scene.combatPaused = false;

  if (definition.persistentStatus) {
    const x = image.x;
    target.arenaX += 80;
    updateAbilityEffects(scene, 0);
    assert.equal(image.x, x + 80, 'Status artwork follows its recipient');
    createAbilityEffect(scene, caster, target, ability);
    assert.equal(scene.abilityEffects.length, 1, 'Refreshing a status never stacks artwork');
    target.status.replacementEffects = [];
    updateAbilityEffects(scene, 0);
    updateAbilityEffects(scene, 200);
    assert(image.active && image.alpha > 0 && image.alpha < definition.opacity, 'Removed statuses visibly fade');
    scene.combatPaused = true;
    const alpha = image.alpha;
    updateAbilityEffects(scene, 1000);
    assert.equal(image.alpha, alpha, 'Pause freezes the fade');
    scene.combatPaused = false;
    target.status.replacementEffects = [{ key: `${ability.id}:secondary:harmful`, until: 8000 }];
    updateAbilityEffects(scene, 0);
    assert.equal(scene.abilityEffects.length, 1);
    assert.equal(image.alpha, definition.opacity, 'Reapplication rescues a fading mark');
    target.alive = false;
    updateAbilityEffects(scene, 0);
    updateAbilityEffects(scene, 400);
    assert(!image.active, 'Death finishes with a fade');
    target.alive = true;
    updateAbilityEffects(scene, 0);
    assert.equal(scene.abilityEffects.length, 1, 'Saved active statuses rebuild their artwork');
    scene.time.now = 8000;
    updateAbilityEffects(scene, 0);
    updateAbilityEffects(scene, 400);
    assert.equal(scene.abilityEffects.length, 0, 'Expiry releases the faded sheet');
  } else {
    updateAbilityEffects(scene, definition.holdMs);
    assert(image.active && image.alpha < definition.opacity, 'Brief strikes fade during their final frames');
    updateAbilityEffects(scene, 400);
    assert.equal(scene.abilityEffects.length, 0);
  }
  clearAbilityEffects(scene);
  updateAbilityEffects(scene, 0, true);
  assert.equal(scene.abilityEffects.length, 0, 'Historical replay creates no artwork');
  scene.idleSimulating = true;
  assert.equal(createAbilityEffect(scene, caster, target, ability), false);
}
console.log('Magical Assault sheets, fitting, refresh, expiry, death, pause, fade and restored statuses passed.');
