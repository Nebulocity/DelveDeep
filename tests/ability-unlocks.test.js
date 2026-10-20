import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { CLASS_DEFINITIONS } from '../data/classes.js';
import { ABILITY_UNLOCK_LEVELS, abilityMeetsLevel } from '../data/abilityUnlocks.js';
import { abilityEntries, abilityLevelRequired, abilityLearningAvailable, restoreAdventurerAbilities,
  purchaseAdventurerAbility, toggleAdventurerAbility, battleAbilities, rankedAbility } from '../game/AdventurerAbilities.js';
import { grantAdventurerLevels, grantAdventurerXp, xpRequired } from '../game/AdventurerProgression.js';
import { pendingAbilityUnlocks, acknowledgeAbilityUnlocks } from '../game/AbilityUnlockNotifications.js';
import ReplacementAbilitySystem from '../combat/ReplacementAbilitySystem.js';
import GameState from '../game/GameState.js';
import { loadProfile, flushProfileSave } from '../game/GameStorage.js';
import adventurers from '../data/adventurers.js';

// Use real battle methods without constructing Phaser artwork.
const context = vm.createContext({ abilityMeetsLevel });
vm.runInContext(fs.readFileSync(new URL('../combat/BattleUnit.js', import.meta.url), 'utf8')
  .replace(/^import [\s\S]*?;\r?\n/gm, '')
  .replace('export default class BattleUnit', 'globalThis.Unit = class BattleUnit'), context);
const Unit = context.Unit;
const system = new ReplacementAbilitySystem({ scene: {} });
let checked = 0;
for (const [className, definition] of Object.entries(CLASS_DEFINITIONS)) {
  const fresh = restoreAdventurerAbilities({ id: className, className, level: 1 }, {});
  const starting = Object.values(battleAbilities(fresh));
  assert.ok(starting.length >= 3 && starting.length <= 4, className);
  assert.ok(starting.some(a => ['Assault', 'Restore'].includes(a.category)), className);
  if (definition.role === 'Tank') assert.ok(starting.some(a => /taunt/i.test(a.handler)), className);
  if (definition.role === 'Healer') assert.ok(starting.some(a => /heal/i.test(a.handler)), className);
  for (const [key, ability] of abilityEntries(fresh)) {
    if (ability.starter || ability.innate) {
      assert.equal(ability.minimumLevel, 1, ability.name);
      assert.ok(fresh.abilityRanks[key] > 0);
      continue;
    }
    assert.ok(ABILITY_UNLOCK_LEVELS[key], key);
    const level = ability.minimumLevel;
    assert.ok(level > 1 && level <= 20);
    const hero = { ...fresh, level: level - 1, skillPoints: 100, abilityRanks: {}, abilityLoadout: [] };
    const state = { roster: [hero], gold: 100000 };
    const before = JSON.stringify(state);
    assert.equal(abilityLearningAvailable(hero, key), false);
    assert.equal(purchaseAdventurerAbility(hero.id, key, state).ok, false);
    assert.equal(JSON.stringify(state), before, 'Locked learning must spend nothing');

    // A supplied learned/equipped record cannot bypass either combat or equipment gates.
    hero.abilityRanks[key] = 1;
    hero.abilityLoadout = [key];
    assert.equal(toggleAdventurerAbility(hero.id, key, state).ok, false);
    assert.equal(battleAbilities(hero)[key], undefined);
    const rankBefore = hero.abilityRanks[key];
    assert.equal(purchaseAdventurerAbility(hero.id, key, state).ok, false);
    assert.equal(hero.abilityRanks[key], rankBefore);

    const unit = Object.assign(Object.create(Unit.prototype), {
      level: level - 1, className, abilities: { [key]: rankedAbility(ability) },
      knownAbilityRanks: { [key]: 1 }, mana: 1000, scene: {}, status: {}, lastAbilityAt: {},
      canStartAction: () => true, canCast: () => true
    });
    assert.equal(unit.abilityReady(key, 10000), false, 'AI readiness must reject locked skills');
    assert.equal(unit.markAbilityUsed(key, 10000), false);
    assert.deepEqual(unit.lastAbilityAt, {});
    assert.equal(unit.mana, 1000);
    assert.equal(system.usable(unit, ability, 10000), false);
    assert.equal(system.trainedSkill(unit, ability.name), null, 'Reactions must respect the level gate');
    unit.level = level;
    assert.equal(unit.abilityReady(key, 10000), true, 'Unlock level must permit normal readiness');
    assert.ok(system.trainedSkill(unit, ability.name));

    hero.level = level;
    hero.abilityRanks = {};
    hero.abilityLoadout = [];
    assert.equal(abilityLearningAvailable(hero, key), true);
    assert.equal(battleAbilities(hero)[key], undefined, 'Unlocking alone must not equip a skill');
    assert.equal(purchaseAdventurerAbility(hero.id, key, state).ok, true);
    assert.equal(hero.abilityRanks[key], 1);
    assert.ok(battleAbilities(hero)[key]);
    assert.equal(abilityLevelRequired(hero, key, 3), Math.max(level, 10));
    checked++;
  }
}

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
loadProfile(adventurers);
const hero = GameState.roster.find(hero => hero.className === 'Gladiator');
const healer = GameState.roster.find(hero => hero.className === 'Grovekeeper');
const learned = JSON.stringify(hero.abilityRanks);
grantAdventurerLevels(hero, 11);
grantAdventurerLevels(healer, 4);
assert.equal(JSON.stringify(hero.abilityRanks), learned, 'Level gains must not grant or train optional skills');
assert.equal(pendingAbilityUnlocks([hero, healer]).length, 2);
const expected = abilityEntries(hero).filter(([key, a]) => a.minimumLevel > 1
  && a.minimumLevel <= 12 && !hero.abilityRanks[key]).map(([key]) => key).sort();
assert.deepEqual([...hero.pendingAbilityUnlocks].sort(), expected, 'Every crossed milestone must be queued');
const pending = [...hero.pendingAbilityUnlocks];
grantAdventurerLevels(hero, 0);
assert.deepEqual(hero.pendingAbilityUnlocks, pending);
assert.equal(flushProfileSave(), true);
loadProfile(adventurers);
const restored = GameState.roster.find(h => h.id === hero.id);
assert.deepEqual(restored.pendingAbilityUnlocks, pending);
acknowledgeAbilityUnlocks(pendingAbilityUnlocks(GameState.roster));
assert.equal(pendingAbilityUnlocks(GameState.roster).length, 0);
flushProfileSave();
loadProfile(adventurers);
assert.equal(pendingAbilityUnlocks(GameState.roster).length, 0, 'Delivered notices must stay acknowledged after reload');
const ranger = GameState.roster.find(h => h.className === 'Ranger');
grantAdventurerXp(ranger, xpRequired(1) + xpRequired(2));
assert.equal(ranger.level, 3);
assert.ok(ranger.pendingAbilityUnlocks.length, 'Normal XP must queue unlocks');
console.log(`Skill unlock boundaries, learning, training and AI gates passed for ${checked} class/skill combinations; notifications and save round-trip passed.`);
