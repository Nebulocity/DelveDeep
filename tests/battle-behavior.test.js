import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { CLASS_DEFINITIONS } from '../data/classes.js';
import { leaderAbilities } from '../game/LeaderProgression.js';
import { createEncounterWaves } from '../data/encounters.js';
import { getBattleLayout } from '../ui/Layout.js';

const context = vm.createContext({
  leaderAbilities, createEncounterWaves, getBattleLayout,
  Phaser: {
    Scene: class {},
    Math: {
      Distance: { Between: (x, y, tx, ty) => Math.hypot(tx - x, ty - y) }
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
    }
  });
}

// This function creates a scene with controllable delayed callbacks and
// harmless display hooks while retaining the real battle decision methods.
function scene(party, enemies) {

  const timers = [];
  return Object.assign(Object.create(BattleScene.prototype), {
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
  tank.alive = false;
  healer.alive = false;
  battle.selectRole('All');
  assert.equal(battle.selectedUnitIds.size, 0);
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
  battle.focusTargetId = other.id;
  battle.handleEnemyTap(enemy);
  assert.equal(battle.heldUnitIds.has(tank.id), false);
  assert.equal(battle.heldUnitIds.has(ally.id), true);
  assert.equal(battle.manualTargets.has(tank.id), false);
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

// Tanks close on distant targets, but a deliberate Hold still prevents it.
{
  const tank = unit('tank', 'Tank');
  const enemy = unit('enemy', 'Enemy', 1300, 850);
  const battle = scene([tank], [enemy]);
  battle.updateTankUnit(tank, enemy, 0, 0.016);
  assert.equal(tank.lastMove.x, enemy.arenaX);
  assert.ok(tank.lastMove.stopDistance < tank.attackRange);
  tank.lastMove = null;
  battle.heldUnitIds.add(tank.id);
  battle.updateTankUnit(tank, enemy, 0, 0.016);
  assert.equal(tank.lastMove, null);
}

// Every tank class gets independent 8-second and 16-second cooldowns. Area
// taunts skip current tank targets and pull the closest three others.
for (const definition of Object.values(CLASS_DEFINITIONS).filter(entry => entry.role === 'Tank')) {
  const tank = unit('tank', 'Tank');
  tank.abilities = definition.abilities;
  const enemies = [100, 20, 300, 80, 200, 700].map((x, index) => unit(`enemy${index}`, 'Enemy', x));
  enemies[1].currentTargetId = tank.id;
  const battle = scene([tank], enemies);
  battle.tryTankTaunts(tank, 0);
  assert.deepEqual(enemies.filter(enemy => enemy.currentTargetReason === 'Challenging Shout').map(enemy => enemy.arenaX), [100, 80, 200]);
  assert.equal(tank.abilityReady('areaTaunt', 15999), false);
  assert.equal(tank.abilityReady('areaTaunt', 16000), true);
  battle.tryTankTaunts(tank, 1);
  assert.equal(enemies[2].currentTargetId, tank.id);
  assert.equal(tank.abilityReady('taunt', 8000), false);
  assert.equal(tank.abilityReady('taunt', 8001), true);
  assert.equal(enemies[5].currentTargetId, undefined);
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
  tank.abilities = CLASS_DEFINITIONS.Paladin.abilities;
  const wizard = unit('wizard', 'Ranged DPS', 5);
  const enemy = unit('enemy', 'Enemy');
  const battle = scene([tank, wizard], [enemy]);
  battle.beginBasicAttack(enemy, wizard, 0, 'enemy');
  battle.applyTankTaunt(tank, [enemy], 'taunt', 1);
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

// An explicit healer Attack waits for engagement and uses a basic attack.
// Once its target dies, normal healing decisions resume automatically.
{
  const tank = unit('tank', 'Tank');
  const healer = unit('healer', 'Healer');
  const enemy = unit('enemy', 'Enemy', 10);
  const battle = scene([tank, healer], [enemy]);
  battle.attackTargets.set(healer.id, enemy.id);
  battle.tryEvadeTelegraph = () => false;
  battle.updateHealerUnit = () => {

    battle.healingResumed = true; };
  battle.updatePartyUnit(healer, 0, 0.016);
  assert.equal(healer.pendingAction, null);
  enemy.engagedByTank = true;
  battle.updatePartyUnit(healer, 1, 0.016);
  assert.equal(healer.pendingAction.name, 'Attack');
  enemy.alive = false;
  battle.timers.shift()();
  battle.updatePartyUnit(healer, 2, 0.016);
  assert.equal(battle.healingResumed, true);
  assert.equal(battle.attackTargets.has(healer.id), false);
}

// No eligible enemies means no wasted taunt cooldowns.
{
  const tank = unit('tank', 'Tank');
  tank.abilities = CLASS_DEFINITIONS.Guardian.abilities;
  const enemy = unit('enemy', 'Enemy', 10);
  enemy.currentTargetId = tank.id;
  const battle = scene([tank], [enemy]);
  battle.tryTankTaunts(tank, 100);
  assert.equal(tank.lastAbilityAt.taunt, undefined);
  assert.equal(tank.lastAbilityAt.areaTaunt, undefined);
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

// Full-party defeat waits for an equipped, unused Arise. Once it has been
// spent, a later wipe proceeds to defeat instead of waiting indefinitely.
{
  const ally = fallenUnit('ally', 0);
  const enemy = unit('enemy', 'Enemy');
  const battle = scene([ally], [enemy]);
  Object.assign(battle, {
    usedLeaderAbilities: new Set(), leaderAbilityCooldowns: new Map(),
    updatePartyUnit() {}, updateEnemies() {}, applySeparation() {},
    tryUseHealingTonic() {}, updateHud() {},
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

// Manual tonic use targets only the chosen injured ally, never wastes stock,
// and shares its cooldown with automatic emergency healing.
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
  battle.tryUseHealingTonic(1499);
  assert.equal(second.hp, 20);
  battle.tryUseHealingTonic(1500);
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

console.log('Battle behavior checks passed.');
