// Check voluntary recovery in a crowded corner without changing manual orders or hazards.
import assert from 'node:assert/strict';
import CombatMovement from '../combat/CombatMovement.js';

const unit = { id: 'tank', alive: true, role: 'Tank', arenaX: 60, arenaY: 60,
  status: {}, canStartAction: () => true,
  moveToward(x, y, delta) { this.step = { x, y, delta }; } };
const scene = { partyUnits: [unit], enemies: [{ alive: true, arenaX: 90, arenaY: 90 }],
  battlefield: { logicalWidth: 1000, logicalHeight: 1000,
    clampPoint: (x, y) => ({ x, y }) }, activeTelegraphs: [],
  manualTargets: new Map(), isPositionLocked: () => false };
const movement = new CombatMovement(scene);
assert.equal(movement.tryReturnToInterior(unit, 100, 1), true);
assert.ok(unit.step.x > 60 && unit.step.y > 60);
assert.equal(unit.step.delta, 0.35, 'Recovery is slower than ordinary pursuit');
scene.manualTargets.set(unit.id, { x: 60, y: 60 });
assert.equal(movement.tryReturnToInterior(unit, 100, 1), false);
scene.manualTargets.clear();
scene.isPositionLocked = () => true;
assert.equal(movement.tryReturnToInterior(unit, 100, 1), false);
scene.isPositionLocked = () => false;
unit.status.rootedUntil = 200;
assert.equal(movement.tryReturnToInterior(unit, 100, 1), false);
unit.status = {};
scene.activeTelegraphs.push({ autoAvoid: false });
assert.equal(movement.tryReturnToInterior(unit, 100, 1), false);
scene.activeTelegraphs = [];
unit.arenaX = 500;
unit.arenaY = 500;
assert.equal(movement.tryReturnToInterior(unit, 100, 1), false);
unit.arenaX = 940;
unit.arenaY = 940;
assert.equal(movement.tryReturnToInterior(unit, 100, 1), true);
assert.ok(unit.step.x < 940 && unit.step.y < 940);
unit.role = 'Healer';
unit.distanceTo = enemy => Math.hypot(unit.arenaX - enemy.arenaX, unit.arenaY - enemy.arenaY);
scene.enemies[0].arenaX = 850;
scene.enemies[0].arenaY = 850;
assert.equal(movement.tryReturnToInterior(unit, 100, 1), false, 'Recovery cannot lead a healer into nearby enemies');
unit.role = 'Tank';
scene.partyUnits.push({ alive: true, arenaX: 60, arenaY: 60 });
assert.equal(movement.tryReturnToInterior(unit, 100, 1), false, 'One flanker does not recenter a balanced party');
console.log('Corner recovery, inner-area stability, slow steps, manual orders, roots and warning priority passed.');
