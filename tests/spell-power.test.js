// Verify the shared power across progression, all trained kits, actual healing/damage,
// temporary modifiers and the old item format without requiring Phaser rendering.
import assert from 'node:assert/strict';
import { CLASS_DEFINITIONS } from '../data/classes.js';
import { progressionResources } from '../config/characterProgression.js';
import { replacementAbilities, rankedReplacementAbility } from '../data/replacementAbilities.js';
import { REPLACEMENT_ABILITY_ROWS } from '../data/replacementAbilityCatalog.js';
import { rebuildCharacterStats, abilityPower, linkedHealing } from '../game/CharacterStats.js';
import { replacementAmount } from '../combat/ReplacementEffects.js';
import ReplacementAbilitySystem from '../combat/ReplacementAbilitySystem.js';
import { replacementDescription } from '../game/ReplacementAbilityDescriptions.js';
import { unifiedSpellBonuses } from '../game/SpellPower.js';
import { prepareActiveMonster, syncActiveMonster } from '../config/activeCombatBalance.js';
import { packBattleValue, unpackBattleValue } from '../game/BattleSnapshot.js';

const mageClass = 'Mage of the Umbral Veil';
const healerClass = 'Cleric of the Sanguine Song';
for (const name of Object.keys(CLASS_DEFINITIONS)) {
  const base = progressionResources(name, 10);
  const intellect = progressionResources(name, 10, { intellect: 3 });
  const wisdom = progressionResources(name, 10, { wisdom: 3 });
  assert.equal(intellect.spellPower, base.spellPower + 24);
  assert.equal(wisdom.spellPower, intellect.spellPower);
  assert.equal(wisdom.maxMana, intellect.maxMana);
  assert.equal(base.spellDamage, undefined);
  assert.equal(base.spellHealing, undefined);
}
assert.equal(progressionResources(mageClass).spellPower, 500);
assert.equal(progressionResources(healerClass).spellPower, 500);
assert.equal(progressionResources('Dawnwarden').spellPower, 150);
assert.equal(progressionResources(mageClass, 20).spellPower, 956);

// Current classes own the tuning. Rebuilding one class with another multiplier changes
// its healing coefficients without altering offensive, resource or measured coefficients.
const ordinary = replacementAbilities(healerClass);
const stronger = replacementAbilities(healerClass, 0.5);
assert.deepEqual(replacementAbilities('Umbral Mage'), replacementAbilities(mageClass));
assert.deepEqual(replacementAbilities('Sanguine Cleric'), ordinary);
for (const [key, ability] of Object.entries(ordinary)) {
  for (const field of ['primary', 'secondary']) {
    assert.equal(stronger[key][field].potency, ability[field].potency * (ability[field].healing ? 2 : 1));
  }
}
for (const definition of Object.values(CLASS_DEFINITIONS).filter(def => def.healingMultiplier !== 1)) {
  assert.equal(definition.healingMultiplier, 0.25);
}
assert.ok(REPLACEMENT_ABILITY_ROWS.every(row => !JSON.stringify(row).match(/Spell Damage|Spell Healing/)));
let rankCount = 0;
for (const [name, definition] of Object.entries(CLASS_DEFINITIONS)) {
  const hero = rebuildCharacterStats({ className: name, level: 10 });
  for (const ability of Object.values(definition.abilities)) {
    for (let rank = 1; rank <= 10; rank++) {
      const trained = rankedReplacementAbility(ability, rank);
      const description = replacementDescription(hero, trained);
      assert.doesNotMatch(description, /NaN|undefined|Spell Damage|Spell Healing/, `${name}: ${ability.name}`);
      assert.ok(Number.isFinite(replacementAmount(hero, hero, trained.primary)));
      assert.ok(Number.isFinite(replacementAmount(hero, hero, trained.secondary)));
      rankCount++;
    }
  }
}

// Real replacement handlers must still distinguish a direct heal from a spell hit,
// and preserve periodic and damage-linked healing after both use the same power.
const caster = { id: 'caster', className: healerClass, spellPower: 500,
  spellDamage: 9999, spellHealing: 9999, attackPower: 100, maxMana: 500, mana: 200,
  alive: true, hp: 100, maxHp: 2000, arenaX: 0, arenaY: 0, status: {} };
