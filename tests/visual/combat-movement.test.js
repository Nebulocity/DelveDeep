import assert from 'node:assert/strict';
import CombatMovement from '../../combat/CombatMovement.js';

const battlefield = {
  logicalWidth: 2400,
  logicalHeight: 1080,
  clampPoint: (x, y) => ({ x: Math.max(0, Math.min(2400, x)), y: Math.max(0, Math.min(1080, y)) })
};
const bodies = [350, 425, 500, 575, 650].map((y, index) => ({
  id: `body-${index}`, alive: false, isEnemy: false, bodyRadius: 20, arenaX: 1100, arenaY: y,
  role: 'Melee DPS', spacingMode: 'normal', container: { active: true }
}));

function simulateRoute(startX, destinationX) {
  const unit = { id: 'runner', alive: true, isEnemy: false, bodyRadius: 20, arenaX: startX, arenaY: 500,
    role: 'Melee DPS', spacingMode: 'normal', status: {} };
  const scene = {
    partyUnits: [unit, ...bodies],
    enemies: [],
    time: { now: 0 },
    battlefield,
    terrain: {
      isUnitBlocked: (_unit, x, y) => x > 990 && x < 1210 && y > 300 && y < 700,
      resolveStep: (_unit, x, y) => ({ x, y })
    },
    isPositionLocked: () => false
  };
  const movement = new CombatMovement(scene);
  scene.movement = movement;
  let collisionFree = true;
  for (let frame = 0; frame < 1200; frame += 1) {
    scene.time.now += 50;
    const waypoint = movement.getNavigationWaypoint(unit, { x: destinationX, y: 500 });
    const dx = waypoint.x - unit.arenaX, dy = waypoint.y - unit.arenaY;
    const length = Math.hypot(dx, dy);
    if (length < 1) continue;
    const next = movement.getSteeredMovementPoint(unit, dx / length * Math.min(12, length), dy / length * Math.min(12, length), false);
    unit.arenaX = next.x;
    unit.arenaY = next.y;
    if (bodies.some(body => Math.hypot(unit.arenaX - body.arenaX, unit.arenaY - body.arenaY)
      < movement.getRequiredUnitSpacing(unit, body) - 1) || scene.terrain.isUnitBlocked(unit, unit.arenaX, unit.arenaY)) collisionFree = false;
  }
  return {
    reached: Math.hypot(unit.arenaX - destinationX, unit.arenaY - 500) < 32,
    collisionFree
  };
}

function simulateTerrainOnlyRoute() {
  const unit = { id: 'terrain-runner', alive: true, isEnemy: false, bodyRadius: 20, arenaX: 700, arenaY: 500,
    role: 'Melee DPS', spacingMode: 'normal', status: {} };
  const scene = {
    partyUnits: [unit],
    enemies: [],
    time: { now: 0 },
    battlefield,
    terrain: {
      isUnitBlocked: (_unit, x, y) => x > 990 && x < 1210 && y > 300 && y < 700,
      resolveStep: (_unit, x, y) => ({ x, y })
    },
    isPositionLocked: () => false
  };
  const movement = new CombatMovement(scene);
  scene.movement = movement;

  for (let frame = 0; frame < 1200; frame += 1) {
    scene.time.now += 50;

    const waypoint = movement.getNavigationWaypoint(unit, { x: 1600, y: 500 });
    const directionX = waypoint.x - unit.arenaX;
    const directionY = waypoint.y - unit.arenaY;
    const distanceToWaypoint = Math.hypot(directionX, directionY);

    if (distanceToWaypoint < 1) continue;

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
