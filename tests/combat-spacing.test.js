import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import CombatMovement from '../combat/CombatMovement.js';
import config from '../config/combatSpacing.js';

// Exercise real BattleUnit movement through projection, without a renderer.
class Vector2 {
  constructor(x, y) { this.x = x; this.y = y; }
  normalize() { const length = Math.hypot(this.x, this.y) || 1; this.x /= length; this.y /= length; return this; }
}
const context = vm.createContext({ Phaser: { Math: {
  Vector2, Distance: { Between: (x, y, tx, ty) => Math.hypot(tx - x, ty - y) }
} } });
vm.runInContext(fs.readFileSync(new URL('../combat/BattleUnit.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default class BattleUnit', 'globalThis.BattleUnit = class BattleUnit'), context);
const battlefield = {
  clampPoint(x, y, px = 0, py = px) { return { x: Math.max(px, Math.min(1400 - px, x)), y: Math.max(py, Math.min(900 - py, y)) }; },
  arenaToScreen(x, y) { return { x, y }; }, getUnitScale() { return 1; }
};
function unit(id, role, x, y, enemy = false, bodyRadius = enemy ? 45 : 36) {
  return Object.assign(Object.create(context.BattleUnit.prototype), {
    id, role, arenaX: x, arenaY: y, battlefield, alive: true, isEnemy: enemy,
    moveSpeed: 135, bodyRadius, attackRange: role === 'Ranged DPS' ? 345 : role === 'Healer' ? 285 : 74,
    status: {}, pendingAction: null, busyUntil: 0,
    container: { active: true, setPosition(x, y) { this.x = x; this.y = y; }, setScale() {}, setDepth() {} }
  });
}

// Visible circles, not just center coordinates, stay clear around a boss.
{
  const party = ['Tank', 'Melee DPS', 'Melee DPS'].map((role, i) => unit(`p${i}`, role, 650 + i * 20, 200));
  const boss = unit('boss', 'Enemy', 700, 500, true, 76);
  const scene = setup(party, [boss]);
  simulate(scene, 12, (time, delta) => party.forEach(u => scene.movement.moveToCombatPosition(u, boss, time, delta)));
  party.forEach(unit => {
    const clearance = unit.bodyRadius + boss.bodyRadius + config.personalSpaceGap;
    assert.ok(unit.distanceTo(boss) >= clearance - 2, `Boss clearance: ${unit.distanceTo(boss)}`);
    assert.ok(unit.distanceTo(boss) <= unit.attackRange + config.meleeReachPadding);
  });
  assert.ok(minDistance(party) >= party[0].bodyRadius + party[1].bodyRadius + config.personalSpaceGap - 2);
}
function setup(party, enemies) {
  const scene = { partyUnits: party, enemies, battlefield, manualTargets: new Map(), held: new Set(),
    isPositionLocked(unit) { return this.held.has(unit.id); } };
  scene.movement = new CombatMovement(scene);
  [...party, ...enemies].forEach(unit => { unit.scene = scene; });
  return scene;
}
function simulate(scene, seconds, tick) {
  for (let frame = 0; frame < seconds * 60; frame += 1) {
    tick?.(frame * 1000 / 60, 1 / 60);
    scene.movement.separate(1 / 60);
  }
}
function minDistance(units) {
  return Math.min(...units.flatMap((a, i) => units.slice(i + 1).map(b => a.distanceTo(b))));
}

// All factions resolve exact overlap; dead/inactive bodies do not push anyone.
{
  const units = Array.from({ length: 10 }, (_, i) => unit(`u${i}`, 'Melee DPS', 700, 450, i >= 5));
  const scene = setup(units.slice(0, 5), units.slice(5));
  simulate(scene, 8);
  assert.ok(minDistance(units) > 48, `Crowd spacing: ${minDistance(units)}`);
  const dead = unit('dead', 'Enemy', 700, 450, true); dead.alive = false;
  const inactive = unit('inactive', 'Enemy', 700, 450, true); inactive.container.active = false;
  const solo = unit('solo', 'Tank', 700, 450);
  simulate(setup([solo], [dead, inactive]), 2);
  assert.equal(solo.arenaX, 700);
  assert.equal(solo.arenaY, 450);
}

// Tank and two melee reserve distinct stable slots and track a moving target.
{
  const party = ['Tank', 'Melee DPS', 'Melee DPS'].map((role, i) => unit(`p${i}`, role, 650, 250));
  const target = unit('target', 'Enemy', 700, 500, true);
  const scene = setup(party, [target]);
  simulate(scene, 10, (time, delta) => party.forEach(u => scene.movement.moveToCombatPosition(u, target, time, delta)));
  assert.equal(new Set([...scene.movement.slots.values()].map(slot => slot.index)).size, 3);
  assert.ok(minDistance(party) > 45);
  party.forEach(u => assert.ok(u.distanceTo(target) <= u.attackRange + config.meleeReachPadding));
  const settled = party.map(u => ({ x: u.arenaX, y: u.arenaY }));
  simulate(scene, 2, (time, delta) => party.forEach(u => scene.movement.moveToCombatPosition(u, target, 10000 + time, delta)));
  party.forEach((u, i) => assert.ok(Math.hypot(u.arenaX - settled[i].x, u.arenaY - settled[i].y) < 2));
  const slots = party.map(u => scene.movement.slots.get(u).index);
  simulate(scene, 4, (time, delta) => {
    target.setArenaPosition(target.arenaX + 15 * delta, target.arenaY);
    party.forEach(u => scene.movement.moveToCombatPosition(u, target, 12000 + time, delta));
  });
  assert.deepEqual(party.map(u => scene.movement.slots.get(u).index), slots);
  assert.ok(minDistance(party) > 40);
}

// Five allies and five enemies engage; both sides share one separation pass.
{
  const party = ['Tank', 'Melee DPS', 'Melee DPS', 'Ranged DPS', 'Healer'].map((r, i) => unit(`p${i}`, r, 600 + i * 25, 220));
  const enemies = Array.from({ length: 5 }, (_, i) => unit(`e${i}`, 'Enemy', 700, 580, true));
  const scene = setup(party, enemies);
  simulate(scene, 20, (time, delta) => {
    party.forEach(u => scene.movement.moveToCombatPosition(u, enemies[0], time, delta));
    enemies.forEach(u => scene.movement.moveToCombatPosition(u, party[0], time, delta));
  });
  assert.ok(minDistance([...party, ...enemies]) > 40, `Engaged spacing: ${minDistance([...party, ...enemies])}`);
  assert.ok(minDistance(enemies) > 35);
  assert.ok(party[3].distanceTo(party[0]) > 100);
  assert.ok(party[4].distanceTo(party[0]) > 130);
}

// Range bands settle and tolerate small target changes; close threats trigger retreat.
for (const role of ['Ranged DPS', 'Healer']) {
  const actor = unit('ranged', role, 700, 400), target = unit('enemy', 'Enemy', 700, 450, true);
  const scene = setup([actor], [target]);
  simulate(scene, 6, (time, delta) => scene.movement.moveToCombatPosition(actor, target, time, delta));
  const position = { x: actor.arenaX, y: actor.arenaY };
  target.arenaY += 3;
  simulate(scene, 3, (time, delta) => scene.movement.moveToCombatPosition(actor, target, 6000 + time, delta));
  assert.deepEqual({ x: actor.arenaX, y: actor.arenaY }, position);
  target.arenaY = 800;
  simulate(scene, 6, (time, delta) => scene.movement.moveToCombatPosition(actor, target, 9000 + time, delta));
  assert.ok(actor.distanceTo(target) <= (role === 'Healer' ? config.healerMax : config.rangedMax));
}

// Commands retain unique positions even at an edge; Stack remains tighter than Spread.
for (const mode of ['normal', 'stack', 'spread']) {
  const party = Array.from({ length: 5 }, (_, i) => unit(`p${i}`, 'Melee DPS', 700, 450));
  const scene = setup(party, []);
  const positions = scene.movement.getFormationPositions(party, { x: 0, y: 0 }, mode);
  party.forEach((u, i) => {
    u.spacingMode = mode;
    scene.held.add(u.id);
    scene.manualTargets.set(u.id, positions[i]);
  });
  simulate(scene, 20, () => party.forEach(u => {
    const p = scene.manualTargets.get(u.id);
    if (u.distanceToPoint(p.x, p.y) > config.arrivalTolerance) u.moveToward(p.x, p.y, 1 / 60, config.arrival);
  }));
  assert.ok(minDistance(party) > config[mode] - 3, `${mode}: ${minDistance(party)}`);
  party.forEach(u => assert.ok(u.arenaX >= config.edgePadding && u.arenaY >= config.edgePadding));
}

// Held overlapping allies separate locally, and do not resume chasing an enemy.
{
  const a = unit('a', 'Tank', 700, 300), b = unit('b', 'Melee DPS', 700, 300);
  const target = unit('e', 'Enemy', 700, 750, true);
  const scene = setup([a, b], [target]);
  for (const u of [a, b]) { scene.held.add(u.id); scene.manualTargets.set(u.id, { x: 700, y: 300 }); }
  simulate(scene, 10, (time, delta) => [a, b].forEach(u => {
    const p = scene.manualTargets.get(u.id);
    if (u.distanceToPoint(p.x, p.y) > config.arrivalTolerance) u.moveToward(p.x, p.y, delta, config.arrival);
    scene.movement.moveToCombatPosition(u, target, time, delta);
  }));
  assert.ok(a.distanceTo(b) > 50);
  [a, b].forEach(u => assert.ok(Math.hypot(u.arenaX - 700, u.arenaY - 300) < 55));
}
console.log('Combat spacing simulations passed.');