const ally = { ...caster, id: 'ally', status: {} };
const enemy = { ...caster, id: 'enemy', isEnemy: true, hp: 5000, maxHp: 5000, status: {} };
const scene = { time: { now: 0 }, partyUnits: [caster, ally], enemies: [enemy],
  getLivingEnemies: () => [enemy], createAbilityEffect() {},
  resolveHeal(owner, recipient, amount) { recipient.hp += amount; },
  resolveDamage(owner, recipient, amount, type, scale, name, react, contact) {
    recipient.hp -= amount;
    contact.hit = true;
    return amount;
  } };
caster.scene = scene;
const runtime = new ReplacementAbilitySystem({ scene });
const skill = (className, name) => Object.values(CLASS_DEFINITIONS[className].abilities).find(a => a.name === name);
runtime.resolve(caster, ally, skill(healerClass, 'Blood Mend'), 0);
assert.equal(ally.hp, 250);
assert.equal(enemy.hp, 5000);
runtime.resolve(caster, enemy, skill('Cleric of the Verdant Covenant', 'Wrath'), 0);
assert.equal(enemy.hp, 4600);
runtime.resolve(caster, ally, skill('Cleric of the Verdant Covenant', 'Regrowth'), 0);
assert.equal(ally.hp, 331.25);
const periodic = ally.status.replacementPeriodic[0];
assert.equal(periodic.amount * periodic.remaining, 68.75);
runtime.resolve(caster, enemy, skill(mageClass, 'Siphon'), 0);
assert.equal(caster.hp, 220);
assert.equal(enemy.hp, 4200);
assert.equal(abilityPower({ ...caster, statProgressionVersion: 2 }, {}, 8, true), 40);
assert.equal(linkedHealing({ ...caster, statProgressionVersion: 2 }, {}, 100, 0.3), 30);

// A shared Spell Power modifier also strengthens spell healing and basic Mend once.
// Legacy saved bases deliberately keep their original behavior.
caster.status.replacementEffects = [{ until: 1000, changes: { spell: 0.2 } }];
assert.equal(replacementAmount(caster, ally, skill(healerClass, 'Blood Mend').primary), 180);
assert.equal(abilityPower({ ...caster, statProgressionVersion: 2 }, {}, 8, true), 48);
assert.equal(replacementAmount({ spellDamage: 80, spellHealing: 30 }, ally,
  { basis: 'Caster Spell Healing', potency: 2 }), 60);
assert.equal(abilityPower({ spellDamage: 80, spellHealing: 30, statProgressionVersion: 2 }, {}, 200, true), 60);
assert.equal(abilityPower({ spellPower: 0, spellDamage: 80, statProgressionVersion: 2 }, {}, 200), 0);

// Reading transitional gear neither rewrites it nor doubles the former two bonuses.
const legacyGear = { intellect: 2, spellDamage: 20, spellHealing: 20 };
assert.deepEqual(unifiedSpellBonuses(legacyGear), { intellect: 2, spellPower: 20 });
assert.deepEqual(legacyGear, { intellect: 2, spellDamage: 20, spellHealing: 20 });
assert.deepEqual(unifiedSpellBonuses({ spellPower: 20, spellHealing: 5 }), { spellPower: 25 });
assert.deepEqual(unifiedSpellBonuses({ spellHealing: 30 }), { spellPower: 30 });

// New monster baselines survive save/reload and repeated active/idle transitions.
let monster = { spellPower: 80, attackPower: 40, maxHp: 1000, hp: 400 };
prepareActiveMonster(monster, {}, { id: 'slime-cave' });
assert.equal(monster.spellPower, 140);
monster = unpackBattleValue(packBattleValue(monster));
for (let i = 0; i < 10; i++) {
  syncActiveMonster(monster, false);
  assert.equal(monster.spellPower, 80);
  syncActiveMonster(monster, true);
  assert.equal(monster.spellPower, 140);
}
console.log(`Shared Spell Power, class healing tuning, ${rankCount} trained definitions, live handlers, legacy values and save round trips passed.`);
