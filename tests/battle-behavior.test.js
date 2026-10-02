import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ClassAbilitySystem from '../combat/ClassAbilitySystem.js';
import { CLASS_DEFINITIONS } from '../data/classes.js';
import { leaderAbilities } from '../game/LeaderProgression.js';
import { createEncounterWaves } from '../data/encounters.js';
import { getBattleLayout } from '../ui/Layout.js';
import CombatMovement from '../combat/CombatMovement.js';
import combatSpacing from '../config/combatSpacing.js';
import { chooseWaveLandings } from '../combat/WaveLanding.js';

const context = vm.createContext({
  ClassAbilitySystem, leaderAbilities, createEncounterWaves, getBattleLayout, CombatMovement, combatSpacing, chooseWaveLandings,
  Phaser: {
    Scene: class {},
    Math: {
      Distance: { Between: (x, y, tx, ty) => Math.hypot(tx - x, ty - y) },
      Between: (min) => min
    }
  },
  HapticsService: { tap() {

    }, heavy() {

    } },
  GameState: {},
  saveProfile() {},
  console
});

// This function loads the actual combat classes with rendering imports
// removed, so their decision and timing logic can run without a browser.
function loadClass(path, name) {

  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(`export default class ${name}`, `globalThis.${name} = class ${name}`);
  vm.runInContext(source, context);
  return context[name];
}

const BattleScene = loadClass('../scenes/BattleScene.js', 'BattleScene');
const BattleUnit = loadClass('../combat/BattleUnit.js', 'BattleUnit');
context.HapticsService.confirm = () => {};

// Fallen characters keep normal opacity, including when stealth was active.
{
  const image = { setTint() { return this; }, setAlpha(alpha) { this.alpha = alpha; return this; } };
  const fallen = Object.assign(Object.create(BattleUnit.prototype), {
    hp: 10, alive: true, isEnemy: false, stealthed: true,
    body: { setFillStyle() { return this; } },
    container: { setAlpha(alpha) { this.alpha = alpha; return this; } },
    spriteVisual: { image, play() {} },
    finishAction() {}, updateHealthBar() {}
  });
  fallen.defeat();
  assert.equal(fallen.container.alpha, 1);
  assert.equal(image.alpha, 1);
  assert.equal(fallen.stealthed, false);
}

// This function supplies just the display methods needed by action timing.
function display() {

  return {
    setText() {

      return this; },
    setVisible() {

      return this; },
    setScale() {

      return this; },
    setInteractive() {

      this.enabled = true; return this; },
    disableInteractive() {

      this.enabled = false; return this; }
  };
}

// This function creates a lightweight combatant using real BattleUnit action,
// range, mana, and cooldown methods.
function unit(id, role, x = 0, y = 0) {

  return Object.assign(Object.create(BattleUnit.prototype), {
    id, name: id, role, arenaX: x, arenaY: y, alive: true,
    container: { x, y },
    setArenaPosition(x, y) { this.arenaX = x; this.arenaY = y; },
    isEnemy: role === 'Enemy', status: {}, abilities: {},
    lastAbilityAt: {}, lastAttackAt: -Infinity, mana: 0, maxMana: 0,
    attackPower: 10, attackRange: 74, attackWindup: 100,
    attackCooldown: 0, threatMultiplier: 1, pendingAction: null,
    busyUntil: 0, actionLabel: display(), castBack: display(),
    castFill: display(), hitZone: display(),
    setTargetName() {

      },
    moveToward(x, y, delta, stopDistance) {

      this.lastMove = { x, y, delta, stopDistance };
    },
    moveAwayFrom(x, y, delta, stopDistance) {
      this.lastRetreat = { x, y, delta, stopDistance };
    }
  });
}

// This function creates a scene with controllable delayed callbacks and
// harmless display hooks while retaining the real battle decision methods.
function scene(party, enemies) {

  const timers = [];
  const battle = Object.assign(Object.create(BattleScene.prototype), {
    terrain: { nearestSafeUnitPoint: (unit, x, y) => ({ x, y }) },
    partyUnits: party, enemies, selectedUnitIds: new Set(),
    manualTargets: new Map(), heldUnitIds: new Set(), attackTargets: new Map(),
    enemyThreat: new Map(enemies.map(enemy => [enemy.id, new Map()])),
    commandMode: null, battleOver: false, activeTelegraphs: [], timers,
    time: { now: 0, delayedCall(delay, callback) {

      timers.push(callback); } },
    showBattleMessage() {

      }, refreshTacticsMenus() {

      }, announceAbility() {

      },
    logActionStart() {

      }, createProjectile() {

      },
    resolveDamage() {

      this.hits = (this.hits ?? 0) + 1; }
  });
  battle.battlefield = { clampPoint: (x, y) => ({ x, y }) };
  battle.movement = new CombatMovement(battle);
  return battle;
}

// All selects living allies only, clears target mode, and still allows a
// role selection to replace the whole-party selection.
{
  const tank = unit('tank', 'Tank');
  const healer = unit('healer', 'Healer');
  const fallen = unit('fallen', 'Ranged DPS');
  fallen.alive = false;
  const battle = scene([tank, healer, fallen], []);
  battle.commandMode = 'ATTACK';
  battle.selectRole('All');
  assert.deepEqual([...battle.selectedUnitIds], ['tank', 'healer']);
  assert.equal(battle.commandMode, null);
  battle.selectRole('Healer');
  assert.deepEqual([...battle.selectedUnitIds], ['healer']);
  battle.attackTargets.set(healer.id, 'mistaken-target');
  battle.selectRole('Healer');
  assert.equal(battle.selectedUnitIds.size, 0);
  assert.equal(battle.attackTargets.has(healer.id), false);
  tank.alive = false;
  healer.alive = false;
  battle.selectRole('All');
  assert.equal(battle.selectedUnitIds.size, 0);
}

