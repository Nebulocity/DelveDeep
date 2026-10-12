import assert from 'node:assert/strict';
import { createPhysicalAbilityEffect, updatePhysicalAbilityEffects, clearPhysicalAbilityEffects } from '../combat/PhysicalAbilityEffects.js';

// Exercise saved statuses, one-hit consumption, refresh and paused fading without Phaser.
const caster = { id: 'tank', alive: true, arenaX: 100, status: {} };
const ally = { id: 'ally', alive: true, arenaX: 200, status: {} };
const enemy = { id: 'enemy', alive: true, arenaX: 500, status: {} };
const scene = { time: { now: 0 }, partyUnits: [caster, ally], enemies: [enemy],
  textures: { exists: () => true, get: () => ({ setFilter() {} }) },
  add: { image() {
    return { active: true,
      setFrame(frame) { this.frame = frame; return this; },
      setPosition(x, y) { this.x = x; this.y = y; return this; }, setScale(size) { this.scale = size; return this; },
      setDepth() { return this; }, setAlpha(alpha) { this.alpha = alpha; return this; },
      destroy() { this.active = false; } };
  } } };
const bounds = (scene, target) => ({ left: target.arenaX - 40, right: target.arenaX + 40, top: 50, bottom: 150 });
const update = delta => updatePhysicalAbilityEffects(scene, delta, bounds);
const prefix = 'ability_v2_generic_physical_';
enemy.status.replacementDisarmUntil = 2000;
enemy.status.replacementEffects = [{ key: prefix + 'hamstring:harmful', until: 6000 }];
caster.status.replacementEffects = [{ key: prefix + 'hold_the_line:beneficial', until: 6000 }];
ally.status.replacementIntercept = { ownerId: caster.id, until: 6000 };
update(0);
assert.equal(scene.physicalAbilityEffects.length, 4, 'Saved statuses restore recipient art');

// Nearby allies must not own the tank's badge, even if selected by the AI.
createPhysicalAbilityEffect(scene, caster, ally, { id: prefix + 'hold_the_line' });
update(0);
const holder = scene.physicalAbilityEffects.find(effect => effect.type === 'hold_the_line');
assert.equal(holder.target, caster);
const holderBounds = bounds(scene, caster);
assert(holder.image.x - 24 * holder.image.scale >= holderBounds.left);
assert(holder.image.x + 24 * holder.image.scale <= holderBounds.right);
const badgeX = holder.image.x;
caster.arenaX += 55;
update(0);
assert.equal(holder.image.x, badgeX + 55, 'The badge follows its owner');
createPhysicalAbilityEffect(scene, caster, ally, { id: prefix + 'interpose' });
assert.equal(scene.physicalAbilityEffects.length, 5, 'Interpose adds a brief caster cue');
const cue = scene.physicalAbilityEffects.find(effect => effect.brief);
update(450);
assert(cue.image.active);
assert.equal(cue.fadeElapsed, 0);
update(200);
assert.equal(cue.fadeElapsed, 200);
update(200);
assert(!cue.image.active, 'The brief cue has its own complete fade');
const disarm = scene.physicalAbilityEffects.find(effect => effect.type === 'disarm');
const initialX = disarm.image.x;
enemy.arenaX += 70;
update(0);
assert.equal(disarm.image.x, initialX + 70);
scene.time.now = 2000;
update(100);
assert.equal(disarm.fadeElapsed, 100);
assert(disarm.image.active && disarm.image.alpha > 0);
scene.combatPaused = true;
update(1000);
assert.equal(disarm.fadeElapsed, 100);
scene.combatPaused = false;
enemy.status.replacementDisarmUntil = 4000;
update(0);
assert.equal(disarm.fadeElapsed, null, 'Reapplication reuses the existing motif');
const guard = scene.physicalAbilityEffects.find(effect => effect.target === ally);
delete ally.status.replacementIntercept;
update(200);
assert.equal(guard.fadeElapsed, 200);
assert(guard.image.active);
update(200);
assert(!guard.image.active, 'Consumed Interpose fades before removal');
enemy.alive = false;
update(200);
assert(disarm.image.active);
update(200);
assert(!disarm.image.active);
scene.battleOver = true;
update(200);
assert.equal(scene.physicalAbilityEffects.length, 1);
update(200);
assert.equal(scene.physicalAbilityEffects.length, 0);
scene.battleOver = false;
update(0);
assert.equal(scene.physicalAbilityEffects.length, 1);
const remaining = scene.physicalAbilityEffects[0];
clearPhysicalAbilityEffects(scene);
assert(!remaining.image.active);
assert.equal(scene.physicalAbilityEffects.length, 0);
console.log('Physical effects restore, follow, refresh, pause, consume, fade and clean up.');
