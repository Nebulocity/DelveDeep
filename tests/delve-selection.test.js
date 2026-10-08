// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({
  Phaser: { Scene: class {} },
  STONE: { gold: 123 },
  combatSpacing: { terrainFootRadius: 5 },
  HapticsService: { tap() {}, confirm() {} },
  getMaterialDefinition: id => ({ name: id === 'cloth' ? 'Cloth' : 'Iron Ore' })
});
vm.runInContext(fs.readFileSync('scenes/BattleScene.js', 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export default class BattleScene', 'globalThis.BattleScene = class BattleScene'), context);
const unit = (id, role) => ({
  id,
  role,
  alive: true,
  hp: 40,
  maxHp: 100,
  arenaX: 100,
  arenaY: 200,
  finishAction() { this.canceled = true; },
  body: { setStrokeStyle() {} },
  hitZone: { setStrokeStyle(width, color, alpha) { this.alpha = alpha; } }
});
const tank = unit('tank', 'Tank'), healer = unit('healer', 'Healer'), ally = unit('ally', 'Melee DPS');

// Object.assign writes these fields into its first argument. Later sources replace earlier
// fields; nested values are not deep-copied. A Set keeps each value once. has checks
// membership without searching a list for duplicate entries. A Map pairs a key with a
// value. Unlike an array index, the key can be an ID or an object; get/set read and write
// that same key.
const scene = Object.assign(Object.create(context.BattleScene.prototype), {
  partyUnits: [tank, healer, ally],
  selectedUnitIds: new Set(),
  manualTargets: new Map(),
  attackTargets: new Map(),
  healerPriorityTargets: new Map(),
  heldUnitIds: new Set(),
  movement: { getFormationPositions: units => units.map((u, index) => ({ x: 100 + index * 50, y: 200 })) },
  terrain: { nearestSafeUnitPoint: (u, x, y) => ({ x, y }) },
  showBattleMessage() {},
  clearBattleMessage() {},
  setTargetingInputState() {}
});
scene.toggleUnitSelection(tank);

// ... expands these entries into the new list or call. It does not deep-copy the objects
// inside.
assert.deepEqual([...scene.selectedUnitIds], ['tank']);
assert.equal(tank.hitZone.alpha, undefined);
scene.toggleUnitSelection(ally);
assert.deepEqual([...scene.selectedUnitIds], ['tank']);
assert.equal(scene.manualTargets.has('tank'), true);
assert.equal(scene.heldUnitIds.has('tank'), true);
scene.toggleUnitSelection(tank);

assert.equal(scene.selectedUnitIds.size, 0);
scene.selectRole('All');
scene.toggleUnitSelection(ally);
assert.equal(scene.selectedUnitIds.size, 3);
assert.equal(scene.healerPriorityTargets.get('healer'), 'ally');
assert.equal(scene.manualTargets.has('healer'), false);
assert.equal(scene.heldUnitIds.has('healer'), false);

assert.equal(scene.getHealerPriorityTarget(healer), ally);
scene.heldUnitIds.add('healer');
assert.equal(scene.getHealerPriorityTarget(healer), null);
scene.heldUnitIds.delete('healer');
ally.hp = 100;
scene.toggleUnitSelection(ally);
assert.equal(scene.manualTargets.has('healer'), true);

assert.equal(scene.selectedUnitIds.size, 3);
scene.selectRole('All');
assert.equal(scene.selectedUnitIds.size, 0);
assert.equal(tank.hitZone.alpha, undefined);
assert.equal(scene.formatWaveReward({ gold: 12, xp: 8, materialId: 'cloth', materialCount: 1 }), '+12 GOLD  +8 XP\n+1 Cloth');
assert.equal(scene.formatWaveReward({ gold: 30, xp: 17, materials: { cloth: 2, iron: 1 } }), '+30 GOLD  +17 XP\n+2 Cloth\n+1 Iron Ore');
console.log('Delve ally selection, mixed healer commands, order replacement, and named rewards passed.');

// The braces pull named fields into local variables. This reads those fields without
// copying the whole source object.
const { default: AbilitySystem } = await import('../combat/ClassAbilitySystem.js');
const commandedHealer = {
  ...unit('commanded-healer', 'Healer'),
  arenaX: 0,
  arenaY: 0,
  hp: 100,
  abilities: {},
  basicHealRange: 3,
  canStartAction: () => true,
  canCast: () => true,
  canHeal: () => true,
  canAttack: () => true,
  moveToward(x, y) { this.destination = { x, y }; }
};
const priority = { ...unit('priority', 'Tank'), arenaX: 500, arenaY: 0, hp: 95 };
const nearby = { ...unit('nearby', 'Melee DPS'), arenaX: 100, arenaY: 0, hp: 90 };
const enemy = { id: 'enemy', alive: true, arenaX: 100, arenaY: 0 };
const abilitiesScene = {
  partyUnits: [commandedHealer, priority, nearby],
  getLivingEnemies: () => [enemy],
  isEnemyEngaged: () => true,
  attackTargets: new Map(),
  getHealerPriorityTarget: () => priority,
  getPrimaryTarget: () => enemy,
  isWithinAttackReach: () => true,
  isPositionLocked: () => false,
  movement: { maintainRange() {} },
  beginBasicHeal(u, target) { this.healed = target; },
  beginBasicAttack() { this.attacked = true; }
};
const system = new AbilitySystem(abilitiesScene);

system.update(commandedHealer, 0, 0.016);
assert.equal(abilitiesScene.healed, undefined, 'do not heal an incidental nearby ally instead of approaching the ordered target');
assert.equal(abilitiesScene.attacked, undefined, 'explicit healing priority suppresses attacks even above 80% HP');
assert.deepEqual(commandedHealer.destination, { x: 500, y: 0 });
priority.arenaX = 200;
system.update(commandedHealer, 0, 0.016);
assert.equal(abilitiesScene.healed, priority);

scene.selectRole('All');
scene.toggleUnitSelection(healer);
assert.equal(scene.healerPriorityTargets.get('healer'), 'healer', 'a group healer anchor can heal itself');
assert.equal(scene.selectedUnitIds.size, 3);
console.log('Explicit healer pursuit, healing above 80%, and group self-healing passed.');
scene.selectRole('All');
scene.selectRole('Melee');

assert.deepEqual([...scene.selectedUnitIds], ['ally'], 'Melee category matches Melee DPS roles');
scene.selectRole('Melee');
assert.equal(scene.selectedUnitIds.size, 0);
const ranged = unit('ranged', 'Ranged DPS');
scene.partyUnits.push(ranged);
scene.selectRole('Ranged');
assert.deepEqual([...scene.selectedUnitIds], ['ranged'], 'Ranged category matches Ranged DPS roles');

console.log('Melee and Ranged category selection passed.');