// Repeated order presses cancel armed targeting and persistent Hold/Attack
// orders for the selected allies.
{
  const tank = unit('tank', 'Tank');
  const battle = scene([tank], []);
  battle.selectedUnitIds.add(tank.id);
  battle.armCommand('MOVE');
  assert.equal(battle.commandMode, 'MOVE');
  battle.armCommand('MOVE');
  assert.equal(battle.commandMode, null);
  battle.armCommand('HOLD');
  assert.equal(battle.heldUnitIds.has(tank.id), true);
  battle.armCommand('HOLD');
  assert.equal(battle.heldUnitIds.has(tank.id), false);
  battle.attackTargets.set(tank.id, 'mistaken-target');
  battle.armCommand('ATTACK');
  assert.equal(battle.attackTargets.has(tank.id), false);
  assert.equal(battle.commandMode, null);
}

// Attack releases only the selected unit and overrides its global focus.
{
  const tank = unit('tank', 'Tank');
  const ally = unit('ally', 'Ranged DPS');
  const enemy = unit('enemy', 'Enemy', 300);
  const other = unit('other', 'Enemy', 200);
  enemy.engagedByTank = true;
  other.engagedByTank = true;
  const battle = scene([tank, ally], [enemy, other]);
  battle.selectedUnitIds.add(tank.id);
  battle.heldUnitIds = new Set([tank.id, ally.id]);
  battle.manualTargets.set(tank.id, { x: 0, y: 0 });
  tank.spacingMode = 'spread';
  battle.focusTargetId = other.id;
  battle.handleEnemyTap(enemy);
  assert.equal(battle.heldUnitIds.has(tank.id), false);
  assert.equal(battle.heldUnitIds.has(ally.id), true);
  assert.equal(battle.manualTargets.has(tank.id), false);
  assert.equal(tank.spacingMode, 'normal');
  assert.equal(battle.getPrimaryTarget(tank), enemy);
  assert.equal(battle.getPrimaryTarget(ally), other);
  assert.equal(enemy.hitZone.enabled, true);
  assert.equal(tank.hitZone.enabled, true);
  enemy.alive = false;
  assert.equal(battle.getPrimaryTarget(tank), other);
  assert.equal(battle.attackTargets.has(tank.id), false);
}

// Empty tiles retain Move + Hold behavior and replace an old Attack order.
{
  const tank = unit('tank', 'Tank');
  const battle = scene([tank], []);
  battle.selectedUnitIds.add(tank.id);
  battle.attackTargets.set(tank.id, 'old-enemy');
  battle.highlightGridCell = () => {

    };
  battle.battlefield = {
    getCellCenter: () => ({ x: 120, y: 80 }),
    clampPoint: (x, y) => ({ x, y })
  };
  battle.handleGridCellTap(1, 1);
  assert.equal(battle.manualTargets.get(tank.id).x, 120);
  assert.equal(battle.heldUnitIds.has(tank.id), true);
  assert.equal(battle.attackTargets.has(tank.id), false);
  battle.selectedUnitIds.clear();
  battle.handleGridCellTap(2, 2);
  assert.equal(battle.manualTargets.get(tank.id).x, 120);
}

// Forced targeting persists despite higher threat, then expires after six seconds.
{
  const tank = unit('tank', 'Tank');
  tank.abilities = CLASS_DEFINITIONS.Dawnwarden.abilities;
  const ally = unit('ally', 'Ranged DPS');
  const enemy = unit('enemy', 'Enemy');
  const battle = scene([tank, ally], [enemy]);
  battle.applyTankTaunt(tank, [enemy], 'challenge', 0);
  battle.addThreat(enemy, ally, 10000);
  battle.time.now = 5999;
  assert.equal(battle.getHighestThreatTarget(enemy), tank);
  battle.time.now = 6000;
  assert.equal(battle.getHighestThreatTarget(enemy), ally);
  assert.equal(tank.abilityReady('challenge', 9999), false);
  assert.equal(tank.abilityReady('challenge', 10000), true);
}

// New waves choose a tank even when a damage dealer is closer. Allies wait
// for tank engagement, then generate normal threat and can overtake it.
{
  const tank = unit('tank', 'Tank', 500);
  const wizard = unit('wizard', 'Ranged DPS', 5);
  const healer = unit('healer', 'Healer', 10);
  const enemy = unit('enemy', 'Enemy');
  const battle = scene([wizard, healer, tank], [enemy]);
  battle.addThreat(enemy, wizard, 9999);
  battle.addThreat(enemy, healer, 9999);
  assert.equal(battle.enemyThreat.get(enemy.id).size, 0);
  assert.equal(battle.getHighestThreatTarget(enemy), tank);
  assert.equal(battle.getPrimaryTarget(wizard), null);
  battle.addThreat(enemy, tank, 10);
  assert.equal(battle.enemyThreat.get(enemy.id).get(tank.id), 10);
  assert.equal(battle.getPrimaryTarget(wizard), enemy);
  battle.addThreat(enemy, wizard, 40);
  battle.addThreat(enemy, healer, 5);
  assert.equal(battle.enemyThreat.get(enemy.id).get(wizard.id), 40);
  assert.equal(battle.enemyThreat.get(enemy.id).get(healer.id), 5);
  assert.equal(battle.getHighestThreatTarget(enemy), wizard);
  tank.alive = false;
  assert.equal(battle.getHighestThreatTarget(enemy), wizard);
  enemy.engagedByTank = false;
  assert.equal(battle.isEnemyEngaged(enemy), true);
}

