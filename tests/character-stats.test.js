// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import { armorReduction } from '../config/characterProgression.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { characterStats, abilityStatBonus, abilityPower, hitAccuracy, rebuildCharacterStats } from '../game/CharacterStats.js';
import { getEquippedAdventurer, restoreEquipment } from '../game/Equipment.js';
import { rankedAbility, battleAbilities } from '../game/AdventurerAbilities.js';

import { CLASS_DEFINITIONS } from '../data/classes.js';
import ClassAbilitySystem from '../combat/ClassAbilitySystem.js';
import { getEquipmentDefinition } from '../data/items.js';

const className = 'Mage of the Umbral Veil';
const base = CLASS_DEFINITIONS[className];

// ... copies the source's own fields into this object; fields listed later replace earlier
// ones. This is a shallow copy, so nested objects are still shared.
const hero = { ...base, id: 'test-mage', className, level: 4, attackPower: base.attackPower + 6, equipment: { weapon: 'blade' } };
const state = { inventory: { equipment: [{ id: 'blade', slot: 'weapon', usableBy: [className], stats: { attackPower: 8 } }] } };
const stats = getEquippedAdventurer(hero, state);
assert.equal(stats.spellDamage, base.attackPower + 6);
assert.equal(stats.attackPower, base.attackPower + 14);
assert.equal(abilityStatBonus(stats, base.abilities.nightbolt), 6);
assert.equal(abilityStatBonus(stats, { damageType: 'physical' }), 14);

assert.equal(abilityStatBonus({ ...stats, spellDamage: stats.spellDamage + 5 }, base.abilities.nightbolt), 11);
assert.equal(characterStats(hero).hitChance, 1);
assert.equal(characterStats(hero).dodge, 0);
assert.equal(characterStats(hero).block, 0);
assert.equal(characterStats(hero).strength, undefined);

const cleric = { ...CLASS_DEFINITIONS['Cleric of the Everbright'], id: 'cleric', className: 'Cleric of the Everbright', equipment: { weapon: 'staff' } };
const geared = getEquippedAdventurer(cleric, { inventory: { equipment: [{ id: 'staff', slot: 'weapon', usableBy: [cleric.className], stats: { healPower: 3 } }] } });
assert.equal(geared.spellHealing, cleric.healPower + 3);
assert.equal(abilityStatBonus(geared, {}, true), 3);
assert.equal(abilityStatBonus({ ...geared, attackPower: 999, spellDamage: 999 }, {}, true), 3);

hero.abilityRanks = { nightbolt: 3 };
hero.abilityLoadout = ['nightbolt'];
assert.deepEqual(rankedAbility(base.abilities.nightbolt, 3), battleAbilities(hero).nightbolt);
const target = { alive: true, hp: 100, maxHp: 100, status: {} };
const unit = { ...stats, hp: 80, maxHp: 80, status: {}, alive: true };
const scene = {
  partyUnits: [unit], getLivingEnemies: () => [target], isEnemyEngaged: () => true,

  // Apply shared hit, critical and defense rules, then record the actual damage and
  // threat.
  resolveDamage(actor, victim, power) {
    this.damage = power;
    return power;
  }
};

const system = new ClassAbilitySystem(scene);
system.resolve(unit, target, base.abilities.nightbolt, 0);
assert.equal(scene.damage, base.abilities.nightbolt.power + 6);
unit.attackPower += 100;
system.resolve(unit, target, base.abilities.nightbolt, 0);
assert.equal(scene.damage, base.abilities.nightbolt.power + 6);
unit.spellDamage += 5;

system.resolve(unit, target, base.abilities.nightbolt, 0);
assert.equal(scene.damage, base.abilities.nightbolt.power + 11);
console.log('Character defaults, separate attack/spell/healing bonuses, rank previews and spell resolution passed.');

