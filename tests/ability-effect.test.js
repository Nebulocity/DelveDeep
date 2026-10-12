// Check real playback boundaries without launching Phaser: pause, padding and cleanup
// must never keep sprites alive or create historical effects during background replay.

import assert from 'node:assert/strict';
import { createAbilityEffect, updateAbilityEffects, createAbilityTelegraph, clearAbilityTelegraph } from '../combat/AbilityEffect.js';
import { preloadAbilityEffects, ABILITY_EFFECTS } from '../data/abilityEffects.js';
import { PHYSICAL_EFFECT_SHEETS } from '../combat/PhysicalAbilityEffects.js';
import { PREPARE_EFFECT_SHEETS, OATHWARDEN_PREPARE_EFFECT_SHEETS } from '../combat/PrepareAbilityEffects.js';
import ClassAbilitySystem from '../combat/ClassAbilitySystem.js';
import { ASSAULT_EFFECT_SHEETS } from '../combat/AssaultAbilityEffects.js';
import { RANGED_DELIVERY_SHEETS } from '../data/rangedDelivery.js';

function makeScene() {
  const scene = {
    game: {}, combatPaused: false, images: [], zones: [], loads: [],
    battlefield: { logicalWidth: 1000,
      arenaToScreen: (x, y) => ({ x, y, widthAtDepth: 1000 }),
      getGroundEllipseRadii: radius => ({ width: radius, height: radius * 0.4 }) },
    events: { once(event, callback) { scene.shutdown = callback; } },
    textures: { exists: () => true, get: () => ({ setFilter() {} }) },
    load: { spritesheet(key, url, options) { scene.loads.push({ key, url, options }); } },
    add: { ellipse(x, y, width, height, color, alpha) {
      const zone = {
        x, y, width, height, color, alpha, active: true,
        setStrokeStyle(width, color, alpha) { this.strokeColor = color; return this; },
        setDepth(depth) { this.depth = depth; return this; },
        setPosition(x, y) { this.x = x; this.y = y; return this; },
        setDisplaySize(width, height) { this.width = width; this.height = height; return this; },
        destroy() { this.active = false; }
      };
      scene.zones.push(zone);
      return zone;
    }, image(x, y, key) {
      const image = {
        x, y, key, active: true,
        setOrigin() { return this; }, setScale(x, y = x) { this.scale = x; this.scaleX = x; this.scaleY = y; return this; },
        setRotation(rotation) { this.rotation = rotation; return this; },
        setCrop(x, y, width, height) { this.crop = { x, y, width, height }; return this; },
        setAlpha(alpha) { this.alpha = alpha; return this; },
        setDepth(depth) { this.depth = depth; return this; },
        setVisible(visible) { this.visible = visible; return this; },
        setFrame(frame) { this.frame = frame; return this; },
        setPosition(x, y) { this.x = x; this.y = y; return this; },
        destroy() { this.active = false; }
      };
      scene.images.push(image);
      return image;
    } }
  };
  return scene;
}

const scene = makeScene();
const ranger = { className: 'Ranger', color: 0xabcdef, alive: true };
const target = { arenaX: 500, arenaY: 400, alive: true };
const volley = { name: 'Volley', zone: 2 };
assert.equal(createAbilityEffect(scene, ranger, target, volley), true);
assert.equal(scene.images.filter(image => image.visible).length, 1);
assert.equal(scene.abilityEffects[0].scale, 6, 'Volley should be noticeably larger than its old scale of 4');
assert.equal(scene.zones[0].color, ranger.color);
assert.equal(scene.zones[0].width, 400, 'The warning keeps the actual damage diameter');
const initialX = scene.images[0].x;
scene.combatPaused = true;
updateAbilityEffects(scene, 500);
assert.equal(scene.abilityEffects[0].elapsed, 0);
scene.combatPaused = false;
updateAbilityEffects(scene, 450);
assert.equal(scene.images[0].x, initialX, 'Baked arrow movement must not be applied twice');
assert.equal(scene.images.filter(image => image.visible).length, 2);
updateAbilityEffects(scene, 50);
assert.equal(scene.images.filter(image => image.visible).length, 5);
updateAbilityEffects(scene, 250);
assert.equal(scene.images.filter(image => image.visible).length, 1, 'Padding cells must never show');
updateAbilityEffects(scene, 50);
assert.equal(scene.abilityEffects.length, 0);
assert(scene.images.every(image => !image.active));
assert(scene.zones.every(zone => !zone.active));