// Enemy ranged abilities use the same target as normal attacks.
{
  const tank = unit('tank', 'Tank', 500);
  const wizard = unit('wizard', 'Ranged DPS', 5);
  const enemy = unit('enemy', 'Enemy');
  enemy.abilities.secondary = { name: 'Glob', cooldown: 1000, windup: 100, power: 5 };
  const battle = scene([wizard, tank], [enemy]);
  battle.beginEnemyAbility = (actor, target) => {

    battle.castTarget = target; };
  battle.updateEnemies(0, 0.016);
  assert.equal(battle.castTarget, tank);
}

// A dead target releases the attacker. A canceled attack callback cannot
// resolve or clear a newer attack, even when both actions have the same name.
{
  const tank = unit('tank', 'Tank');
  const enemy = unit('enemy', 'Enemy', 10);
  const battle = scene([tank], [enemy]);
  battle.beginBasicAttack(tank, enemy, 0, 'melee');
  enemy.alive = false;
  battle.timers.shift()();
  assert.equal(tank.pendingAction, null);
  enemy.alive = true;
  battle.beginBasicAttack(tank, enemy, 1, 'melee');
  tank.finishAction();
  battle.beginBasicAttack(tank, enemy, 2, 'melee');
  const current = tank.pendingAction;
  battle.timers.shift()();
  assert.equal(tank.pendingAction, current);
  assert.equal(battle.hits, undefined);
  battle.timers.shift()();
  assert.equal(battle.hits, 1);
  assert.equal(tank.pendingAction, null);
}

// Taunting an enemy cancels an already queued attack on a vulnerable ally.
{
  const tank = unit('tank', 'Tank');
  tank.abilities = CLASS_DEFINITIONS.Dawnwarden.abilities;
  const wizard = unit('wizard', 'Ranged DPS', 5);
  const enemy = unit('enemy', 'Enemy');
  const battle = scene([tank, wizard], [enemy]);
  battle.beginBasicAttack(enemy, wizard, 0, 'enemy');
  battle.applyTankTaunt(tank, [enemy], 'challenge', 1);
  battle.timers.shift()();
  assert.equal(battle.hits, undefined);
  assert.equal(enemy.currentTargetId, tank.id);
  assert.equal(battle.getHighestThreatTarget(enemy), tank);
}

// Healing creates normal threat only on enemies already opened by the tank.
{
  const tank = unit('tank', 'Tank');
  const healer = unit('healer', 'Healer');
  const engaged = unit('engaged', 'Enemy');
  const untouched = unit('untouched', 'Enemy');
  engaged.engagedByTank = true;
  const battle = scene([tank, healer], [engaged, untouched]);
  tank.hp = 50;
  tank.maxHp = 100;
  tank.heal = (amount) => {

    tank.hp += amount; };
  tank.flash = () => {

    };
  battle.rollCritical = () => false;
  battle.createFloatingText = () => {

    };
  battle.resolveHeal(healer, tank, 20, 'Mend');
  assert.equal(battle.enemyThreat.get(engaged.id).get(healer.id), 9);
  assert.equal(battle.enemyThreat.get(untouched.id).has(healer.id), false);
}

// A basic heal restores a small amount after its windup and observes cooldown.
{
  const healer = unit('healer', 'Healer');
  const ally = unit('ally', 'Tank', 10);
  healer.basicHealPower = 8;
  healer.basicHealRange = 3;
  healer.healCooldown = 1600;
  healer.healWindup = 400;
  healer.lastHealAt = -Infinity;
  ally.hp = 50;
  ally.maxHp = 100;
  const battle = scene([healer, ally], []);
  battle.classAbilitySystem = { distance: () => 1 };
  battle.resolveHeal = (caster, target, amount) => { target.hp += amount; };
  battle.beginBasicHeal(healer, ally, 0);
  assert.equal(ally.hp, 50);
  assert.equal(healer.canHeal(1600), false, 'the active windup blocks another action');
  battle.time.now = 400;
  battle.timers.shift()();
  assert.equal(ally.hp, 58);
  assert.equal(healer.canHeal(1599), false);
  assert.equal(healer.canHeal(1600), true);
  battle.beginBasicHeal(healer, ally, 1600);
  ally.hp = 100;
  battle.time.now = 2000;
  battle.timers.shift()();
  assert.equal(ally.hp, 100, 'the heal does not apply after the target recovers');
}

// Delayed or area damage cannot bypass engagement on untouched enemies.
{
  const tank = unit('tank', 'Tank');
  const wizard = unit('wizard', 'Ranged DPS');
  const enemy = unit('enemy', 'Enemy');
  const battle = scene([tank, wizard], [enemy]);
  enemy.takeDamage = () => {

    throw new Error('Untouched enemy was hit'); };
  BattleScene.prototype.resolveDamage.call(battle, wizard, enemy, 100, 'spell');
  assert.equal(battle.enemyThreat.get(enemy.id).size, 0);
}

// Enemy defeat pays its reward once and keeps the container for its death animation.
{
  const enemy = unit('enemy', 'Enemy');
  enemy.definition = { goldMin: 3, goldMax: 3 };
  enemy.container.destroy = () => { enemy.container.destroyed = true; enemy.container.active = false; };
  enemy.hitZone.disableInteractive = () => { enemy.hitZone.disabled = true; };
  const battle = scene([], [enemy]);
  battle.earnedGold = 0;
  BattleScene.prototype.handleEnemyDeath.call(battle, enemy);
  assert.equal(battle.earnedGold, 3);
  assert.notEqual(enemy.container.destroyed, true);
  assert.equal(enemy.hitZone.disabled, true);
  BattleScene.prototype.handleEnemyDeath.call(battle, enemy);
  assert.equal(battle.earnedGold, 3);
}