const context = vm.createContext({ Phaser: { Scene: class {} }, hitAccuracy });
vm.runInContext(fs.readFileSync(new URL('../scenes/BattleScene.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default class BattleScene', 'globalThis.Battle = class BattleScene'), context);

// Object.assign writes these fields into its first argument. Later sources replace earlier
// fields; nested values are not deep-copied.
const battle = Object.assign(Object.create(context.Battle.prototype), {
  time: { now: 0 }, isEnemyEngaged: () => true, getLivingEnemies: () => [],

  // We build or display floating text using the current inputs. The objects and values
  // made below are the pieces this part of the screen needs.
  createFloatingText() {}, createProjectile() {}
});

const actor = { name: 'Caster', role: 'Tank', status: {}, hitChance: 0, critChance: 1, critMultiplier: 2 };
const victim = { name: 'Target', alive: true, isEnemy: true, hp: 0, maxHp: 100, status: {}, flash() {}, heal(amount) { this.hp += amount; } };
for (const type of ['melee', 'spell', 'holy']) {
  battle.resolveDamage(actor, victim, 10, type);
  assert.equal(victim.hp, 0, 'Zero Hit Chance must miss across damaging ability types');
}
battle.rollCritical = () => true;

battle.resolveHeal(actor, victim, 10, 'Heal');
assert.equal(victim.hp, 20, 'Healing must skip Hit Chance and use the shared critical multiplier');
console.log('Shared damage accuracy and healing critical multiplier passed.');

const focusState = { roster: [], inventory: {} };

// A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
// object; get/set read and write that same key.
restoreEquipment({ equipmentSchemaVersion: 1, equipment: [{ id: 'saved-focus', itemId: 'apprentice-focus', name: 'Apprentice Focus', slot: 'weapon', usableBy: [className], stats: { attackPower: 3 } }] }, new Map(), focusState);
assert.equal(focusState.inventory.equipment[0].itemId, 'PST01');
assert.equal(focusState.inventory.equipment[0].name, getEquipmentDefinition('PST01').name);
assert.deepEqual(focusState.inventory.equipment[0].stats, getEquipmentDefinition('PST01').stats);
restoreEquipment(focusState.inventory, new Map(), focusState);
assert.deepEqual(focusState.inventory.equipment[0].stats, getEquipmentDefinition('PST01').stats);
console.log('Saved focus uses the replacement catalog definition, and repeat restoration is idempotent.');

const modern = rebuildCharacterStats({ className, level: 1, statProgressionVersion: 2 });
assert.equal(abilityPower(modern, base.abilities.nightbolt, 20), 100);
assert.equal(abilityPower(modern, { damageType: 'physical' }, 20), 10);
assert.equal(abilityPower(modern, {}, 20, true), 70);
assert.equal(hitAccuracy(modern), 0.9);
assert.equal(hitAccuracy({ ...modern, hitChance: 0.2 }), 1.1);
const later = rebuildCharacterStats({ ...modern, level: 20 });

assert.equal(later.spellDamage, 804);
assert.equal(later.spellHealing, 502);
console.log('Percentage ability potency and accuracy ratings above 100% passed.');

const armorContext = vm.createContext({ Phaser: {}, armorReduction });
vm.runInContext(fs.readFileSync(new URL('../combat/BattleUnit.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default class BattleUnit', 'globalThis.Unit = class BattleUnit'), armorContext);
const defender = Object.assign(Object.create(armorContext.Unit.prototype), {
  statProgressionVersion: 2, alive: true, hp: 500, maxHp: 500, armor: 100, damageTakenMultiplier: 1, status: {}, updateHealthBar() {}
});
defender.takeDamage(100, { time: 0, physical: true }); assert.equal(defender.hp, 420);

defender.hp = 500; defender.takeDamage(100, { time: 0, physical: true, armorBlocked: true }); assert.equal(defender.hp, 440);
defender.hp = 500; defender.takeDamage(100, { time: 0, physical: false, armorBlocked: true }); assert.equal(defender.hp, 400);
defender.hp = 500; defender.armor = 400; defender.takeDamage(100, { time: 0, physical: true, armorBlocked: true }); assert.equal(defender.hp, 500);
console.log('Physical Block doubles total armor mitigation and spells bypass armor.');
