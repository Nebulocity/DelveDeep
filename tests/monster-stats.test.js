// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import enemies from '../data/enemies.js';
import { MONSTER_STAT_DEFAULTS, monsterStats, monsterAbilities } from '../game/MonsterStats.js';
import { abilityPower, hitAccuracy } from '../game/CharacterStats.js';
import { armorReduction, cappedChance } from '../config/characterProgression.js';

for (const enemy of Object.values(enemies)) {
  for (const stat of Object.keys(MONSTER_STAT_DEFAULTS)) assert.ok(Number.isFinite(enemy[stat]), `${enemy.name}: ${stat}`);
  assert.equal(enemy.statProgressionVersion, 2);
  assert.equal(hitAccuracy(enemy), 1);
}
const legacySlime = monsterStats({ attackPower: 11, abilities: { primary: { power: 20 } } });
legacySlime.abilities = monsterAbilities(legacySlime);

assert.equal(abilityPower(legacySlime, legacySlime.abilities.primary), 20);

// ... copies the source's own fields into this object; fields listed later replace earlier
// ones. This is a shallow copy, so nested objects are still shared.
assert.equal(abilityPower({ ...legacySlime, attackPower: 22 }, legacySlime.abilities.primary), 40);
assert.equal(abilityPower(enemies.denColossus, enemies.denColossus.abilities.primary), 76 * 27 / 17,
  'Authored potency scales with the revised Colossus Attack Power');
const caster = monsterStats({ attackPower: 10, spellDamage: 80, spellHealing: 60, maxMana: 100,
  abilities: { secondary: { power: 25, powerUnit: 'percent', damageType: 'spell' } } });
caster.abilities = monsterAbilities(caster);
assert.equal(abilityPower(caster, caster.abilities.secondary), 20);

assert.equal(abilityPower(caster, { power: 50 }, 50, true), 30);
const capped = monsterStats({ dodge: 1, block: 1, critChance: 1, hitChance: 1 });
assert.equal(capped.dodge, 0.3);
assert.equal(capped.block, 0.35);
assert.equal(capped.critChance, 0.4);
assert.equal(capped.hitChance, 0.2);

// We handle load class here, keeping this operation in one place for its callers.
function loadClass(path, name, globals) {
  const context = vm.createContext(globals);
  vm.runInContext(fs.readFileSync(new URL(path, import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(`export default class ${name}`, `globalThis.Subject = class ${name}`), context);

  return context.Subject;
}
const Unit = loadClass('../combat/BattleUnit.js', 'BattleUnit', { armorReduction });

// Object.assign writes these fields into its first argument. Later sources replace earlier
// fields; nested values are not deep-copied.
const defender = Object.assign(Object.create(Unit.prototype), {
  ...monsterStats({ armor: 100 }), isEnemy: true, alive: true, hp: 500, maxHp: 500,
  damageTakenMultiplier: 1, status: {}, container: { x: 0, y: 0 }, updateHealthBar() {}
});
defender.takeDamage(100, { time: 0, physical: true });
assert.equal(defender.hp, 420);
defender.hp = 500;

defender.takeDamage(100, { time: 0, physical: true, armorBlocked: true });
assert.equal(defender.hp, 440);
defender.hp = 500;
defender.takeDamage(100, { time: 0, physical: false, armorBlocked: true });
assert.equal(defender.hp, 400);

const random = Object.create(Math);
random.random = () => 0.99;
const Battle = loadClass('../scenes/BattleScene.js', 'BattleScene', { Phaser: { Scene: class {} }, hitAccuracy, abilityPower, cappedChance, Math: random });
const battle = Object.assign(Object.create(Battle.prototype), {
  time: { now: 0 }, isEnemyEngaged: () => true, getLivingEnemies: () => [],

  // We build or display floating text using the current inputs. The objects and values
  // made below are the pieces this part of the screen needs.
  createFloatingText() {}, createProjectile() {}, createMeleePulse() {}, rollCritical: () => false,
  classAbilitySystem: { tryParry: () => false, onDamaged() {} }
});

const attacker = { ...enemies.caveSlime, isEnemy: true, status: {} };
const victim = Object.assign(Object.create(Unit.prototype), {
  ...defender, isEnemy: false, name: 'Hero', hp: 500, status: {}, flash() {},
  statProgressionVersion: 2, dodge: 0, block: 0, alive: true
});
battle.resolveDamage(attacker, victim, 100, 'enemy');
assert.equal(victim.hp, 420, 'Enemy basic hits are physical and use armor');

victim.hp = 500;
battle.resolveDamage(attacker, victim, 100, 'spell');
assert.equal(victim.hp, 400, 'Monster spells bypass armor');
victim.hp = 500;
victim.isEnemy = true;
attacker.isEnemy = false;
attacker.role = 'Tank';

victim.dodge = 0.3;
random.random = () => 0.1;
battle.resolveDamage(attacker, victim, 100, 'melee');
assert.equal(victim.hp, 500, 'Monsters can dodge incoming attacks');
victim.dodge = 0;
victim.block = 0.35;
battle.resolveDamage(attacker, victim, 100, 'melee');

assert.equal(victim.hp, 440, 'Monsters can block physical attacks');

const delayed = [];
battle.time.delayedCall = (delay, callback) => delayed.push(callback);
battle.announceAbility = () => {};
battle.setEnemyTarget = () => {};
battle.logActionStart = () => {};
battle.isActionCurrent = () => true;
const healer = { ...caster, isEnemy: true, status: {}, abilities: {
  secondary: { name: 'Mend', power: 50, effect: 'heal', windup: 100, manaCost: 10 }
}, id: 'enemy-healer', mana: 100, startAction(name, time, duration) {
  this.pendingAction = { id: 1, name, startAt: time, duration };
  return true;
}, markAbilityUsed: Unit.prototype.markAbilityUsed,
spendMana: Unit.prototype.spendMana, lastAbilityAt: {}, finishAction() {} };

battle.resolveHeal = (actor, target, amount) => { battle.healing = amount; };
battle.beginEnemyAbility(healer, victim, 'secondary', 0);
delayed.pop()();
assert.equal(battle.healing, 30);
assert.equal(healer.mana, 90);
console.log('Monster stat parity, starting potency, shared armor/dodge/block, spells and healing/mana passed.');