// No living enemies means no wasted new-class ability cooldowns.
{
  const tank = unit('tank', 'Tank');
  tank.abilities = CLASS_DEFINITIONS.Dawnwarden.abilities;
  const battle = scene([tank], []);
  new ClassAbilitySystem(battle).update(tank, 100, 0.016);
  assert.deepEqual(tank.lastAbilityAt, {});
}

// This function prepares real revival state with harmless visual hooks.
function fallenUnit(id, maxMana) {

  const ally = unit(id, 'Tank');
  Object.assign(ally, {
    alive: false, hp: 0, maxHp: 200, mana: 0, maxMana,
    color: 0xffffff, status: { stunnedUntil: 99999 },
    delvesUsed: { protectiveShield: true }, lastAbilityAt: { taunt: 100 },
    body: { setFillStyle() {} },
    container: { x: 0, y: 0, setAlpha() {} }, updateHealthBar() {}
  });
  return ally;
}

// Arise restores every fallen ally at half resources, clears stale orders,
// and preserves class cooldowns and once-per-delve usage. A second use,
// even in a later wave, cannot revive anyone again.
{
  const first = fallenUnit('first', 80);
  const second = fallenUnit('second', 0);
  const living = unit('living', 'Healer');
  living.hp = 75;
  const battle = scene([first, second, living], []);
  context.GameState.leader = { unlockedAbilities: ['arise'], battleLoadout: ['arise'] };
  battle.usedLeaderAbilities = new Set();
  battle.leaderAbilityCooldowns = new Map();
  battle.awaitingRevive = true;
  battle.updateHud = () => {};
  battle.manualTargets.set(first.id, { x: 100, y: 100 });
  battle.heldUnitIds.add(first.id);
  battle.attackTargets.set(first.id, 'old');
  battle.useLeaderAbility('arise');
  assert.equal(first.alive, true);
  assert.equal(second.alive, true);
  assert.equal(first.hp, 100);
  assert.equal(first.mana, 40);
  assert.equal(second.mana, 0);
  assert.equal(living.hp, 75);
  assert.equal(first.status.stunnedUntil, 0);
  assert.equal(first.lastAbilityAt.taunt, 100);
  assert.equal(first.delvesUsed.protectiveShield, true);
  assert.equal(battle.manualTargets.has(first.id), false);
  assert.equal(battle.heldUnitIds.has(first.id), false);
  assert.equal(battle.attackTargets.has(first.id), false);
  assert.equal(battle.awaitingRevive, false);
  first.alive = false;
  battle.currentWaveIndex = 3;
  battle.time.now = 100000;
  battle.useLeaderAbility('arise');
  assert.equal(first.alive, false);
}

// An empty resurrection attempt consumes nothing, and a locked or
// unequipped tactic cannot be activated by calling the handler directly.
{
  const ally = unit('ally', 'Healer');
  const battle = scene([ally], []);
  battle.usedLeaderAbilities = new Set();
  battle.leaderAbilityCooldowns = new Map();
  context.GameState.leader = { unlockedAbilities: ['arise'], battleLoadout: ['arise'] };
  battle.useLeaderAbility('arise');
  assert.equal(battle.usedLeaderAbilities.size, 0);
  assert.equal(battle.leaderAbilityCooldowns.size, 0);
  context.GameState.leader.battleLoadout = [];
  assert.equal(battle.isLeaderAbilityReady('arise'), false);
}

// Sturm's honor sacrifice makes him ineligible for any revival this encounter.
{
  const sturm = fallenUnit('sturm', 100);
  sturm.delvesUsed.honorSacrifice = true;
  const battle = scene([sturm, unit('survivor', 'Melee DPS')], []);
  battle.usedLeaderAbilities = new Set();
  battle.leaderAbilityCooldowns = new Map();
  context.GameState.leader = { unlockedAbilities: ['arise'], battleLoadout: ['arise'] };
  assert.equal(sturm.revive(1, 1), false);
  battle.useLeaderAbility('arise');
  assert.equal(sturm.alive, false);
  assert.equal(battle.usedLeaderAbilities.size, 0);
}

// Paused choices remain interactive: orders set their state immediately and
// valid tactics wait until resume before changing encounter resources.
{
  const ally = unit('ally', 'Healer');
  ally.hp = 50;
  ally.maxHp = 100;
  const battle = scene([ally], []);
  context.GameState.leader = { unlockedAbilities: ['preparedSupplies'], battleLoadout: ['preparedSupplies'] };
  context.GameState.inventory = { healingTonic: 0 };
  battle.usedLeaderAbilities = new Set();
  battle.leaderAbilityCooldowns = new Map();
  battle.combatPaused = true;
  battle.selectedUnitIds.add(ally.id);
  battle.armCommand('HOLD');
  assert.equal(battle.heldUnitIds.has(ally.id), true);
  battle.useLeaderAbility('preparedSupplies');
  assert.equal(battle.pendingPausedTactics.length, 1);
  assert.equal(battle.pendingPausedTactics[0], 'preparedSupplies');
  assert.equal(context.GameState.inventory.healingTonic, 0);
  battle.combatPaused = false;
  battle.flushPausedTactics();
  assert.equal(context.GameState.inventory.healingTonic, 1);
  assert.equal(battle.pendingPausedTactics.length, 0);
}

