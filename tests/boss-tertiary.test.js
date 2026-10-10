// Exercise the real enemy AI and cast methods without creating Phaser display objects.
// Small combat fixtures let us check priority, cooldowns, targeting and saved event data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { monsterStats, monsterAbilities } from '../game/MonsterStats.js';
import { abilityPower } from '../game/CharacterStats.js';
import { packBattleValue, unpackBattleValue } from '../game/BattleSnapshot.js';

// Remove imports for these isolated classes; tested methods receive their dependencies
// below. The game still imports the normal modules when running in the browser.
function loadClass(path, name, globals = {}) {
  const context = vm.createContext(globals);
  vm.runInContext(fs.readFileSync(new URL(path, import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(`export default class ${name}`, `globalThis.Subject = class ${name}`), context);
  return context.Subject;
}
const Unit = loadClass('../combat/BattleUnit.js', 'BattleUnit');
const Battle = loadClass('../scenes/BattleScene.js', 'BattleScene', { Phaser: { Scene: class {} }, abilityPower });
const target = { id: 'hero', alive: true, hp: 500, maxHp: 500, arenaX: 100, arenaY: 100 };
const events = [];
const hits = [];
const battle = Object.assign(Object.create(Battle.prototype), {
  idleSimulating: true, time: { now: 1000 },
  getHighestThreatTarget: () => target, setEnemyTarget() {}, announceAbility() {}, logActionStart() {},
  createSlamTelegraph: () => ({}), createProjectile() {}, isActionCurrent: () => true,
  scheduleBattleEvent(delay, data, callback) { events.push({ delay, data, callback }); },
  resolveDamage(actor, victim, amount) { hits.push({ victim, amount }); },
  resolveGroundSlam(actor, action, center, ability) { hits.push({ center, amount: abilityPower(actor, ability) }); actor.finishAction(); },
  resolveHeal(actor, victim, amount) { hits.push({ victim, healing: amount }); actor.finishAction(); },
  movement: { moveToCombatPosition() {} }, isWithinAttackReach: () => false
});

// Earlier slots start on cooldown so the first update must reach the tertiary slot.
function boss(tertiary = {}) {
  const stats = monsterStats({ attackPower: 40, spellHealing: 30, maxHp: 500, maxMana: 100,
    abilities: {
      primary: { name: 'Slam', power: 100, powerUnit: 'percent', cooldown: 5000, telegraph: 1000, radius: 100 },
      secondary: { name: 'Bolt', power: 100, powerUnit: 'percent', cooldown: 5000, windup: 300 },
      tertiary: { name: 'Third skill', power: 150, powerUnit: 'percent', cooldown: 9000, windup: 400, manaCost: 10, ...tertiary }
    }
  });
  return Object.assign(Object.create(Unit.prototype), stats, {
    id: 'test-boss', isBoss: true, isEnemy: true, alive: true, scene: battle,
    hp: 500, mana: 100, manaRegen: 0, status: {}, abilities: monsterAbilities(stats),
    pendingAction: null, busyUntil: 0, lastAbilityAt: { primary: 0, secondary: 0 },
    distanceTo: () => 100
  });
}
let enemy = boss();
battle.getLivingEnemies = () => [enemy];
battle.updateEnemies(1000, 0);
assert.equal(events.length, 1);
assert.equal(events[0].data.key, 'tertiary');
assert.equal(events[0].delay, 400);
assert.equal(enemy.mana, 90);
assert.equal(enemy.lastAbilityAt.primary, 0);
assert.equal(enemy.lastAbilityAt.secondary, 0);
assert.equal(enemy.lastAbilityAt.tertiary, 1000);
events.shift().callback();
assert.equal(hits.pop().amount, 60);
assert.equal(enemy.abilityReady('tertiary', 9999), false);
assert.equal(enemy.abilityReady('tertiary', 10000), true);
enemy.mana = 9;
assert.equal(enemy.abilityReady('tertiary', 10000), false);

// A ground cast must use its own mana cost and cooldown, and retain the ordinary saved
// groundSlam event kind so existing version-1 battle saves remain compatible.
enemy = boss({ telegraph: 1200, radius: 140, manaCost: 25 });
battle.updateEnemies(1000, 0);
assert.equal(events[0].data.kind, 'groundSlam');
assert.equal(events[0].delay, 1200);
assert.equal(enemy.mana, 75);
assert.equal(enemy.lastAbilityAt.primary, 0);
assert.equal(enemy.lastAbilityAt.tertiary, 1000);
const saved = { abilities: JSON.parse(JSON.stringify(enemy.abilities)), lastAbilityAt: enemy.lastAbilityAt,
  event: JSON.parse(JSON.stringify(events[0].data)) };
assert.deepEqual(unpackBattleValue(JSON.parse(JSON.stringify(packBattleValue(saved)))), saved);
events.shift().callback();
assert.equal(hits.pop().amount, 60);
enemy.distanceTo = () => 221;
assert.equal(battle.tryEnemyAbility(enemy, target, 'tertiary', 10000), false);

// Only authored bosses can use the third slot. When multiple skills are ready, the old
// primary-before-secondary ordering is retained before considering tertiary.
enemy = boss();
enemy.isBoss = false;
battle.updateEnemies(1000, 0);
assert.equal(events.length, 0);
enemy.isBoss = true;
enemy.lastAbilityAt = {};
battle.updateEnemies(1000, 0);
assert.equal(events[0].data.kind, 'groundSlam');
assert.equal(enemy.pendingAction.name, 'Slam');
events.shift().callback();
hits.pop();
battle.updateEnemies(1000, 0);
assert.equal(events[0].data.key, 'secondary');
events.shift().callback();
hits.pop();

// Healing shares the existing most-injured-fraction rule; a ready heal with no injured
// ally is skipped without spending mana or starting its cooldown.
enemy = boss({ effect: 'heal' });
const injured = Object.assign(boss(), { id: 'injured-monster', hp: 10, maxHp: 100,
  isBoss: false, abilities: {} });
battle.getLivingEnemies = () => [enemy, injured];
battle.updateEnemies(1000, 0);
assert.equal(events[0].data.targetId, injured.id);
events.shift().callback();
assert.equal(hits.pop().healing, 45);
injured.hp = injured.maxHp;
assert.equal(battle.tryEnemyAbility(enemy, target, 'tertiary', 10000), false);
assert.equal(enemy.lastAbilityAt.tertiary, 1000);
console.log('Boss tertiary targeting, priority, damage, healing, mana, cooldowns and saved event compatibility passed.');
