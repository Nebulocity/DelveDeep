// Run with Node. These scenarios check actual decisions without Phaser presentation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ClassAbilitySystem from '../combat/ClassAbilitySystem.js';
import CombatMovement from '../combat/CombatMovement.js';
import { incomingPressure, missingHealth, reserveHealing } from '../combat/CombatDecisions.js';
import { packBattleValue, unpackBattleValue } from '../game/BattleSnapshot.js';
import { abilityPower } from '../game/CharacterStats.js';

const unit = (id, x, y, extra = {}) => ({ id, name: id, arenaX: x, arenaY: y,
  hp: 100, maxHp: 100, alive: true, isEnemy: false, status: {}, bodyRadius: 20,
  role: 'Ranged DPS', attackRange: 300, attackPower: 100, spellHealing: 100,
  abilities: {}, canStartAction: () => true, canCast: () => true,
  abilityReady: () => true, canHeal: () => false, canAttack: () => false,
  distanceTo(other) { return Math.hypot(this.arenaX - other.arenaX, this.arenaY - other.arenaY); },
  distanceToPoint(x, y) { return Math.hypot(this.arenaX - x, this.arenaY - y); },
  ...extra });
const tank = unit('tank', 400, 400, { role: 'Tank' });
const caster = unit('caster', 500, 400);
const safeAlly = unit('safe', 600, 400, { hp: 20 });
const monster = unit('monster', 420, 400, { isEnemy: true, currentTargetId: tank.id,
  attackRange: 100, setTargetName() {} });
const scene = { partyUnits: [tank, caster, safeAlly], enemies: [monster],
  getLivingEnemies() { return this.enemies.filter(enemy => enemy.alive); },
  activeTelegraphs: [], time: { now: 1000 }, attackTargets: new Map(),
  getPrimaryTarget: () => monster, isPositionLocked: () => false,
  isWithinAttackReach: () => false, movement: { moveToCombatPosition() {}, maintainPreferredRange() {} } };
const system = new ClassAbilitySystem(scene);
system.cast = (actor, target, key) => { scene.choice = { actor, target, key }; };
caster.abilities = { ward: { effect: 'protect', target: 'ally', range: 5 } };
system.update(caster, 1000, 0.05);
assert.equal(scene.choice.target, tank, 'An attacked full-health tank beats an injured but safe ally for a shield');
monster.currentTargetId = null;
scene.choice = null;
system.update(caster, 1000, 0.05);
assert.equal(scene.choice, null, 'Do not spend a shield when nobody is threatened');
monster.currentTargetId = tank.id;
tank.status.abilityProtectionUntil = 2000;
system.update(caster, 1000, 0.05);
assert.equal(scene.choice, null, 'Do not overwrite active protection');
tank.status = {};
monster.arenaX = 1500;
assert.ok(incomingPressure(scene, tank) < 0.5, 'Distant pursuit alone does not waste a short defensive buff');
scene.enemies.push(...[1, 2, 3].map(index => unit(`distant-${index}`, 1600, 400,
  { isEnemy: true, currentTargetId: tank.id, attackRange: 100 })));
scene.choice = null;
system.update(caster, 1000, 0.05);
assert.equal(scene.choice, null, 'Several distant pursuers still do not justify an opening shield');
scene.enemies.splice(1);
monster.arenaX = 420;

// Critical recovery beats preparation, while tiny scratches use the basic heal.
caster.role = 'Healer';
caster.abilities = {
  setup: { effect: 'prepare', powerUnit: 'next-hit bonus', range: 0 },
  heal: { effect: 'heal', target: 'ally', range: 5, power: 60, manaCost: 5, windup: 300 }
};
system.update(caster, 1000, 0.05);
assert.equal(scene.choice.key, 'heal');
assert.equal(scene.choice.target, safeAlly);
const secondHealer = unit('second-healer', 500, 400, { pendingAction: {} });
scene.partyUnits.push(secondHealer);
reserveHealing(secondHealer, [safeAlly], 80);
assert.equal(missingHealth(scene, safeAlly), 0);
scene.choice = null;
caster.abilities = { heal: caster.abilities.heal };
system.update(caster, 1000, 0.05);
assert.equal(scene.choice, null, 'A second healer does not duplicate an already sufficient queued heal');
secondHealer.pendingAction = unpackBattleValue(packBattleValue(secondHealer.pendingAction));
assert.equal(missingHealth(scene, safeAlly), 0, 'Reload retains the healing reservation');
secondHealer.pendingAction = null;
assert.equal(missingHealth(scene, safeAlly), 80, 'Canceling the first cast releases its reservation');
safeAlly.hp = 99;
scene.choice = null;
system.update(caster, 1000, 0.05);
assert.equal(scene.choice, null, 'A one-HP scratch does not consume a large heal');