// A healer-only selection assigns an ally healing priority, clears a stale
// attack/hold order, and keeps that target ahead of a more injured ally until
// the selected target reaches full health.
{
  const healer = unit('healer', 'Healer');
  healer.healRange = 100;
  healer.healPower = 10;
  healer.healCooldown = 0;
  healer.lastHealAt = -Infinity;
  const priority = unit('priority', 'Tank', 10);
  priority.maxHp = 100;
  priority.hp = 90;
  const lowerHealth = unit('lower', 'Melee DPS', 20);
  lowerHealth.maxHp = 100;
  lowerHealth.hp = 20;
  const battle = scene([healer, priority, lowerHealth], []);
  battle.selectedUnitIds.add(healer.id);
  battle.attackTargets.set(healer.id, 'old-enemy');
  battle.manualTargets.set(healer.id, { x: 0, y: 0 });
  battle.heldUnitIds.add(healer.id);
  battle.toggleUnitSelection(priority);
  assert.equal(battle.healerPriorityTargets.get(healer.id), priority.id);
  assert.equal(battle.attackTargets.has(healer.id), false);
  assert.equal(battle.manualTargets.has(healer.id), false);
  assert.equal(battle.heldUnitIds.has(healer.id), false);
  priority.hp = priority.maxHp;
  assert.equal(battle.getHealerPriorityTarget(healer), null);
  assert.equal(battle.healerPriorityTargets.has(healer.id), false);
}

// Full-party defeat waits for an equipped, unused Arise. Once it has been
// spent, a later wipe proceeds to defeat instead of waiting indefinitely.
{
  const ally = fallenUnit('ally', 0);
  const enemy = unit('enemy', 'Enemy');
  const battle = scene([ally], [enemy]);
  Object.assign(battle, {
    usedLeaderAbilities: new Set(), leaderAbilityCooldowns: new Map(),
    updatePartyUnit() {}, updateEnemies() {},
    updateHud() {}, updateTonicHud() {},
    finishDefeat() { battle.defeated = true; }
  });
  ally.clampToBattlefield = () => {};
  enemy.clampToBattlefield = () => {};
  context.GameState.leader = { unlockedAbilities: ['arise'], battleLoadout: ['arise'] };
  battle.update(0, 16);
  assert.equal(battle.awaitingRevive, true);
  assert.equal(battle.defeated, undefined);
  battle.useLeaderAbility('arise');
  assert.equal(ally.alive, true);
  ally.alive = false;
  battle.update(16, 16);
  assert.equal(battle.defeated, true);
}

// Ability announcements last exactly 50% longer, while ordinary and
// critical damage text retain their original animation durations.
{
  const battle = scene([], []);
  const durations = [];
  const label = {
    setOrigin() { return this; }, setDepth() { return this; },
    setScale() { return this; }, destroy() {}
  };
  battle.add = { text: () => label };
  battle.tweens = { add: (options) => durations.push(options.duration) };
  battle.battlefield = { topY: 450 };
  battle.createFloatingText(100, 600, '-10', '#fff');
  battle.createFloatingText(100, 600, '-20', '#fff', true);
  BattleScene.prototype.announceAbility.call(battle, unit('caster', 'Healer'), 'Mend');
  assert.deepEqual(durations, [760, 1050, 1140]);
}

// A boss slam must complete its damage and cleanup without relying on the
// separate message-duration multiplier.
{
  const ally = unit('ally', 'Tank');
  const boss = unit('boss', 'Enemy');
  const ability = { name: 'Ground Slam', telegraph: 100, radius: 120, power: 20 };
  boss.abilities.primary = ability;
  const battle = scene([ally], [boss]);
  const durations = [];
  const ellipse = {
    setStrokeStyle() { return this; }, setDepth() { return this; }, destroy() {}
  };
  battle.add = { ellipse: () => ellipse };
  battle.tweens = { add: (options) => durations.push(options.duration) };
  battle.battlefield = {
    arenaToScreen: (x, y) => ({ x, y }),
    getGroundEllipseRadii: () => ({ width: 120, height: 60 })
  };
  battle.beginGroundSlam(boss, ally, 0, ability);
  battle.timers.shift()();
  assert.equal(battle.hits, 1);
  assert.equal(boss.pendingAction, null);
  assert.equal(battle.activeTelegraphs.length, 0);
  assert.deepEqual(durations, [100, 260]);
}

// Manual tonic use targets only the chosen injured ally and never wastes stock.
{
  const first = unit('first', 'Tank');
  const second = unit('second', 'Healer');
  for (const ally of [first, second]) {
    ally.hp = 20;
    ally.maxHp = 100;
    ally.updateHealthBar = () => {};
    ally.flash = () => {};
  }
  const battle = scene([first, second], []);
  battle.lastTonicUseAt = -Infinity;
  battle.createFloatingText = () => {};
  battle.updateHud = () => {};
  context.GameState.inventory = { healingTonic: 3 };
  assert.equal(battle.useHealingTonic(first, 0), true);
  assert.equal(first.hp, 55);
  assert.equal(second.hp, 20);
  assert.equal(context.GameState.inventory.healingTonic, 2);
  assert.equal(second.hp, 20);
  assert.equal(battle.useHealingTonic(second, 1499), false);
  assert.equal(battle.useHealingTonic(second, 1500), true);
  assert.equal(second.hp, 55);
  assert.equal(context.GameState.inventory.healingTonic, 1);
  first.hp = 100;
  assert.equal(battle.useHealingTonic(first, 3000), false);
  first.hp = 0;
  first.alive = false;
  assert.equal(battle.useHealingTonic(first, 3000), false);
  battle.combatPaused = true;
  assert.equal(battle.useHealingTonic(second, 3000), false);
  battle.combatPaused = false;
  second.hp = 90;
  assert.equal(battle.useHealingTonic(second, 3000), true);
  assert.equal(second.hp, 100);
  assert.equal(context.GameState.inventory.healingTonic, 0);
  second.hp = 20;
  assert.equal(battle.useHealingTonic(second, 4500), false);
}

