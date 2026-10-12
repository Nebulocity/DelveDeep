import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PREPARE_EFFECT_SHEETS, OATHWARDEN_PREPARE_EFFECT_SHEETS, GLADIATOR_PREPARE_EFFECT_SHEETS,
  prepareEffectActive, createPrepareAbilityEffect,
  updatePrepareAbilityEffects, clearPrepareAbilityEffects } from '../combat/PrepareAbilityEffects.js';
import { updateAbilityEffects } from '../combat/AbilityEffect.js';

// Test status consumption separately from Footwork's ongoing movement bonus.
// Plain image doubles keep combat-clock and cleanup checks independent of Phaser.
const caster = { alive: true, arenaX: 100, status: {
  replacementPreparations: [...PREPARE_EFFECT_SHEETS, OATHWARDEN_PREPARE_EFFECT_SHEETS.find(sheet => sheet.name === 'vow-of-readiness'),
    GLADIATOR_PREPARE_EFFECT_SHEETS.find(sheet => sheet.name === 'rallying-cry')]
    .map(sheet => ({ ability: { id: sheet.abilityId }, until: 8000 })),
  replacementFreeItem: { until: 8000 },
  replacementEffects: [
    { key: 'ability_v2_generic_physical_combat_footwork:beneficial', until: 6000 },
    { key: 'ability_v2_oathwarden_steadfast_focus:beneficial', until: 8000 },
    { key: 'ability_v2_oathwarden_vow_of_readiness:beneficial', until: 8000 }
  ],
  replacementReactions: [{ ability: { id: 'ability_v2_oathwarden_vow_of_retaliation' }, until: 3000 }]
} };
const scene = { game: {}, time: { now: 0 }, partyUnits: [caster],
  textures: { exists: () => true, get: () => ({ setFilter() {} }) },
  add: { image() { return {
    active: true, setOrigin(x, y) { this.originX = x; this.originY = y; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setScale() { return this; }, setDepth() { return this; },
    setFrame(frame) { this.frame = frame; return this; },
    setAlpha(alpha) { this.alpha = alpha; return this; },
    destroy() { this.active = false; }
  }; } } };
const bounds = (scene, target) => ({ left: target.arenaX - 40, right: target.arenaX + 40, top: 50, bottom: 150 });
const update = delta => updatePrepareAbilityEffects(scene, delta, bounds);
update(0);
assert.equal(scene.prepareAbilityEffects.length, 9, 'Saved records restore generic, Oathwarden and Gladiator preparation effects');
const [focus, quick, footwork, weapon] = scene.prepareAbilityEffects;
assert.notEqual(focus.image.y, quick.image.y, 'Simultaneous magical preparations remain distinct');
const steadfast = scene.prepareAbilityEffects.find(effect => effect.sheet.name === 'steadfast-focus');
const readiness = scene.prepareAbilityEffects.find(effect => effect.sheet.name === 'vow-of-readiness');
const retaliation = scene.prepareAbilityEffects.find(effect => effect.sheet.name === 'vow-of-retaliation');
assert(steadfast && readiness && retaliation, 'Oathwarden cooldown, party readiness and counterattack records restore art');
const rallyingCry = scene.prepareAbilityEffects.find(effect => effect.sheet.name === 'rallying-cry');
const combatReadiness = scene.prepareAbilityEffects.find(effect => effect.sheet.name === 'combat-readiness');
assert(rallyingCry && combatReadiness, 'Gladiator Rallying Cry and free-potion records restore art');
assert(combatReadiness.rearImage.active, 'Readiness restores both sphere layers');
assert.equal(combatReadiness.image.x, combatReadiness.rearImage.x);
assert.equal(combatReadiness.image.y, combatReadiness.rearImage.y);
const x = focus.image.x;
caster.arenaX += 75;
update(125);
assert.equal(focus.image.x, x + 75);
assert.equal(focus.image.frame, 3, '32-frame artwork advances at 24 FPS');
caster.status.replacementPreparations = [];
caster.status.replacementFreeItem = null;
caster.status.replacementEffects = caster.status.replacementEffects.filter(record =>
  record.key.startsWith('ability_v2_generic_physical_combat_footwork') || record.key.startsWith('ability_v2_oathwarden_vow_of_readiness'));
caster.status.replacementReactions = [];
update(200);
assert.equal(focus.fadeElapsed, 200);
assert.equal(quick.fadeElapsed, 200);
assert.equal(weapon.fadeElapsed, 200);
assert.equal(steadfast.fadeElapsed, 200);
assert.equal(readiness.fadeElapsed, null, 'Readiness stays visible after its next-windup bonus is consumed');
assert.equal(retaliation.fadeElapsed, 200);
assert.equal(rallyingCry.fadeElapsed, 200);
assert.equal(combatReadiness.fadeElapsed, 200);
assert.equal(combatReadiness.image.alpha, combatReadiness.rearImage.alpha, 'Both sphere layers fade together');
assert.equal(footwork.fadeElapsed, null, 'Consumed windup does not end Footwork movement art');
assert(focus.image.active && focus.image.alpha > 0 && focus.image.alpha < 0.5);
scene.combatPaused = true;
const frame = focus.image.frame;
update(1000);
assert.equal(focus.fadeElapsed, 200);
assert.equal(focus.image.frame, frame);
scene.combatPaused = false;
caster.status.replacementEffects = caster.status.replacementEffects.filter(record => !record.key.startsWith('ability_v2_oathwarden_vow_of_readiness'));
update(0);
assert.equal(readiness.fadeElapsed, 0, 'Readiness starts fading when its Dodge modifier expires');
caster.status.replacementPreparations.push({ ability: { id: focus.sheet.abilityId }, until: 8000 });
createPrepareAbilityEffect(scene, caster, { id: focus.sheet.abilityId });
update(0);
assert.equal(scene.prepareAbilityEffects.filter(effect => effect.target === caster && effect.sheet === focus.sheet).length,
  1, 'Refresh does not create duplicate preparation art');
assert.equal(focus.fadeElapsed, null, 'Refresh reverses an existing fade without duplicates');
update(200);
assert(!quick.image.active && !weapon.image.active);
scene.time.now = 6000;
update(200);
assert.equal(footwork.fadeElapsed, 200, 'Movement expiry starts Footwork fade');
update(200);
assert(!footwork.image.active);
caster.alive = false;
update(200);
assert(focus.image.active);
update(200);
assert(!focus.image.active);
caster.alive = true;
scene.time.now = 0;
update(0);
scene.battleOver = true;
update(200);
assert(scene.prepareAbilityEffects.every(effect => effect.image.active && effect.fadeElapsed === 200));
update(200);
assert.equal(scene.prepareAbilityEffects.length, 0);
scene.battleOver = false;
update(0);

// The potion-charge refill has no saved status, so its 32-frame cast art plays once.
const reequip = GLADIATOR_PREPARE_EFFECT_SHEETS.find(sheet => sheet.name === 'reequip');
const tacticalReset = GLADIATOR_PREPARE_EFFECT_SHEETS.find(sheet => sheet.name === 'tactical-reset');
assert(createPrepareAbilityEffect(scene, caster, { id: reequip.abilityId }));
assert(createPrepareAbilityEffect(scene, caster, { id: tacticalReset.abilityId }));
update(1000);
const reequipEffect = scene.prepareAbilityEffects.find(effect => effect.sheet === reequip);
const resetEffect = scene.prepareAbilityEffects.find(effect => effect.sheet === tacticalReset);
assert.equal(reequipEffect.image.frame, 15, 'Reequip plays at its authored 15 FPS');
assert.equal(resetEffect.image.frame, 16, 'Tactical Reset loops at its authored 16 FPS');
update(500);
assert.equal(resetEffect.fadeElapsed, null, 'Tactical Reset holds its loop through the short cast beat');
update(200);
assert.equal(resetEffect.fadeElapsed, 100, 'Tactical Reset fades after its one-shot window');
assert(resetEffect.image.active && resetEffect.image.alpha < 0.9);
update(300);
assert(!resetEffect.image.active, 'Tactical Reset releases its image after the fade');
update(133);
assert.equal(reequipEffect.image.frame, 31, 'Reequip reaches its final frame at the end of its one-shot');
assert.equal(reequipEffect.fadeElapsed, 0);
update(400);
assert(!reequipEffect.image.active, 'Reequip fades instead of disappearing at the final frame');
const supplicant = OATHWARDEN_PREPARE_EFFECT_SHEETS.find(sheet => sheet.name === 'oath-of-the-supplicant');
assert(createPrepareAbilityEffect(scene, caster, { id: supplicant.abilityId }));
update(1599);
const refillEffect = scene.prepareAbilityEffects.find(effect => effect.sheet === supplicant);
assert.equal(refillEffect.image.frame, 31, 'Supplicant plays at 20 FPS and holds its final frame');
assert.equal(refillEffect.fadeElapsed, null);
update(1);
assert.equal(refillEffect.fadeElapsed, 0, 'One-shot cast art waits for its authored 1.6 second sequence');
scene.combatPaused = true;
update(1000);
assert.equal(refillEffect.fadeElapsed, 0, 'One-shot fade uses the paused combat clock');
scene.combatPaused = false;
update(200);
assert.equal(refillEffect.fadeElapsed, 200);
update(200);
assert(!refillEffect.image.active, 'One-shot art finishes with a 400 ms fade');

const replayImages = scene.prepareAbilityEffects.map(effect => effect.image);
updateAbilityEffects(scene, 0, true);
assert(replayImages.every(image => !image.active), 'Replay immediately clears only presentation');
assert(prepareEffectActive(scene, caster, focus.sheet), 'Replay preserves gameplay statuses');
update(0);
const shutdownImages = scene.prepareAbilityEffects.map(effect => effect.image);
clearPrepareAbilityEffects(scene);
assert(shutdownImages.every(image => !image.active));

// Read the finished PNG header to catch missing or incorrectly sized exports.
// PixelLab uses a six-column atlas; only the first 32 cells are playable.
for (const sheet of [...PREPARE_EFFECT_SHEETS, ...OATHWARDEN_PREPARE_EFFECT_SHEETS]) {
  const bytes = readFileSync(new URL(sheet.url));
  assert.equal(bytes.readUInt32BE(16), sheet.width * 6);
  assert.equal(bytes.readUInt32BE(20), sheet.height * 6);
}
for (const sheet of GLADIATOR_PREPARE_EFFECT_SHEETS) {
  const bytes = readFileSync(new URL(sheet.url));
  assert.equal(bytes.readUInt32BE(16), sheet.width * 6);
  assert.equal(bytes.readUInt32BE(20), sheet.height * 6);
}
console.log('Prepare effects restore, follow, consume, refresh, pause, expire, fade and clean up.');
