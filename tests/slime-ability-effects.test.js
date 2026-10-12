// Check visible lob behavior against moving targets, pause, interruption and saved casts.
import assert from 'node:assert/strict';
import { startSlimeGlobFlight, landSlimeGlobFlight, updateSlimeAbilityEffects,
  playSlimeAbilityEffect } from '../combat/SlimeAbilityEffects.js';

function image(x, y) {
  return { x, y, active: true, alpha: 1, frame: 0,
    setOrigin() { return this; }, setDisplaySize() { return this; }, setDepth() { return this; },
    setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this; },
    setFrame(frame) { this.frame = frame; return this; },
    setAlpha(alpha) { this.alpha = alpha; return this; }, destroy() { this.active = false; } };
}

function fixture() {
  const ability = { name: 'Toxic Glob', windup: 1000 };
  const action = { startAt: 0, duration: 1000, name: ability.name };
  const caster = { id: 'slime', alive: true, arenaX: 100, arenaY: 300,
    pendingAction: action, abilities: { secondary: ability } };
  const target = { id: 'hero', alive: true, arenaX: 500, arenaY: 300 };
  const scene = { game: {}, time: { now: 0 }, events: { once() {} }, textures: { exists: () => true },
    add: { image }, enemies: [caster], partyUnits: [target], battleEvents: new Set(),
    battlefield: { arenaToScreen: (x, y) => ({ x, y }), getUnitScale: () => 1,
      getGroundEllipseRadii: () => ({ width: 100, height: 50 }) } };
  return { scene, caster, target, ability, action };
}

function tick(scene, delta) {
  if (!scene.combatPaused) scene.time.now += delta;
  updateSlimeAbilityEffects(scene, delta);
}

const { scene, caster, target, ability, action } = fixture();
assert(startSlimeGlobFlight(scene, caster, target, ability, action));
const flight = scene.slimeGlobFlights[0];
assert.equal(flight.image.x, caster.arenaX, 'The lob starts at the slime');
assert(flight.image.y < caster.arenaY, 'It launches from the body, above the floor');
tick(scene, 500);
assert.equal(flight.image.x, 300, 'Halfway through the cast, flight is halfway across');
assert(flight.image.y < flight.from.y - 70, 'The glob rises visibly above its launch point');

scene.combatPaused = true;
const paused = { x: flight.image.x, y: flight.image.y, frame: flight.image.frame };
tick(scene, 2000);
assert.deepEqual({ x: flight.image.x, y: flight.image.y, frame: flight.image.frame }, paused);
scene.combatPaused = false;
target.arenaX = 600;
tick(scene, 250);
assert(flight.image.x > 450, 'A single-target lob follows a moving recipient');
tick(scene, 250);
landSlimeGlobFlight(scene, caster, action);
assert.equal(flight.image.x, target.arenaX, 'Touchdown aligns with the scheduled hit');
playSlimeAbilityEffect(scene, ability.name, target);
assert.equal(scene.slimeAbilityEffects[0].image.x, flight.image.x);
assert.equal(scene.slimeAbilityEffects[0].image.y, flight.image.y, 'Splash and glob meet at the same body point');
caster.pendingAction = null;
tick(scene, 200);
assert(flight.image.active && flight.image.alpha === 0.5, 'Touchdown fades over 400 combat ms');
scene.combatPaused = true;
tick(scene, 1000);
assert.equal(flight.image.alpha, 0.5);
scene.combatPaused = false;
tick(scene, 200);
assert(!flight.image.active);

const canceled = fixture();
startSlimeGlobFlight(canceled.scene, canceled.caster, canceled.target, canceled.ability, canceled.action);
tick(canceled.scene, 250);
const stopped = canceled.scene.slimeGlobFlights[0].image;
const stoppedAt = { x: stopped.x, y: stopped.y };
canceled.caster.pendingAction = null;
tick(canceled.scene, 100);
assert.deepEqual({ x: stopped.x, y: stopped.y }, stoppedAt, 'An interrupted glob stops traveling');
assert(stopped.active && stopped.alpha < 1 && stopped.alpha > 0);
tick(canceled.scene, 300);
assert(!stopped.active);

const area = fixture();
const center = { arenaX: 800, arenaY: 450 };
startSlimeGlobFlight(area.scene, area.caster, null, area.ability, area.action, center);
area.target.arenaX = 1200;
tick(area.scene, 1000);
landSlimeGlobFlight(area.scene, area.caster, area.action);
assert.equal(area.scene.slimeGlobFlights[0].image.x, 800, 'Boss lob retains its warning location');
assert.equal(area.scene.slimeGlobFlights[0].image.y, 450, 'Boss lob lands on the floor');

const restored = fixture();
restored.scene.time.now = 500;
restored.scene.battleEvents.add({ data: { kind: 'enemyAbility', unitId: 'slime', targetId: 'hero',
  key: 'secondary', actionStartAt: 0 } });
updateSlimeAbilityEffects(restored.scene, 0);
assert.equal(restored.scene.slimeGlobFlights[0].image.x, 300, 'Saved mid-cast flight restores at its elapsed position');
updateSlimeAbilityEffects(restored.scene, 0);
assert.equal(restored.scene.slimeGlobFlights.length, 1, 'Restore does not duplicate an existing lob');
const restoredImage = restored.scene.slimeGlobFlights[0].image;
restored.scene.idleSimulating = true;
updateSlimeAbilityEffects(restored.scene, 5000);
assert(!restoredImage.active && restored.scene.slimeGlobFlights.length === 0, 'History clears artwork immediately');
console.log('Slime lob launch, arc, tracking, touchdown, fixed area, pause, fade, interruption and restore passed.');