// Empty stock hides and disables controls; restocking pulses once and settles.
{
  const element = () => ({
    input: { enabled: true },
    setVisible(value) { this.visible = value; return this; },
    setAlpha(value) { this.alpha = value; return this; },
    setText(value) { this.text = value; return this; },
    setFillStyle() { return this; }
  });
  const battle = scene([], []);
  const tonicButton = element(), tonicLabel = element();
  battle.tonicHintText = element();
  battle.tonicCountText = element();
  battle.partyHud = [{ unit: {}, tonicButton, tonicLabel }];
  battle.canUseHealingTonic = () => true;
  context.GameState.inventory = { healingTonic: 0 };
  battle.updateTonicHud();
  assert.equal(battle.tonicHintText.visible, false);
  assert.equal(tonicButton.input.enabled, false);
  context.GameState.inventory.healingTonic = 1;
  battle.updateTonicHud();
  assert.equal(tonicButton.visible, true);
  assert.equal(tonicLabel.visible, true);
  assert.equal(tonicButton.input.enabled, true);
  battle.time.now = 250;
  battle.updateTonicHud();
  assert.ok(tonicButton.alpha < 1);
  assert.ok(battle.tonicHintText.alpha < 1);
  battle.time.now = 1600;
  battle.updateTonicHud();
  assert.equal(tonicButton.alpha, 1);
  context.GameState.inventory.healingTonic = 0;
  battle.updateTonicHud();
  assert.equal(tonicLabel.visible, false);
  assert.equal(tonicButton.input.enabled, false);
  context.GameState.inventory.healingTonic = 2;
  battle.updateTonicHud();
  assert.equal(battle.tonicFlashUntil, 3100);
}

console.log('Battle behavior checks passed.');
// Stealth suppresses direct targeting without erasing threat; pending attacks recheck it.
{
  const tank=unit('tank','Tank'), rogue=unit('scoundrel','Melee DPS'), enemy=unit('enemy','Enemy');
  const battle=scene([tank,rogue],[enemy]);
  battle.enemyThreat.get(enemy.id).set(rogue.id,100);
  rogue.stealthed=true;
  assert.equal(battle.getHighestThreatTarget(enemy),tank);
  assert.equal(battle.enemyThreat.get(enemy.id).get(rogue.id),100);
  battle.beginBasicAttack(enemy,rogue,0,'enemy');battle.timers[0]();assert.equal(battle.hits,undefined);
  rogue.stealthed=false;assert.equal(battle.getHighestThreatTarget(enemy),rogue);
}
// Enrage and recovery affect actual damage, while new stuns survive further hits.
{
  const barbarian=unit('barbarian','Melee DPS'), enemy=unit('enemy','Enemy');
  const battle=scene([barbarian],[enemy]);
  Object.assign(battle,{rollCritical:()=>false,flashTargetCell(){},createFloatingText(){},createMeleePulse(){}});
  Object.assign(enemy,{hp:1000,maxHp:1000,flash(){},takeDamage(amount){this.hp-=amount;}});
  Object.assign(barbarian.status,{enrageUntil:10000,exhaustedUntil:20000,enrageDamage:3,exhaustedDamage:0.5});
  enemy.status.stunnedUntil=6000;enemy.status.hardStunUntil=6000;
  BattleScene.prototype.resolveDamage.call(battle,barbarian,enemy,10,'melee');assert.equal(enemy.hp,970);assert.equal(enemy.status.stunnedUntil,6000);
  battle.time.now=10000;BattleScene.prototype.resolveDamage.call(battle,barbarian,enemy,10,'melee');assert.equal(enemy.hp,965);
  battle.time.now=20000;BattleScene.prototype.resolveDamage.call(battle,barbarian,enemy,10,'melee');assert.equal(enemy.hp,955);
}
// Vow immunity also covers direct/environmental damage, and expires exactly on time.
{
  const defender=unit('ally','Healer');
  Object.assign(defender,{hp:100,maxHp:100,armor:0,damageTakenMultiplier:1,updateHealthBar(){}});
  defender.status.immuneUntil=5000;
  defender.takeDamage(1000,{time:4999});assert.equal(defender.hp,100);
  defender.takeDamage(10,{time:5000});assert.equal(defender.hp,90);
}
// Real damage pipeline redirects a parry without taking damage; immunity bypasses parry.
{
  const oath=unit('oath','Tank'),enemy=unit('enemy','Enemy');
  Object.assign(oath,{abilities:CLASS_DEFINITIONS.Oathwarden.abilities,hp:100,maxHp:100});
  Object.assign(enemy,{hp:100,maxHp:100,flash(){},takeDamage(n){this.hp-=n;}});
  const battle=scene([oath],[enemy]);
  Object.assign(battle,{rollCritical:()=>false,flashTargetCell(){},createFloatingText(){},createMeleePulse(){},assaultUntil:10000,assaultBonus:0.2});
  battle.resolveDamage=BattleScene.prototype.resolveDamage;
  battle.classAbilitySystem=new ClassAbilitySystem(battle);
  oath.status.blindUntil=10000;oath.status.blindChance=1;
  // The system's random roll uses the module realm.
  const original=Math.random;
  try {Math.random=()=>0;battle.resolveDamage(enemy,oath,20,'enemy');} finally {Math.random=original;}
  assert.equal(oath.hp,100);assert.equal(enemy.hp,80,'reflection is not amplified by party assault');
  oath.status.immuneUntil=10000;battle.time.now=3000;
  battle.resolveDamage(enemy,oath,20,'enemy');assert.equal(oath.hp,100);assert.equal(oath.lastAbilityAt.parry,0);
}
// Staunch Defense applies its reduction and six-second forced target window to every in-range enemy.
{
  const oath=unit('oath','Tank'),enemy=unit('enemy','Enemy',150,50);
  Object.assign(oath,{className:'Oathwarden',abilities:CLASS_DEFINITIONS.Oathwarden.abilities,arenaX:50,arenaY:50});
  const battle=scene([oath],[enemy]);
  battle.battlefield={columns:8,rows:6,logicalWidth:800,logicalHeight:600,arenaPointToCell:(x,y)=>({column:Math.floor(x/100),row:Math.floor(y/100)})};
  const system=new ClassAbilitySystem(battle);
  system.update(oath,100,0);
  assert.equal(enemy.status.forcedTargetUntil,6100);assert.equal(oath.status.damageReduction,0.75);assert.equal(oath.status.damageReductionUntil,6100);
}