// Two simultaneous casts own separate images. Shutdown must clean both sets.
createAbilityEffect(scene, ranger, target, volley);
createAbilityEffect(scene, ranger, target, volley);
assert.equal(scene.abilityEffects.length, 2);
scene.shutdown();
assert(scene.images.every(image => !image.active));
assert(scene.zones.every(zone => !zone.active));
createAbilityEffect(scene, ranger, target, volley);
updateAbilityEffects(scene, 0, true);
assert.equal(scene.abilityEffects.length, 0);
scene.game.backgroundProgress = { isReplaying: true };
assert.equal(createAbilityEffect(scene, ranger, target, volley), false);
scene.game.backgroundProgress.isReplaying = false;
scene.idleSimulating = true;
assert.equal(createAbilityEffect(scene, ranger, target, volley), false);
scene.idleSimulating = false;
assert.equal(createAbilityEffect(scene, ranger, target, { name: 'Aimed Shot' }), false);
scene.textures.exists = () => false;
assert.equal(createAbilityEffect(scene, ranger, target, volley), false);
preloadAbilityEffects(scene);
assert.equal(scene.loads.length, RANGED_DELIVERY_SHEETS.length + ASSAULT_EFFECT_SHEETS.length + PHYSICAL_EFFECT_SHEETS.length + PREPARE_EFFECT_SHEETS.length
  + OATHWARDEN_PREPARE_EFFECT_SHEETS.length + ABILITY_EFFECTS.reduce((sum, effect) => sum + effect.clips.length, 0));
assert.equal(scene.loads.find(load => load.key === 'physical-charge-trail').options.endFrame, 31);
assert.equal(scene.loads.find(load => load.key === 'volley-part-dust_kick').options.endFrame, 4);

// Cast warnings follow the target and belong to a specific action. Canceling an
// older action must not erase a new cast, and pause must not delay canceled cleanup.
const warningScene = makeScene();
const action = { id: 1 };
ranger.pendingAction = action;
assert.equal(createAbilityTelegraph(warningScene, ranger, target, volley, action), true);
const warning = warningScene.abilityTelegraphs[0].zone;
assert.equal(warning.color, ranger.color);
target.arenaX += 75;
warningScene.combatPaused = true;
updateAbilityEffects(warningScene, 100);
assert.equal(warning.x, target.arenaX);
clearAbilityTelegraph(warningScene, ranger, { id: 0 });
assert.equal(warning.active, true);
ranger.pendingAction = null;
updateAbilityEffects(warningScene, 0);
assert.equal(warning.active, false);
assert.equal(warningScene.abilityTelegraphs.length, 0);
ranger.pendingAction = action;
createAbilityTelegraph(warningScene, ranger, target, volley, action);
clearAbilityTelegraph(warningScene, ranger, action);
assert.equal(warningScene.abilityTelegraphs.length, 0);
createAbilityTelegraph(warningScene, ranger, target, volley, action);
updateAbilityEffects(warningScene, 0, true);
assert(warningScene.zones.every(zone => !zone.active));
createAbilityTelegraph(warningScene, ranger, target, volley, action);
warningScene.shutdown();
assert(warningScene.zones.every(zone => !zone.active));
console.log('Ability effect pause, alignment, padding, replay and cleanup passed.');

