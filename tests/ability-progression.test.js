// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import { CLASS_DEFINITIONS } from '../data/classes.js';
import { NEW_CLASS_ABILITIES } from '../data/abilityProgression.js';
import adventurers from '../data/adventurers.js';
import { abilityGoldCost, abilityLearningAvailable, abilityLevelRequired, battleAbilities, purchaseAdventurerAbility, restoreAdventurerAbilities, sortedAbilityEntries } from '../game/AdventurerAbilities.js';
import { grantAdventurerXp, xpRequired } from '../game/AdventurerProgression.js';
import ClassAbilitySystem from '../combat/ClassAbilitySystem.js';

const expected = {
  Tank: { Protect: 2, Assault: 2, Restore: 1, Prepare: 1 },
  'Melee DPS': { Assault: 2, Protect: 1, Restore: 1, Prepare: 2 },
  'Ranged DPS': { Assault: 2, Protect: 1, Restore: 1, Prepare: 2 },
  Healer: { Restore: 2, Protect: 2, Prepare: 2 }
};

// Object.entries turns own fields into [key, value] pairs so we can visit or transform
// them.
for (const [name, definition] of Object.entries(CLASS_DEFINITIONS)) {

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  const added = Object.values(definition.abilities).filter(ability => ability.origin === 'New');
  assert.equal(added.length, 6, name);
  assert.equal(Object.values(definition.abilities).filter(ability => ability.starter).length, 3, name);

  // Object.fromEntries turns [key, value] pairs back into an object. A later pair with the
  // same key replaces the earlier value. map builds one output entry for each input entry,
  // in the same order. The callback's return value becomes that output entry.
  assert.deepEqual(Object.fromEntries(Object.keys(expected[definition.role]).map(category =>
    [category, added.filter(ability => ability.category === category).length])), expected[definition.role], name);

  // every requires all entries to pass the check; an empty list gives true.
  assert.ok(Object.values(definition.abilities).every(ability => ['Assault','Protect','Restore','Prepare'].includes(ability.category)), name);
  assert.ok(added.filter(ability => ability.target === 'self' && ability.effect === 'heal').length === 1 || definition.role === 'Healer', name);
  assert.ok(added.every(ability => ability.effect !== 'damage' || ability.target !== 'self'), name);
  assert.ok(Object.values(definition.abilities).every(ability => ability.description && ability.description !== ability.name), name);
  assert.equal(NEW_CLASS_ABILITIES[name].length, 6);
}

// reduce carries an accumulated result from one entry to the next. The callback returns
// the accumulator for the next step; the final argument supplies its starting value.
assert.equal(Object.values(CLASS_DEFINITIONS).reduce((count, def) => count + Object.keys(def.abilities).length, 0), 133);

// ... copies the source's own fields into this object; fields listed later replace earlier
// ones. This is a shallow copy, so nested objects are still shared. find returns the first
// matching entry, or undefined when none matches. Check for that missing result before
// using its fields.
const fresh = restoreAdventurerAbilities({ ...adventurers.find(hero => hero.className === 'Gladiator') }, null);
assert.deepEqual(fresh.abilityLoadout, ['roar','cleave','secondWind']);
assert.equal(fresh.skillPoints, 1);
assert.deepEqual(sortedAbilityEntries(fresh).slice(0, 3).map(([key]) => key), ['roar','cleave','secondWind']);
assert.equal(abilityLearningAvailable(fresh, 'net'), true);
assert.equal(abilityLearningAvailable(fresh, 'roar'), false);
const sortedFixture = { ...fresh, abilityRanks: { ...fresh.abilityRanks, net: 1 }, abilityLoadout: ['roar','secondWind'] };

const unlockedOrder = sortedAbilityEntries(sortedFixture).map(([key]) => key);
assert.deepEqual(unlockedOrder.slice(0, 4), ['roar','net','cleave','secondWind']);
assert.deepEqual(sortedAbilityEntries({ ...sortedFixture, abilityLoadout: ['net','cleave'] }).map(([key]) => key), unlockedOrder);
for (let rank = 1; rank <= 10; rank++) assert.equal(abilityLevelRequired(fresh, 'roar', rank), rank === 1 ? 1 : (rank - 1) * 5);
assert.equal(abilityGoldCost({ ...fresh, level: 5, happiness: 70 }, 'net', 2), 120);
assert.ok(abilityGoldCost({ ...fresh, happiness: 10 }, 'net', 1) > abilityGoldCost({ ...fresh, happiness: 90 }, 'net', 1));

const state = { roster: [fresh], gold: 10000 };
assert.equal(purchaseAdventurerAbility(fresh.id, 'net', state).ok, true);
assert.equal(fresh.skillPoints, 0);
assert.equal(purchaseAdventurerAbility(fresh.id, 'net', state).ok, false);
fresh.level = 5;
fresh.skillPoints = 2;
assert.equal(purchaseAdventurerAbility(fresh.id, 'net', state).ok, true);

assert.equal(fresh.skillPoints, 0);
assert.equal(battleAbilities(fresh).net.power, 9);
assert.equal(battleAbilities(fresh).net.cooldown, 15000);
fresh.abilityRanks.net = 10;
assert.equal(battleAbilities(fresh).net.power, 17);

const leveling = { ...fresh, level: 1, xp: 0, skillPoints: 1 };
grantAdventurerXp(leveling, xpRequired(1) + xpRequired(2));
assert.equal(leveling.level, 3);
assert.equal(leveling.skillPoints, 3);

const gladiator = {
  ...fresh, statProgressionVersion: undefined, id: 'guard', role: 'Tank', hp: 50, maxHp: 100, alive: true,
  arenaX: 50, arenaY: 50, status: {}, abilities: CLASS_DEFINITIONS.Gladiator.abilities
};
const ally = { id: 'ally', role: 'Healer', hp: 20, maxHp: 100, alive: true, arenaX: 150, arenaY: 50, status: {} };
const enemy = { id: 'enemy', isEnemy: true, alive: true, hp: 100, maxHp: 100, arenaX: 250, arenaY: 50, status: {} };
const battlefield = { columns: 10, rows: 6, logicalWidth: 1000, logicalHeight: 600,

  // We handle arena point to cell here, keeping this operation in one place for its
  // callers.
  arenaPointToCell: (x,y) => ({ column: Math.floor(x/100), row: Math.floor(y/100) }) };

const scene = { partyUnits: [gladiator, ally], battlefield, enemies: [enemy], time: { now: 0 }, currentWaveIndex: 0,

  // Return the enemies still able to participate in the current battle.
  getLivingEnemies: () => [enemy], resolveHeal: (_, target, value) => { target.hp = Math.min(target.maxHp, target.hp + value); },

  // Apply shared hit, critical and defense rules, then record the actual damage and
  // threat.
  resolveDamage: (_, target, value) => {
    target.hp -= value;
    return value;
  }, addThreat() {} };

const system = new ClassAbilitySystem(scene);
system.resolve(gladiator, ally, gladiator.abilities.arenaGuard, 0);
assert.equal(ally.status.interceptSource, gladiator);
assert.equal(gladiator.status.damageReduction, 0.25);
system.resolve(gladiator, gladiator, gladiator.abilities.secondWind, 0);
assert.equal(gladiator.hp, 74);
system.resolve(gladiator, gladiator, gladiator.abilities.crowdFavorite, 0);

assert.equal(gladiator.status.damageReduction, 0.15);
assert.equal(gladiator.status.nextThreatBonus, 1.5);

console.log('Ability catalog, starters, ten ranks, point and gold rules, and new combat effects passed.');