// Each wave waits through all three displayed seconds before its enemies spawn.
{
  const battle = scene([unit('ally', 'Tank')], []);
  const titles = [];
  const countdown = [];
  const spawned = [];
  battle.waves = [
    { name: 'Cave Entrance', enemies: [{ type: 'caveSlime' }] },
    { name: 'The Slime Sovereign', boss: true, enemies: [{ type: 'slimeSovereign' }] }
  ];
  Object.assign(battle, {
    battlefield: {
      rows: 6, columns: 10,
      arenaPointToCell: () => ({ column: 0, row: 0 }),
      getCellCenter: (column, row) => ({ x: column * 175 + 87.5, y: row * 150 + 75 })
    },
    terrain: { isBlocked: () => false, isUnitBlocked: () => false },
    showWaveAnnouncement(title, isBoss) { titles.push({ title, isBoss }); },
    updateWaveCountdown(seconds) { countdown.push(seconds); },
    clearWaveAnnouncement() {},
    updateEncounterStatus() {},
    setTargetingInputState() {},
    animateEnemyLanding() {},
    createEnemy(type) { spawned.push(type); return { id: type }; },
    combatLog: { add() {} }
  });
  for (const index of [0, 1]) {
    battle.startWave(index);
    assert.equal(battle.waveTransitioning, true);
    assert.equal(spawned.length, index);
    for (let second = 2; second >= 1; second--) {
      battle.timers.shift()();
      assert.equal(countdown.at(-1), second);
      assert.equal(spawned.length, index);
    }
    battle.timers.shift()();
    assert.equal(spawned.length, index + 1);
    assert.equal(battle.waveTransitioning, false);
  }
  assert.deepEqual(titles, [
    { title: 'WAVE 1', isBoss: false },
    { title: 'The Slime Sovereign', isBoss: true }
  ]);
  assert.deepEqual(countdown, [3, 2, 1, 3, 2, 1]);
}

// Landing visuals bounce from above while the monster stays out of combat.
{
  const battle = scene([], []);
  const image = { y: 30 };
  const label = () => ({ setAlpha(value) { this.alpha = value; } });
  const enemy = {
    alive: true, arenaY: 600, container: { y: 500, active: true },
    spriteVisual: { image }, hitZone: { setInteractive() { this.enabled = true; } },
    label: label(), targetLabel: label(), actionLabel: label(),
    hpBack: label(), hpFill: label(), castBack: label(), castFill: label()
  };
  battle.enemies = [enemy];
  battle.battlefield = { topY: 200, getUnitScale: () => 1 };
  let tween;
  battle.tweens = { add(config) { tween = config; } };
  battle.animateEnemyLanding(enemy);
  assert.equal(enemy.landing, true);
  assert.ok(image.y < 30);
  assert.equal(tween.ease, 'Bounce.Out');
  assert.equal(battle.getLivingEnemies().length, 0);
  tween.onComplete();
  assert.equal(enemy.landing, false);
  assert.equal(enemy.hitZone.enabled, true);
  assert.equal(enemy.label.alpha, 1);
}

// Crowded squares defer monsters until a legal landing opens.
{
  const battle = scene([unit('ally', 'Tank', 87.5, 75)], []);
  let blocked = true;
  const created = [];
  battle.waves = [{ name: 'Crowded cave', enemies: [{ type: 'caveSlime' }] }];
  battle.battlefield = {
    rows: 6, columns: 10,
    arenaPointToCell: (x, y) => ({ column: Math.floor(x / 175), row: Math.floor(y / 150) }),
    getCellCenter: (column, row) => ({ x: (column + 0.5) * 175, y: (row + 0.5) * 150 })
  };
  battle.terrain = { isBlocked: () => blocked, isUnitBlocked: () => blocked };
  battle.combatLog = { add() {} };
  battle.setTargetingInputState = () => {};
  battle.createEnemy = (type, point) => {
    const enemy = { id: type, arenaX: point.x, arenaY: point.y };
    created.push(enemy);
    return enemy;
  };
  battle.animateEnemyLanding = () => {};
  battle.spawnWave(0);
  assert.equal(created.length, 0);
  assert.equal(battle.pendingWaveSpawns.length, 1);
  blocked = false;
  battle.timers.shift()();
  assert.equal(created.length, 1);
  assert.equal(battle.pendingWaveSpawns.length, 0);
}