// One desperately injured ally is a better area-heal anchor than two tiny scratches.
const farInjury = unit('far-injury', 850, 400, { hp: 20 });
safeAlly.arenaX = 510;
tank.hp = 99;
scene.partyUnits.push(farInjury);
const anchor = system.bestZone(caster, { effect: 'heal', range: 5, zone: 1, power: 60 }, [safeAlly, tank, farInjury]);
assert.equal(anchor.arenaX, farInjury.arenaX);

// Evaluate the real threat methods. Buffs, damage and healing work before tank contact.
const context = vm.createContext({ Phaser: { Scene: class {} }, abilityPower });
vm.runInContext(fs.readFileSync(new URL('../scenes/BattleScene.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default class BattleScene', 'globalThis.Battle = class BattleScene'), context);
const battle = Object.assign(Object.create(context.Battle.prototype), scene, {
  enemyThreat: new Map([[monster.id, new Map()]]), currentWaveIndex: 0, createMeleePulse() {}
});
assert.equal(battle.getHighestThreatTarget(monster), tank, 'Tank receives initial zero-threat attention');
battle.generateAbilityThreat(caster, { manaCost: 10 });
assert.equal(battle.getHighestThreatTarget(monster), caster, 'A support skill can pull an untouched enemy');
battle.addThreat(monster, safeAlly, 100);
assert.equal(battle.getHighestThreatTarget(monster), safeAlly, 'Non-tank threat is never gated by tank contact');
battle.addThreat(monster, tank, 200);
assert.equal(battle.getHighestThreatTarget(monster), tank, 'The tank can earn the lead again');
monster.status = { forcedTargetId: caster.id, forcedTargetUntil: 2000 };
assert.equal(battle.getHighestThreatTarget(monster), caster, 'Authored forced-target duration remains authoritative');
battle.time.now = 2000;
assert.equal(battle.getHighestThreatTarget(monster), tank, 'Threat resumes at forced-target expiry');
monster.currentTargetId = safeAlly.id;
assert.equal(battle.getPrimaryTarget(tank), monster, 'Tank chooses an enemy attacking an ally');

// Real healing contributes only restored HP, including before any tank engagement.
safeAlly.hp = 40;
safeAlly.heal = amount => { safeAlly.hp = Math.min(safeAlly.maxHp, safeAlly.hp + amount); };
safeAlly.flash = () => {};
battle.rollCritical = () => false;
battle.createProjectile = () => {};
battle.createFloatingText = () => {};
battle.enemyThreat.set(monster.id, new Map());
battle.resolveHeal(caster, safeAlly, 200, 'Recovery');
assert.equal(battle.enemyThreat.get(monster.id).get(caster.id), 27, 'Only the 60 restored HP generates 45% healing threat');
assert.equal(battle.getHighestThreatTarget(monster), caster);

// Monsters recover before attacking and keep their hostile target during a heal cast.
const enemyHealer = unit('enemy-healer', 420, 400, { isEnemy: true, hp: 50,
  currentTargetId: tank.id, abilities: {
    primary: { effect: 'damage', name: 'Bolt', windup: 300 },
    secondary: { effect: 'heal', name: 'Recovery', power: 50, windup: 300 }
  }, regenMana() {}, isBusy: () => false, setTargetName() {}, markAbilityUsed() {},
  startAction(name) { this.pendingAction = { name }; return true; } });
battle.enemies = [enemyHealer];
battle.enemyThreat = new Map([[enemyHealer.id, new Map()]]);
battle.announceAbility = () => {};
battle.scheduleBattleEvent = () => {};
battle.updateEnemies(2000, 0);
assert.equal(enemyHealer.pendingAction.name, 'Recovery');
assert.equal(enemyHealer.currentTargetId, tank.id, 'Friendly recovery does not replace the hostile threat target');
assert.equal(enemyHealer.pendingAction.healingReservations[enemyHealer.id], 50);

// Spell lock prevents spells, while ordinary movement and basic attacks remain possible.
safeAlly.hp = 100;
tank.hp = 100;
farInjury.hp = 100;
caster.canCast = () => false;
caster.canAttack = () => true;
scene.isWithinAttackReach = () => true;
scene.beginBasicAttack = () => { scene.attackedWhileLocked = true; };
system.update(caster, 2000, 0);
assert.equal(scene.attackedWhileLocked, true);

// Edge escape must work when moving directly away would clamp back onto the same wall.
const runner = unit('runner', 50, 400);
const floor = { logicalWidth: 1200, logicalHeight: 900,
  clampPoint: (x, y) => ({ x: Math.max(38, Math.min(1162, x)), y: Math.max(38, Math.min(862, y)) }) };
const moveScene = { partyUnits: [runner], enemies: [], battlefield: floor, time: { now: 0 },
  tactics: { shouldAvoidMechanics: () => true }, activeTelegraphs: [] };
const movement = new CombatMovement(moveScene);
const warnings = [{ arenaX: 100, arenaY: 400, radius: 180 }, { arenaX: 180, arenaY: 160, radius: 140 }];
const escape = movement.getEscapePoint(runner, warnings);
assert.ok(escape && warnings.every(w => Math.hypot(escape.x - w.arenaX, escape.y - w.arenaY) > w.radius + runner.bodyRadius));
assert.ok(escape.x > runner.arenaX || escape.y !== runner.arenaY,
  'Escape finds an inward or sideways exit instead of clamping onto the wall');

// A standing enemy wall must be navigated around, in both directions, without teleporting.
moveScene.enemies = [330, 410, 490].map((y, index) => unit(`blocker-${index}`, 500, y,
  { isEnemy: true, bodyRadius: 24 }));
runner.arenaX = 200;
const waypoint = movement.getNavigationWaypoint(runner, { x: 850, y: 400 });
assert.notEqual(waypoint.y, 400, 'A path around the living crowd starts with a side step');
let maximumDetour = 0;
for (let step = 0; step < 250; step++) {
  moveScene.time.now += 50;
  const point = movement.getNavigationWaypoint(runner, { x: 850, y: 400 });
  const distance = Math.hypot(point.x - runner.arenaX, point.y - runner.arenaY);
  if (distance < 1) continue;
  runner.arenaX += (point.x - runner.arenaX) / distance * Math.min(8, distance);
  runner.arenaY += (point.y - runner.arenaY) / distance * Math.min(8, distance);
  maximumDetour = Math.max(maximumDetour, Math.abs(runner.arenaY - 400));
  assert.ok(moveScene.enemies.every(enemy => runner.distanceTo(enemy) >= movement.getRequiredUnitSpacing(runner, enemy) - 1));
}
assert.ok(runner.distanceToPoint(850, 400) < 20 && maximumDetour > 100);

// Automatic navigation walks around a warning instead of entering it to reach a target.
moveScene.enemies = [];
runner.arenaX = 200;
runner.arenaY = 400;
moveScene.activeTelegraphs = [{ arenaX: 500, arenaY: 400, radius: 110 }];
let warningDetour = 0;
for (let step = 0; step < 250; step++) {
  moveScene.time.now += 50;
  const point = movement.getNavigationWaypoint(runner, { x: 850, y: 400 });
  const distance = runner.distanceToPoint(point.x, point.y);
  if (distance < 1) continue;
  runner.arenaX += (point.x - runner.arenaX) / distance * Math.min(8, distance);
  runner.arenaY += (point.y - runner.arenaY) / distance * Math.min(8, distance);
  assert.ok(runner.distanceToPoint(500, 400) > 130);
  warningDetour = Math.max(warningDetour, Math.abs(runner.arenaY - 400));
}
assert.ok(runner.distanceToPoint(850, 400) < 20 && warningDetour > 130);

// Dog-pile escape preserves healthy tank behavior and offers fragile roles an open exit.
runner.arenaX = 500;
runner.arenaY = 400;
runner.moveToward = (x, y) => { runner.escapeDestination = { x, y }; };
moveScene.enemies = [[580, 400], [510, 470], [430, 410]].map(([x, y], index) =>
  unit(`crowd-${index}`, x, y, { isEnemy: true }));
assert.equal(movement.tryEscapeCrowd(runner, 0.05), true);
assert.ok(runner.escapeDestination);
runner.role = 'Tank';
assert.equal(movement.tryEscapeCrowd(runner, 0.05), false, 'Healthy tanks hold the front');
runner.hp = 20;
assert.equal(movement.tryEscapeCrowd(runner, 0.05), true, 'Critical tanks can leave a dog pile');

// Explicit Move and manual-response warnings remain under Party Leader control.
moveScene.enemies = [];
runner.arenaX = 200;
runner.arenaY = 400;
moveScene.manualTargets = new Map([[runner.id, { x: 850, y: 400 }]]);
assert.deepEqual(movement.getNavigationWaypoint(runner, { x: 850, y: 400 }), { x: 850, y: 400 });
moveScene.manualTargets.clear();
moveScene.activeTelegraphs[0].autoAvoid = false;
assert.deepEqual(movement.getNavigationWaypoint(runner, { x: 850, y: 400 }), { x: 850, y: 400 });
console.log('Contextual shields, coordinated heals, threat acquisition, tank rescue and safe crowd/hazard navigation passed.');
