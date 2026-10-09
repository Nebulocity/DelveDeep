// Check Consume's real cast and hit handlers with small display stand-ins. Positions
// below use logical arena units, not screen pixels or tactical cells.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import enemies from '../data/enemies.js';
import { abilityPower } from '../game/CharacterStats.js';

// Load the actual class methods without starting Phaser. Only presentation dependencies
// are replaced; the cast center, range, cooldown and damage decisions remain real code.
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
const warnings = [];
const battle = Object.assign(Object.create(Battle.prototype), {
  activeTelegraphs: [],
  idleSimulating: true, battleOver: false, time: { now: 1000 },
  announceAbility() {}, setEnemyTarget() {}, logActionStart() {},
  scheduleBattleEvent(delay, data, callback) { events.push({ delay, data, callback }); },
  createSlamTelegraph(actor, ability, center, duration) {
    const warning = { attacker: actor, ...center, radius: ability.radius, duration };
    warnings.push(warning);
    return warning;
  },
  removeTelegraph(warning) { warnings.splice(warnings.indexOf(warning), 1); },
  resolveDamage(actor, victim, amount, type, threat, name, allowCrit) {
    hits.push({ victim: victim.id, amount, type, name, allowCrit });
  },
  battlefield: { arenaToScreen: (x, y) => ({ x, y }), getGroundEllipseRadii: () => ({ width: 300, height: 180 }) },
  add: { ellipse: () => ({ setDepth() { return this; }, setStrokeStyle() { return this; }, destroy() {} }) },
  tweens: { add() {} }
});

// The authored attack is read from the same normalized catalog that creates live enemies.
const ability = enemies.slimeSovereign.abilities.tertiary;
assert.equal(ability.name, 'Consume');
assert.equal(ability.damageType, 'physical');
assert.equal(ability.power, 300);
assert.equal(abilityPower(enemies.slimeSovereign, ability), 690);
assert.equal(ability.cooldown, 16000);
assert.equal(ability.windup, 6000);
assert.equal(ability.telegraph, 6000);
assert.equal(ability.radius, 500);
assert.equal(ability.castRange, Number.MAX_SAFE_INTEGER);
assert.equal(ability.areaCenter, 'caster');
assert.equal(ability.manaCost, 0);
assert.equal(ability.autoAvoid, false);

const boss = Object.assign(Object.create(Unit.prototype), enemies.slimeSovereign, {
  id: 'sovereign', scene: battle, alive: true, isBoss: true, isEnemy: true,
  arenaX: 500, arenaY: 500, hp: enemies.slimeSovereign.maxHp, mana: 0,
  status: {}, pendingAction: null, lastAbilityAt: {}, distanceTo: () => 300
});
const target = { id: 'threat-target', alive: true, arenaX: 800, arenaY: 500 };
assert.equal(battle.tryEnemyAbility(boss, target, 'tertiary', 1000), true);
assert.equal(events.length, 1, 'Windup and warning are one six-second phase');
assert.equal(events[0].delay, 6000);
assert.equal(boss.busyUntil, 7000);
assert.equal(warnings[0].arenaX, boss.arenaX, 'Consume surrounds the boss, not its target');
assert.equal(warnings[0].arenaY, boss.arenaY);
assert.equal(boss.lastAbilityAt.tertiary, 1000);
assert.equal(boss.lastAbilityAt.primary, undefined);
assert.equal(boss.mana, 0);

// A party member can leave during the warning. Exactly 500 units is inside; anything
// beyond the circle and any dead party member must escape damage.
function member(id, x, alive = true) {
  return { id, alive, arenaX: x, arenaY: 500,
    distanceToPoint(centerX, centerY) { return Math.hypot(this.arenaX - centerX, this.arenaY - centerY); } };
}
const escaped = member('escaped', 650);
battle.partyUnits = [member('inside', 600), member('edge', 1000), member('outside', 1000.01), member('dead', 550, false), escaped];
escaped.arenaX = 1100;
battle.time.now = 7000;
events.shift().callback();
assert.deepEqual(hits.map(hit => hit.victim), ['inside', 'edge']);
assert.ok(hits.every(hit => hit.type === 'enemy' && hit.name === 'Consume' && hit.allowCrit === false));
assert.ok(hits.every(hit => hit.amount === abilityPower(boss, ability)));
assert.equal(boss.pendingAction, null);
assert.equal(warnings.length, 0);
assert.equal(boss.abilityReady('tertiary', 16999), false);
assert.equal(boss.abilityReady('tertiary', 17000), true);
boss.distanceTo = () => 900;
assert.equal(battle.tryEnemyAbility(boss, target, 'tertiary', 17000), true);
boss.finishAction();
events.length = 0;
warnings.length = 0;

// Existing target-centered slams retain their targeting, and canceled Consume casts
// remove the warning without hitting the party or finishing an unrelated action.
boss.distanceTo = () => 100;
battle.beginGroundSlam(boss, target, 33000, boss.abilities.secondary, 'secondary');
assert.equal(warnings[0].arenaX, target.arenaX);
events.length = 0;
warnings.length = 0;
boss.finishAction();
battle.tryEnemyAbility(boss, target, 'tertiary', 33000);
// Use the real player Interrupt command, then let the old delayed callback run. Its
// canceled action identity must prevent damage even after the command has finished.
battle.commandMode = 'INTERRUPT';
battle.selectedUnitIds = new Set();
battle.showBattleMessage = () => {};
battle.setTargetingInputState = () => {};
battle.refreshTacticsMenus = () => {};
battle.handleEnemyTap(boss);
assert.equal(boss.pendingAction, null);
assert.equal(battle.commandMode, null);
const hitsBeforeCancel = hits.length;
events.shift().callback();
assert.equal(hits.length, hitsBeforeCancel);
assert.equal(warnings.length, 0);

// Verify the real warning carries Consume's manual-response rule. Other slams and old
// saved warnings still use automatic avoidance, so this mechanic does not change them.
battle.activeTelegraphs = [];
battle.tactics = { shouldAvoidMechanics: () => true };
const consumeWarning = Battle.prototype.createSlamTelegraph.call(battle, boss, ability,
  { arenaX: 500, arenaY: 500 }, 6000);
assert.equal(consumeWarning.autoAvoid, false);
let evades = 0;
const dodger = { alive: true, distanceToPoint: () => 0, finishAction() {}, moveAwayFrom() { evades++; } };
assert.equal(battle.tryEvadeTelegraph(dodger, 0.1), false);
assert.equal(evades, 0);
const ordinaryWarning = Battle.prototype.createSlamTelegraph.call(battle, boss, boss.abilities.secondary,
  { arenaX: 500, arenaY: 500 }, 1350);
assert.equal(ordinaryWarning.autoAvoid, true);
assert.equal(battle.tryEvadeTelegraph(dodger, 0.1), true);
delete ordinaryWarning.autoAvoid;
assert.equal(battle.tryEvadeTelegraph(dodger, 0.1), true);
console.log('Consume cast timing, boss-centered warning, radius, escape, no-crit damage, cooldown and cancellation passed.');
