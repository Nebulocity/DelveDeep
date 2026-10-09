// Exercise the actual boss casts without starting Phaser. Only drawings and scheduled
// timers are stand-ins; movement, damage, cooldowns and the Interrupt command stay real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import enemies from '../data/enemies.js';
import { abilityPower } from '../game/CharacterStats.js';

// Remove imports so Node can inspect scene methods without a browser or Phaser canvas.
function loadClass(path, name, globals = {}) {
  const context = vm.createContext(globals);
  vm.runInContext(fs.readFileSync(new URL(path, import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(`export default class ${name}`, `globalThis.Subject = class ${name}`), context);
  return context.Subject;
}

const Unit = loadClass('../combat/BattleUnit.js', 'BattleUnit');
const Battle = loadClass('../scenes/BattleScene.js', 'BattleScene', { Phaser: { Scene: class {} }, abilityPower });
const events = [];
const hits = [];
const prompts = [];
let destroyed = 0;
const battle = Object.assign(Object.create(Battle.prototype), {
  idleSimulating: true, battleOver: false, time: { now: 1000 }, activeTelegraphs: [],
  announceAbility() {}, setEnemyTarget() {}, logActionStart() {}, createProjectile() {},
  showBattleMessage(text) { prompts.push(text); },
  scheduleBattleEvent(delay, data, callback) { events.push({ delay, data, callback }); },
  resolveDamage(actor, victim, amount, type) { hits.push({ id: victim.id, amount, type }); },
  battlefield: { arenaToScreen: (x, y) => ({ x, y }), getGroundEllipseRadii: () => ({ width: 300, height: 180 }) },
  add: { ellipse: () => ({ setDepth() { return this; }, setStrokeStyle() { return this; }, destroy() { destroyed++; } }) },
  tweens: { add() {} }, tactics: { shouldAvoidMechanics: () => true },
  selectedUnitIds: new Set(), setTargetingInputState() {}, refreshTacticsMenus() {}
});
const boss = Object.assign(Object.create(Unit.prototype), enemies.abyssalSovereign, {
  id: 'boss', scene: battle, alive: true, isBoss: true, isEnemy: true,
  arenaX: 500, arenaY: 500, mana: 0, status: {}, pendingAction: null, lastAbilityAt: {},
  distanceTo(target) { return Math.hypot(target.arenaX - this.arenaX, target.arenaY - this.arenaY); }
});

// Distances use logical arena units. The real damage resolver checks each final position.
function member(id, x, alive = true) {
  return { id, alive, arenaX: x, arenaY: 500,
    distanceToPoint(x, y) { return Math.hypot(this.arenaX - x, this.arenaY - y); } };
}
const target = member('target', 650);
const escaped = member('escaped', 650);
battle.partyUnits = [target, escaped, member('dead', 650, false)];
assert.equal(battle.tryEnemyAbility(boss, target, 'primary', 1000), true);
assert.equal(events[0].delay, 3000);
assert.equal(battle.activeTelegraphs[0].arenaX, 650);
assert.equal(battle.activeTelegraphs[0].autoAvoid, false);
assert.match(prompts.at(-1), /MOVE/);
assert.equal(battle.tryEvadeTelegraph(target, 0.1), false, 'AI cannot dodge the boss warning');
escaped.arenaX = 1000;
battle.time.now = 4000;
events.shift().callback();
assert.deepEqual(hits, [{ id: 'target', amount: 120, type: 'enemy' }]);
assert.equal(battle.activeTelegraphs.length, 0);

// Soul Rend tracks the living target even after movement, but Interrupt cancels its hit.
battle.time.now = 5000;
battle.tryEnemyAbility(boss, target, 'secondary', 5000);
assert.equal(events[0].delay, 4000);
assert.match(prompts.at(-1), /INTERRUPT/);
target.arenaX = 1200;
battle.time.now = 9000;
events.shift().callback();
assert.deepEqual(hits.at(-1), { id: 'target', amount: 180, type: 'spell' });
battle.time.now = 23000;
battle.tryEnemyAbility(boss, target, 'secondary', 23000);
battle.commandMode = 'INTERRUPT';
battle.handleEnemyTap(boss);
const beforeInterrupt = hits.length;
events.shift().callback();
assert.equal(hits.length, beforeInterrupt);

// Ruin captures the boss's location. Moving the boss afterward cannot move the hazard.
target.arenaX = 650;
battle.time.now = 30000;
battle.tryEnemyAbility(boss, target, 'tertiary', 30000);
assert.equal(events[0].delay, 6000);
assert.equal(battle.activeTelegraphs[0].arenaX, 500);
assert.equal(battle.activeTelegraphs[0].radius, 300);
assert.equal(battle.tryEvadeTelegraph(target, 0.1), false);
boss.arenaX = 600;
target.arenaX = 800;
escaped.arenaX = 800.01;
battle.time.now = 36000;
events.shift().callback();
assert.deepEqual(hits.at(-1), { id: 'target', amount: 240, type: 'spell' });
assert.equal(hits.length, beforeInterrupt + 1, 'Only the living ally on the circle edge is hit');
assert.equal(boss.abilityReady('tertiary', 59999), false);
assert.equal(boss.abilityReady('tertiary', 60000), true);

// Canceling a warning destroys both drawings immediately; its queued callback is harmless.
battle.time.now = 60000;
battle.tryEnemyAbility(boss, target, 'tertiary', 60000);
const drawingsBefore = destroyed;
battle.commandMode = 'INTERRUPT';
battle.handleEnemyTap(boss);
assert.equal(destroyed, drawingsBefore + 2);
assert.equal(battle.activeTelegraphs.length, 0);
const beforeRuinCancel = hits.length;
events.shift().callback();
assert.equal(hits.length, beforeRuinCancel);
assert.equal(boss.mana, 0);

// Only the final Sovereign gets these mechanics; the retained Maw and guardian keep theirs.
assert.equal(enemies.abyssalMaw.abilities.primary.telegraph, 1450);
assert.equal(enemies.voidKeeperGuardian.abilities.tertiary, undefined);
assert.equal(abilityPower(boss, boss.abilities.tertiary), 240);
console.log('Sovereign movement, targeted interrupt, warning cleanup, cooldowns and damage passed.');
