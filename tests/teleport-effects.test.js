// Check decorative lifetimes and prove that playing art does not remove a combatant,
// change a status, delay an action, or spend an additional random draw.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TELEPORT_EFFECT_SHEETS, preloadTeleportEffects } from '../data/teleportEffects.js';
import { startTeleportEffect, updateTeleportEffects, clearTeleportEffects } from '../combat/TeleportEffects.js';
import ReplacementAbilitySystem from '../combat/ReplacementAbilitySystem.js';
import { resolveRune } from '../combat/RunedanceSystem.js';

function image(key = 'character', frame = 0) {
  const value = { texture: { key }, frame: { name: frame }, width: 256, height: 256,
    x: 0, y: 0, scaleX: 1, scaleY: 1, originX: .5, originY: .9, flipX: false,
    active: true, visible: true, alpha: 1 };
  for (const name of ['setFrame', 'setOrigin', 'setPosition', 'setScale', 'setRotation',
    'setDepth', 'setAlpha', 'setVisible', 'setFlipX', 'setTint', 'setTintFill', 'clearTint']) {
    value[name] = function (...args) {
      if (name === 'setFrame') this.frame = { name: args[0] };
      if (name === 'setAlpha') this.alpha = args[0];
      if (name === 'setVisible') this.visible = args[0];
      if (name === 'setPosition') { this.x = args[0]; this.y = args[1]; }
      return this;
    };
  }
  value.destroy = function () { this.active = false; };
  return value;
}

function fixture() {
  const scene = { time: { now: 1000 }, game: {}, add: { image: (x, y, key, frame) => image(key, frame) },
    events: { once() {} }, textures: { exists: () => true },
    battlefield: { logicalWidth: 1000, logicalHeight: 600, arenaToScreen: (x, y) => ({ x, y }) } };
  const unit = { id: 'mage', alive: true, hp: 700, arenaX: 100, arenaY: 200,
    container: { scaleX: 1 }, status: { poison: { next: 1200 }, armorUntil: 5000 },
    pendingAction: { name: 'Attack', startAt: 900 }, spriteVisual: { image: image(), definition: { clips: {} } },
    setArenaPosition(x, y) { this.arenaX = x; this.arenaY = y; } };
  return { scene, unit };
}

// Validate cell sizes against the finished PNGs, including shorter trimmed layers.
const loads = [];
preloadTeleportEffects({ textures: { exists: () => false }, load: { spritesheet: (...args) => loads.push(args) } });
assert.equal(loads.length, 9);
for (const sheet of TELEPORT_EFFECT_SHEETS) {
  const png = readFileSync(new URL(`../assets/effects/teleport/${sheet.name}.png`, import.meta.url));
  assert.equal(png.readUInt32BE(16) % sheet.width, 0);
  assert.equal(png.readUInt32BE(20) % sheet.height, 0);
  assert.ok(sheet.start + sheet.frames <= 32);
}

for (const handler of ['damageEscapeTeleport', 'damageEnemyTeleport', 'decoyAllyRescue', 'arenaRepositionTruce', 'runeTraverse']) {
  const { scene, unit } = fixture();
  const before = JSON.stringify({ hp: unit.hp, status: unit.status, action: unit.pendingAction, x: unit.arenaX, y: unit.arenaY });
  assert.equal(startTeleportEffect(scene, unit, { x: 500, y: 240 }, { id: handler, handler }), true);
  unit.setArenaPosition(500, 240);
  updateTeleportEffects(scene);
  assert.ok(scene.teleportEffects[0].images.size > 0);

  // A stopped combat clock produces the identical frames and opacities on Pause.
  scene.time.now = 1450;
  updateTeleportEffects(scene);
  const frame = () => [...scene.teleportEffects[0].images.values()].map(view => [view.frame.name, view.alpha, view.visible]);
  const paused = JSON.stringify(frame());
  updateTeleportEffects(scene);
  assert.equal(JSON.stringify(frame()), paused);
  scene.time.now = 4000;
  updateTeleportEffects(scene);
  assert.equal(scene.teleportEffects.length, 0);
  unit.setArenaPosition(100, 200);
  assert.equal(JSON.stringify({ hp: unit.hp, status: unit.status, action: unit.pendingAction, x: unit.arenaX, y: unit.arenaY }), before);
  assert.equal(unit.spriteVisual.image.alpha, 1, 'The real sprite is never hidden.');
}