// A real cast's flight follows its moving target and fades on interruption. Pause
// freezes the fading remnant. The arrow and explosion never play together before a hit.
const flightScene = makeScene();
const archer = { ...ranger, arenaX: 100, arenaY: 200 };
const arrow = { name: 'Exploding Arrow', effect: 'damage', power: 100, damageType: 'physical' };
const flightAction = { duration: 1200 };
archer.pendingAction = flightAction;
assert(createAbilityTelegraph(flightScene, archer, target, arrow, flightAction));
const flight = flightScene.abilityEffects[0];
assert.equal(flight.definition.id, 'explodingarrow-arrow');
const launchX = flight.pieces[0].image.x;
updateAbilityEffects(flightScene, 600);
assert(flight.pieces[0].image.x > launchX);
assert.equal(flight.pieces[0].image.visible, true);
flightScene.combatPaused = true;
const pausedX = flight.pieces[0].image.x;
updateAbilityEffects(flightScene, 500);
assert.equal(flight.pieces[0].image.x, pausedX);
archer.pendingAction = null;
updateAbilityEffects(flightScene, 0);
assert.equal(flightScene.abilityEffects.length, 1);
assert(flight.pieces[0].image.active, 'Interrupted arrows retain their paused fading remnant');
updateAbilityEffects(flightScene, 500);
assert.equal(flight.fadeElapsed, 0);
flightScene.combatPaused = false;
updateAbilityEffects(flightScene, 200);
assert(flight.pieces[0].image.alpha > 0 && flight.pieces[0].image.alpha < 1);
updateAbilityEffects(flightScene, 200);
assert.equal(flightScene.abilityEffects.length, 0);
assert(!flight.pieces[0].image.active);

// Exercise the actual gameplay resolver with a missed, blocked and damaging hit.
// Undefined is its miss signal; zero damage still confirms physical contact.
const impacts = [];
const victim = { alive: true, status: {} };
const attacker = { status: {}, attackPower: 100 };
const hitScene = { getLivingEnemies: () => [victim], partyUnits: [attacker],
  isEnemyEngaged: () => true,
  createAbilityEffect: (unit, target, ability) => impacts.push(ability.name),
  resolveDamage: () => undefined };
const system = new ClassAbilitySystem(hitScene);
system.resolve(attacker, victim, arrow, 0);
assert.deepEqual(impacts, []);
hitScene.resolveDamage = () => 0;
system.resolve(attacker, victim, arrow, 0);
assert.deepEqual(impacts, [], 'A dodged arrow returns zero but must not explode');
hitScene.resolveDamage = (...args) => { args[7].hit = true; return 0; };
system.resolve(attacker, victim, arrow, 0);
assert.deepEqual(impacts, ['Exploding Arrow']);
hitScene.resolveDamage = (...args) => { args[7].hit = true; return 75; };
system.resolve(attacker, victim, arrow, 0);
assert.equal(impacts.length, 2);

// Every new impact pack ends without showing its sheet padding. A mark loops for
// its victim until death, follows movement and removes duplicate applications.
for (const definition of ABILITY_EFFECTS.filter(effect => effect.id !== 'volley' && !effect.projectile && !effect.abilityId)) {
  const s = makeScene();
  s.time = { now: 0 };
  const marked = { ...target, status: { damageTakenBoost: 0.25, temporaryHp: 50, sunlitWardVisualUntil: 10000 } };
  const ability = { name: definition.abilityName, duration: 10000 };
  assert(createAbilityEffect(s, { className: definition.className }, marked, ability));
  const effect = s.abilityEffects[0];
  if (definition.untilDeath) {
    updateAbilityEffects(s, 2000);
    assert.equal(s.abilityEffects.length, 1);
    marked.arenaX += 90;
    updateAbilityEffects(s, 0);
    assert.equal(effect.origin.x, marked.arenaX);
    createAbilityEffect(s, { className: definition.className }, marked, ability);
    assert.equal(s.abilityEffects.length, 1);
    assert(effect.pieces.every(piece => !piece.image.active));
    marked.status.damageTakenBoost = 0;
    updateAbilityEffects(s, 20000);
    assert.equal(s.abilityEffects.length, 1, 'Mark art survives the expired damage bonus');
    marked.alive = false;
  }
  s.time.now = 10000;
  updateAbilityEffects(s, 10000);
  assert.equal(s.abilityEffects.length, 0);
  assert(s.images.every(image => !image.active));
}
console.log('Supplied effects, flight interruption and hit-only explosions passed.');