// Clearing a wave restores only living allies below half HP without using tonics.
{
  const low = unit('low', 'Tank');
  const healthy = unit('healthy', 'Healer');
  const fallen = unit('fallen', 'Melee DPS');
  low.maxHp = 101; low.hp = 12; low.updateHealthBar = () => {};
  healthy.maxHp = 100; healthy.hp = 72; healthy.updateHealthBar = () => {};
  fallen.maxHp = 100; fallen.hp = 0; fallen.alive = false;
  const battle = scene([low, healthy, fallen], []);
  battle.waves = [{}, {}];
  battle.currentWaveIndex = 0;
  battle.updateHud = () => {};
  battle.tweens = { add() {} };
  context.GameState.inventory = { healingTonic: 2 };
  battle.completeWave();
  assert.equal(low.hp, 51);
  assert.equal(healthy.hp, 72);
  assert.equal(fallen.hp, 0);
  assert.equal(context.GameState.inventory.healingTonic, 2);
  battle.completeWave();
  assert.equal(low.hp, 51, 'repeated completion cannot heal again');
}

// The next countdown starts two seconds after every living ally returns home.
{
  const ally = unit('ally', 'Tank', 100, 0);
  ally.moveSpeed = 150;
  ally.moveToward = function (x, y, delta, stopDistance, avoidUnits) {
    this.lastReturnDelta = delta;
    this.lastReturnAvoidUnits = avoidUnits;
    this.arenaX = Math.max(x, this.arenaX - this.moveSpeed * delta);
  };
  const fallen = unit('fallen', 'Healer', 300, 0);
  fallen.alive = false;
  const battle = scene([ally, fallen], []);
  battle.waves = [{}, {}];
  battle.currentWaveIndex = 0;
  battle.waveRetreating = true;
  battle.waveReturnPositions = new Map([['ally', { x: 0, y: 0 }], ['fallen', { x: 200, y: 0 }]]);
  let nextWave = null;
  battle.startWave = (index) => { nextWave = index; };

  battle.updateWaveRetreat(0, 0.05, 50);
  assert.equal(ally.lastReturnDelta, 0.1);
  assert.equal(ally.lastReturnAvoidUnits, false);
  assert.equal(nextWave, null);
  let time = 50;
  while (ally.arenaX > 6) {
    battle.updateWaveRetreat(time, 0.05, 50);
    time += 50;
  }
  const arrivedAt = time - 50;
  assert.equal(battle.waveReturnReadyAt, arrivedAt + 2000);
  battle.updateWaveRetreat(arrivedAt + 1999, 0.05, 50);
  assert.equal(nextWave, null);
  battle.updateWaveRetreat(arrivedAt + 2000, 0.05, 50);
  assert.equal(nextWave, 1);
  assert.equal(battle.waveRetreating, false);
}

// Return movement ignores living allies while retaining corpse and terrain checks.
{
  const ally = unit('left', 'Melee DPS', 100, 0);
  const battle = scene([ally], []);
  ally.scene = battle;
  let terrainChecked = false;
  battle.terrain.resolveStep = (unit, x, y) => {
    terrainChecked = true;
    return { x, y };
  };
  const steerStep = battle.movement.steerStep.bind(battle.movement);
  battle.movement.steerStep = (unit, dx, dy, includeLiving) => {
    assert.equal(includeLiving, false);
    return steerStep(unit, dx, dy, includeLiving);
  };
  ally.moveBy(-10, 0, false);
  assert.equal(ally.arenaX, 90);
  assert.equal(terrainChecked, true);
}

// The final wave also waits for the party to return before showing victory.
{
  const ally = unit('ally', 'Tank', 0, 0);
  const battle = scene([ally], []);
  battle.waves = [{}];
  battle.currentWaveIndex = 0;
  battle.waveRetreating = true;
  battle.waveReturnPositions = new Map([['ally', { x: 0, y: 0 }]]);
  let victories = 0;
  battle.finishVictory = () => { victories += 1; };
  battle.updateWaveRetreat(100, 0.05, 50);
  battle.updateWaveRetreat(2099, 0.05, 50);
  assert.equal(victories, 0);
  battle.updateWaveRetreat(2100, 0.05, 50);
  assert.equal(victories, 1);
}

// Victory and defeat keep their result visible until the player confirms.
{
  context.completeExpedition = () => ({});
  context.failExpedition = () => {};
  context.HapticsService.success = () => {};
  context.GameState.currentDelve = { name: 'Slime Cave' };
  context.GameState.gold = 0;

  for (const [outcome, expectedTitle, destination] of [
    ['victory', 'DELVE CLEARED!', 'RewardScene'],
    ['defeat', 'DEFEATED', 'EncounterSummaryScene']
  ]) {
    const battle = scene([], []);
    battle.waves = [{}];
    battle.earnedGold = 10;
    battle.combatLog = { finish() {} };
    let overlay;
    let openedScene;
    battle.scene = { start(name) { openedScene = name; } };
    battle.showResultOverlay = (title, subtitle, buttonLabel, callback) => {
      overlay = { title, subtitle, buttonLabel, callback };
    };

    if (outcome === 'victory') battle.finishVictory();
    else battle.finishDefeat();

    assert.equal(battle.battleOver, true);
    assert.equal(overlay.title, expectedTitle);
    assert.equal(overlay.buttonLabel, 'CONFIRM');
    assert.equal(openedScene, undefined);
    overlay.callback();
    assert.equal(openedScene, destination);
  }
}

// The encounter status also hides ordinary wave names while showing boss names.
{
  context.formatDuration = () => '0:03';
  context.GameState.run = { startedAt: Date.now() };
  const battle = scene([], []);
  battle.waves = [
    { name: 'Cavern Vermin' },
    { name: 'The Slime Sovereign', boss: true }
  ];
  battle.encounterStatusText = { setText(value) { this.value = value; } };
  battle.currentWaveIndex = 0;
  battle.updateEncounterStatus();
  assert.equal(battle.encounterStatusText.value, '(0:03) Wave 1/2');
  battle.currentWaveIndex = 1;
  battle.updateEncounterStatus();
  assert.equal(battle.encounterStatusText.value, '(0:03) The Slime Sovereign');
}
