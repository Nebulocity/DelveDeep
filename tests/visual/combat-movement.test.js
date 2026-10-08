// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import assert from 'node:assert/strict';
import CombatMovement from '../../combat/CombatMovement.js';

const battlefield = {
  logicalWidth: 2400,
  logicalHeight: 1080,

  // We handle clamp point here, keeping this operation in one place for its callers.
  clampPoint: (x, y) => ({ x: Math.max(0, Math.min(2400, x)), y: Math.max(0, Math.min(1080, y)) })
};

// map builds one output entry for each input entry, in the same order. The callback's
// return value becomes that output entry.
const bodies = [350, 425, 500, 575, 650].map((y, index) => ({
  id: `body-${index}`, alive: false, isEnemy: false, bodyRadius: 20, arenaX: 1100, arenaY: y,
  role: 'Melee DPS', spacingMode: 'normal', container: { active: true }
}));

// We handle simulate route here, keeping this operation in one place for its callers.
function simulateRoute(startX, destinationX) {
  const unit = { id: 'runner', alive: true, isEnemy: false, bodyRadius: 20, arenaX: startX, arenaY: 500,
    role: 'Melee DPS', spacingMode: 'normal', status: {} };

  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside.
  const scene = {
    partyUnits: [unit, ...bodies],
    enemies: [],
    time: { now: 0 },
    battlefield,
    terrain: {

      // This check answers whether unit blocked. The caller uses the returned result to
      // decide whether to continue with that action.
      isUnitBlocked: (_unit, x, y) => x > 990 && x < 1210 && y > 300 && y < 700,

      // We handle resolve step here, keeping this operation in one place for its callers.
      resolveStep: (_unit, x, y) => ({ x, y })
    },

    // Check whether a held command or current status prevents this unit from changing
    // position.
    isPositionLocked: () => false
  };

  const movement = new CombatMovement(scene);
  scene.movement = movement;
  let collisionFree = true;

  for (let frame = 0; frame < 1200; frame += 1) {
    scene.time.now += 50;
    const waypoint = movement.getNavigationWaypoint(unit, { x: destinationX, y: 500 });
    const dx = waypoint.x - unit.arenaX, dy = waypoint.y - unit.arenaY;

    // Math.hypot calculates straight-line length from the x/y differences: square each,
    // add them, then take the square root.
    const length = Math.hypot(dx, dy);
    if (length < 1) continue;

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    const next = movement.getSteeredMovementPoint(unit, dx / length * Math.min(12, length), dy / length * Math.min(12, length), false);
    unit.arenaX = next.x;
    unit.arenaY = next.y;

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    if (bodies.some(body => Math.hypot(unit.arenaX - body.arenaX, unit.arenaY - body.arenaY)
      < movement.getRequiredUnitSpacing(unit, body) - 1) || scene.terrain.isUnitBlocked(unit, unit.arenaX, unit.arenaY)) collisionFree = false;
  }

  return {
    reached: Math.hypot(unit.arenaX - destinationX, unit.arenaY - 500) < 32,
    collisionFree
  };
}

// We handle simulate terrain only route here, keeping this operation in one place for its
// callers.
function simulateTerrainOnlyRoute() {
  const unit = { id: 'terrain-runner', alive: true, isEnemy: false, bodyRadius: 20, arenaX: 700, arenaY: 500,
    role: 'Melee DPS', spacingMode: 'normal', status: {} };
  const scene = {
    partyUnits: [unit],
    enemies: [],
    time: { now: 0 },
    battlefield,
    terrain: {

      // This check answers whether unit blocked. The caller uses the returned result to
      // decide whether to continue with that action.
      isUnitBlocked: (_unit, x, y) => x > 990 && x < 1210 && y > 300 && y < 700,

      // We handle resolve step here, keeping this operation in one place for its callers.
      resolveStep: (_unit, x, y) => ({ x, y })
    },

    // Check whether a held command or current status prevents this unit from changing
    // position.
    isPositionLocked: () => false
  };

  const movement = new CombatMovement(scene);
  scene.movement = movement;

  for (let frame = 0; frame < 1200; frame += 1) {
    scene.time.now += 50;

    const waypoint = movement.getNavigationWaypoint(unit, { x: 1600, y: 500 });
    const directionX = waypoint.x - unit.arenaX;
    const directionY = waypoint.y - unit.arenaY;

    // Math.hypot calculates straight-line length from the x/y differences: square each,
    // add them, then take the square root.
    const distanceToWaypoint = Math.hypot(directionX, directionY);

    if (distanceToWaypoint < 1) continue;

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    const travelDistance = Math.min(12, distanceToWaypoint);
    const nextPosition = movement.getSteeredMovementPoint(
      unit,
      directionX / distanceToWaypoint * travelDistance,
      directionY / distanceToWaypoint * travelDistance,
      false
    );

    unit.arenaX = nextPosition.x;
    unit.arenaY = nextPosition.y;

    assert.equal(scene.terrain.isUnitBlocked(unit, unit.arenaX, unit.arenaY), false,
      'terrain-only pathfinding should keep every movement step safe');
  }

  return Math.hypot(unit.arenaX - 1600, unit.arenaY - 500) < 32;
}

assert.deepEqual(simulateRoute(700, 1600), { reached: true, collisionFree: true }, 'pursuit routes safely around bodies and blocked terrain');
assert.deepEqual(simulateRoute(1600, 700), { reached: true, collisionFree: true }, 'retreat routes safely around bodies and blocked terrain');
assert.equal(simulateTerrainOnlyRoute(), true, 'terrain-only obstacles also trigger A* navigation');

console.log('Combat pursuit and retreat route around fallen allies and blocked terrain.');