// Generic magical skills work for every eligible caster class. Their saved gameplay
// statuses control persistent art, while instant cleanup skills play just once.
for (const name of ['Hex', 'Spellbind', 'Nullify', 'Spellward']) {
  const s = makeScene();
  s.time = { now: 0 };
  const id = `ability_v2_generic_magical_${name.toLowerCase()}`;
  const victim = { ...target, status: { spellLockUntil: 6000,
    replacementEffects: [{ key: `${id}:harmful`, until: 6000 }] } };
  const caster = { className: 'Mage of the Umbral Veil' };
  const ability = { id, name, replacement: true };
  assert(createAbilityEffect(s, caster, victim, ability));
  const effect = s.abilityEffects[0];
  assert.equal(effect.definition.frames, 32);
  assert.equal(effect.definition.frameMs, 50);
  if (name === 'Spellward') {
    const [rear, front] = effect.pieces;
    assert.equal(rear.image.depth, 100 + victim.arenaY - 1);
    assert.equal(front.image.depth, 100 + victim.arenaY + 1);
    assert.deepEqual(rear.image.crop, { x: 0, y: 0, width: 96, height: 72 });
    assert.deepEqual(front.image.crop, { x: 0, y: 72, width: 96, height: 24 });
  }
  s.combatPaused = true;
  updateAbilityEffects(s, 700);
  assert.equal(effect.elapsed, 0);
  s.combatPaused = false;
  updateAbilityEffects(s, 1200);
  assert.equal(effect.pieces[0].image.alpha, 0.85);
  if (name === 'Spellward') {
    const [rear, front] = effect.pieces;
    assert.equal(rear.image.crop.height, front.image.crop.y, 'Crops meet without overlap or gaps');
    assert.equal(rear.image.crop.height + front.image.crop.height, 96);
    assert(rear.image.crop.height < 72, 'The split follows the ring as it rises');
    assert.equal(rear.image.frame, front.image.frame);
  }

  if (effect.definition.persistentStatus) {
    createAbilityEffect(s, caster, victim, ability);
    assert.equal(s.abilityEffects.length, 1, 'Refreshing never doubles the status artwork');
    victim.status.spellLockUntil = 0;
    victim.status.replacementEffects = [];
    updateAbilityEffects(s, 0);
    assert(effect.pieces[0].image.active, 'Removal begins a fade instead of destroying art');
  }
  updateAbilityEffects(s, 200);
  assert.equal(effect.pieces[0].image.alpha, 0.425);
  s.combatPaused = true;
  updateAbilityEffects(s, 1000);
  assert.equal(effect.pieces[0].image.alpha, 0.425, 'Fade freezes with combat');
  s.combatPaused = false;
  updateAbilityEffects(s, 200);
  assert.equal(s.abilityEffects.length, 0);
  assert(!effect.pieces[0].image.active);

  // Saved active statuses recreate art without another cast; immunity leaves no art.
  if (effect.definition.persistentStatus) {
    s.enemies = [victim];
    victim.status = name === 'Spellbind' ? { spellLockUntil: 6000 }
      : { replacementEffects: [{ key: `${id}:harmful`, until: 6000 }] };
    updateAbilityEffects(s, 0);
    assert.equal(s.abilityEffects.length, 1);
    victim.alive = false;
    updateAbilityEffects(s, 0);
    updateAbilityEffects(s, 400);
    assert.equal(s.abilityEffects.length, 0);
    victim.alive = true;
    victim.status = {};
    assert.equal(createAbilityEffect(s, caster, victim, ability), false);
  }
}
console.log('Magical protection sheets, status refresh, restoration and paused fades passed.');

// Ground fields cover the frontmost recipient. Body clouds draw one fitted effect
// per recipient and retain each impact position without growing across the group.
for (const name of ['Gloomburst', 'Eclipse Field', 'Smoke Bomb']) {
  const s = makeScene();
  const caster = { className: name === 'Smoke Bomb' ? 'Scoundrel' : 'Mage of the Umbral Veil', arenaX: 100, arenaY: 200 };
  const victims = [{ ...target, container: { depth: 900 } }, { ...target, arenaX: 570, arenaY: 480, container: { depth: 1000 } }];
  createAbilityEffect(s, caster, victims[0], { name, zone: 2 }, victims);
  const effect = s.abilityEffects[0];
  const { x, y } = effect.origin;
  const clouds = name !== 'Eclipse Field';
  assert.equal(s.abilityEffects.length, clouds ? 2 : 1);
  assert(effect.pieces.every(piece => piece.image.depth > (clouds ? 900 : 1000)));
  if (clouds) assert(s.abilityEffects[1].pieces.every(piece => piece.image.depth > 1000));
  victims[0].arenaX += 200;
  updateAbilityEffects(s, 100);
  assert.equal(effect.origin.x, x);
  assert.equal(effect.origin.y, y);
}