// A shared moon keeps one origin for small enemies and full-sized party members.
{
  const { scene, unit: caster } = fixture();
  const { unit: small } = fixture();
  small.id = 'small';
  small.spriteVisual.image.scaleY = .3;
  const ability = { id: 'truce', handler: 'arenaRepositionTruce' };
  startTeleportEffect(scene, small, { x: 300, y: 240 }, ability, caster);
  startTeleportEffect(scene, caster, { x: 700, y: 240 }, ability, caster);
  scene.time.now += 500;
  updateTeleportEffects(scene);
  const origins = scene.teleportEffects.map(effect => effect.images.get('moon-beam'));
  assert.deepEqual([origins[0].x, origins[0].y], [origins[1].x, origins[1].y]);
  assert.equal(scene.teleportEffects.filter(effect => effect.images.get('moon')?.visible).length, 1);
}

// A mid-animation death fades frozen artwork, while replay immediately drops it.
{
  const { scene, unit } = fixture();
  startTeleportEffect(scene, unit, { x: 500, y: 240 }, { handler: 'runeTraverse' });
  scene.time.now = 1300;
  updateTeleportEffects(scene);
  const views = [...scene.teleportEffects[0].images.values()];
  unit.alive = false;
  updateTeleportEffects(scene);
  scene.time.now += 399;
  updateTeleportEffects(scene);
  assert.equal(scene.teleportEffects.length, 1);
  scene.time.now++;
  updateTeleportEffects(scene);
  assert.equal(scene.teleportEffects.length, 0);
  assert.ok(views.every(view => !view.active));
  unit.alive = true;
  startTeleportEffect(scene, unit, { x: 500, y: 240 }, { handler: 'runeTraverse' });
  updateTeleportEffects(scene, true);
  assert.equal(scene.teleportEffects.length, 0);
  scene.idleSimulating = true;
  assert.equal(startTeleportEffect(scene, unit, { x: 500, y: 240 }, { handler: 'runeTraverse' }), false);
  clearTeleportEffects(scene);
}

// Lightweaving's overlay follows the existing decoy and fades when that decoy expires.
{
  const { scene, unit } = fixture();
  const decoy = { alive: true, decoyUntil: 5000 };
  startTeleportEffect(scene, unit, { x: 500, y: 240 }, { handler: 'decoyAllyRescue' }, unit, { decoy });
  scene.time.now = 4000;
  updateTeleportEffects(scene);
  assert.equal(scene.teleportEffects.length, 1);
  scene.time.now = 5000;
  updateTeleportEffects(scene);
  scene.time.now = 5400;
  updateTeleportEffects(scene);
  assert.equal(scene.teleportEffects.length, 0);
  assert.equal(decoy.alive, true, 'Artwork does not retire the gameplay decoy.');
}

// Exercise the real escape callback. Position changes now, and hostile escape uses
// its original single seeded roll without adding a presentation random draw.
{
  const { scene, unit } = fixture();
  let rolls = 0, cues = 0;
  Object.assign(scene, { isPositionLocked: () => false, combatRandom: () => { rolls++; return .5; },
    partyUnits: [{ arenaX: 0, arenaY: 0 }], getLivingEnemies: () => [],
    playTeleportEffect: (...args) => { cues++; return startTeleportEffect(scene, ...args); } });
  const system = Object.assign(Object.create(ReplacementAbilitySystem.prototype), { scene,
    parent: { surroundingPoints: () => [{ x: 400, y: 200 }], canTeleport: () => true } });
  system.escape(unit, 2, true, { handler: 'damageEnemyTeleport' });
  assert.equal(unit.arenaX, 400);
  assert.equal(cues, 1);
  assert.equal(rolls, 1);
  assert.equal(unit.pendingAction.name, 'Attack');
}

// Garnet Spring still hits immediately and stores its rune at the original floor point.
{
  const { scene, unit } = fixture();
  let damage = 0, cues = 0;
  const target = { alive: true, arenaX: 525, arenaY: 240 };
  Object.assign(scene, { currentWaveIndex: 0, isPositionLocked: () => false,
    playTeleportEffect: () => cues++ });
  const system = { scene, parent: { surroundingPoints: () => [{ x: 500, y: 240 }], canTeleport: () => true },
    damage() { damage++; } };
  unit.spellPower = 100;
  resolveRune(system, unit, target, { id: 'spring', handler: 'runeTraverse', range: 10, duration: 6000,
    primary: { potency: .8, basis: 'Caster Spell Power' } }, 1000);
  assert.equal(cues, 1);
  assert.equal(damage, 1);
  assert.equal(unit.arenaX, 500);
  assert.deepEqual(unit.status.replacementZones[0].point, { arenaX: 100, arenaY: 200 });
}
console.log('Teleport artwork: nine sheets, five callbacks, pause/fade/replay, decoy lifetime and unchanged gameplay passed.');