const novaScene = makeScene();
const dawnwarden = { className: 'Dawnwarden', arenaX: 200, arenaY: 300, alive: true };
createAbilityEffect(novaScene, dawnwarden, target, { name: 'Sanctity Nova', radius: 1 });
const nova = novaScene.abilityEffects[0];
assert.equal(nova.scaleX / nova.scaleY, 2.5);
dawnwarden.arenaX += 70;
updateAbilityEffects(novaScene, 100);
assert.equal(nova.origin.x, dawnwarden.arenaX, 'Nova follows its caster instead of the selected enemy');

// Saved cosmetic flags restore an indefinite mark and a looping shield, without
// reapplying their gameplay bonuses or replaying the original casts.
const restoredScene = makeScene();
restoredScene.time = { now: 20000 };
const markedEnemy = { ...target, status: { huntersMarkVisual: true, damageTakenBoost: 0 } };
const protectedHero = { ...dawnwarden, status: { temporaryHp: 20, sunlitWardVisualUntil: 27000 } };
restoredScene.enemies = [markedEnemy];
restoredScene.partyUnits = [protectedHero];
updateAbilityEffects(restoredScene, 0);
assert.equal(restoredScene.abilityEffects.length, 2);
const bubble = restoredScene.abilityEffects.find(effect => effect.definition.followShield);
assert(bubble.origin.y < protectedHero.arenaY, 'Ward is centered on the sprite, not its feet');
protectedHero.arenaX += 90;
updateAbilityEffects(restoredScene, 1000);
assert.equal(bubble.origin.x, protectedHero.arenaX);
assert.equal(restoredScene.abilityEffects.length, 2);
protectedHero.status.temporaryHp = 0;
updateAbilityEffects(restoredScene, 0);
assert.equal(restoredScene.abilityEffects.length, 1);
markedEnemy.alive = false;
updateAbilityEffects(restoredScene, 0);
assert.equal(restoredScene.abilityEffects.length, 0);
console.log('Fixed coverage, moving Nova, saved marks and shield-lifetime Ward passed.');

// Exercise the real area-heal selection. Only living allies in the circle get one
// column each; presentation must neither heal a distant ally nor duplicate healing.
for (const name of ['Morning Chorus', 'Everbright Pulse']) {
  const healer = { className: 'Cleric of the Everbright', alive: true, hp: 80, maxHp: 100,
    arenaX: 0, arenaY: 0, spellHealing: 20, status: {} };
  const near = { alive: true, hp: 40, maxHp: 100, arenaX: 100, arenaY: 0, status: {} };
  const far = { alive: true, hp: 40, maxHp: 100, arenaX: 1000, arenaY: 0, status: {} };
  const calls = [], heals = [];
  const s = { partyUnits: [healer, near, far],
    createAbilityEffect: (caster, target) => calls.push(target),
    resolveHeal: (caster, target, amount, abilityName, crit, art) => {
      heals.push({ target, art });
      target.hp += amount;
    } };
  new ClassAbilitySystem(s).resolve(healer, near, { name, effect: 'heal', zone: 2, power: 10 }, 0);
  assert.deepEqual(calls, [healer, near]);
  assert.deepEqual(heals.map(heal => heal.target), [healer, near]);
  assert(heals.every(heal => heal.art));
  assert.equal(far.hp, 40);
}
console.log('Per-recipient Everbright healing artwork preserves target selection.');

// Both healing packs loop at full opacity for 1.5 seconds and share a paused fade.
// A large final delta must release every layer instead of leaving transparent images.
for (const name of ['Morning Chorus', 'Everbright Pulse']) {
  const s = makeScene();
  createAbilityEffect(s, { className: 'Cleric of the Everbright' }, target, { name, zone: 2 });
  const effect = s.abilityEffects[0];
  updateAbilityEffects(s, 1500);
  assert(effect.pieces.every(piece => piece.image.alpha === 1 && piece.image.visible));
  updateAbilityEffects(s, 200);
  assert(effect.pieces.every(piece => piece.image.alpha === 0.5));
  s.combatPaused = true;
  updateAbilityEffects(s, 1000);
  assert.equal(effect.elapsed, 1700);
  assert(effect.pieces.every(piece => piece.image.alpha === 0.5));
  s.combatPaused = false;
  updateAbilityEffects(s, 200);
  assert.equal(s.abilityEffects.length, 0);
  assert(effect.pieces.every(piece => !piece.image.active));
}
console.log('Everbright healing hold, fade, pause and cleanup passed.');

// A padded sheet cell is much larger than its visible creature. Exercise pixel
// measurement, caching, fractional sizing and group spacing without launching Phaser.
const originalDocument = globalThis.document;
let pixelReads = 0;
const frame = { cutX: 0, cutY: 0, cutWidth: 100, cutHeight: 100, source: { image: {} } };
const pixels = new Uint8ClampedArray(100 * 100 * 4);
for (let y = 60; y < 80; y++) {
  for (let x = 40; x < 60; x++) pixels[(y * 100 + x) * 4 + 3] = 255;
}
globalThis.document = { createElement: () => ({ getContext: () => ({
  drawImage() {}, getImageData() { pixelReads++; return { data: pixels }; }
}) }) };
try {
  const s = makeScene();
  s.textures.getFrame = () => frame;
  const small = { ...target, container: { scaleX: 1, depth: 900 }, spriteVisual: {
    definition: { scale: 1, footY: 0, clips: { idle: { south: {
      frames: [{ key: 'padded', frame: 0, originX: 0.5, originY: 0.8 }]
    } } } }, image: { width: 100, height: 100, scaleX: 1, scaleY: 1,
      x: 0, y: 0, originX: 0.5, originY: 0.8 }
  } };
  const boss = { ...small, arenaX: 900, container: { scaleX: 3, depth: 1000 } };
  const caster = { className: 'Scoundrel', arenaX: 100, arenaY: 200 };
  createAbilityEffect(s, caster, small, { name: 'Smoke Bomb', radius: 10 }, [small, boss, small]);
  const [smoke, bossSmoke] = s.abilityEffects;
  assert.equal(s.abilityEffects.length, 2, 'One cloud per distinct resolved victim');
  assert(smoke.scale < 1, 'Small creatures allow fractional scales below 1x');
  assert.equal(smoke.pieces[0].clip.width * smoke.scale, 25, 'Padding and huge ability radius do not inflate smoke');
  assert(Math.abs(bossSmoke.scale / smoke.scale - 3) < 0.001, 'Boss effects grow with the visible sprite');
  assert.equal(smoke.origin.x + (-65 + 122 / 2) * smoke.scale, small.arenaX);
  assert.equal(smoke.origin.y + (-58 + 94 / 2) * smoke.scale, small.arenaY - 10);
  assert.equal(pixelReads, 1, 'Shared idle frame is measured once');
  const scaleBefore = smoke.scale;
  boss.arenaX += 1000;
  updateAbilityEffects(s, 0);
  assert.equal(smoke.scale, scaleBefore, 'Group separation cannot stretch the small cloud');

  // A mirrored facing must mirror the off-center foot anchor as well as the art.
  const facing = small.spriteVisual.definition.clips.idle.south.frames[0];
  facing.originX = 0.4;
  createAbilityEffect(s, caster, small, { name: 'Smoke Bomb' });
  const unflipped = s.abilityEffects.at(-1);
  facing.flipX = true;
  createAbilityEffect(s, caster, small, { name: 'Smoke Bomb' });
  const flipped = s.abilityEffects.at(-1);
  const centerOffset = (-65 + 122 / 2) * smoke.scale;
  assert.equal(unflipped.origin.x + centerOffset, small.arenaX + 10);
  assert.equal(flipped.origin.x + centerOffset, small.arenaX - 10);
  assert.equal(pixelReads, 1, 'Mirroring reuses the cached source rectangle');
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
}
console.log('Visible target fitting, subpixel scale, boss size and independent clouds passed.');
