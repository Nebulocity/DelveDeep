import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { CLASS_DEFINITIONS } from '../data/classes.js';
import { REPLACEMENT_ABILITY_ROWS } from '../data/replacementAbilityCatalog.js';
import { ABILITY_UNLOCK_LEVELS, abilityMeetsLevel, abilityEnabled, DISABLED_ABILITY_IDS } from '../data/abilityUnlocks.js';
import { abilityEntries, abilityLevelRequired, abilityLearningAvailable, restoreAdventurerAbilities,
  purchaseAdventurerAbility, toggleAdventurerAbility, battleAbilities, rankedAbility, sortedAbilityEntries,
  abilitySkillPointCost, abilityGoldCost } from '../game/AdventurerAbilities.js';
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
  assert.ok(starting.length >= 1 && starting.length <= 4, className);
  const initialKeys = abilityEntries(fresh).filter(([, a]) => abilityMeetsLevel(fresh, a)).map(([key]) => key).sort();
  assert.deepEqual(Object.keys(fresh.abilityRanks).sort(), initialKeys, 'All eligible level-1 skills are learned free');
  if (definition.role === 'Tank') assert.ok(starting.some(a => /taunt/i.test(a.handler)), className);
  if (definition.role === 'Healer') assert.ok(starting.some(a => /heal/i.test(a.handler)), className);
  for (const [key, ability] of abilityEntries(fresh)) {
    if (ability.minimumLevel === 1) {
      assert.equal(ability.minimumLevel, 1, ability.name);
      assert.ok(fresh.abilityRanks[key] > 0);
      continue;
    }
    assert.ok(ABILITY_UNLOCK_LEVELS[key], key);
    const level = ability.minimumLevel;
    if (!abilityEnabled(ability)) continue;
    assert.ok(level > 1 && level <= 35, key);
    const hero = { ...fresh, level: level - 1, skillPoints: 100, abilityRanks: {}, abilityLoadout: [] };
    const state = { roster: [hero], gold: 100000 };
    const before = JSON.stringify(state);
    assert.equal(abilityLearningAvailable(hero, key), false);
    assert.equal(sortedAbilityEntries(hero).some(([id]) => id === key), false, 'Locked skills stay hidden');
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

    const loadoutBefore = [...hero.abilityLoadout];
    hero.abilityRanks = {};
    const pointsBefore = hero.skillPoints;
    const goldBefore = state.gold;
    const gained = grantAdventurerLevels(hero, 1);
    assert.ok(gained.abilitiesLearned.includes(key));
    assert.equal(hero.abilityRanks[key], 1, 'Crossing the gate learns rank 1 automatically');
    assert.equal(hero.skillPoints, pointsBefore + 1, 'Only the ordinary level-up SP is added');
    assert.equal(state.gold, goldBefore, 'Automatic learning is free');
    assert.deepEqual(hero.abilityLoadout, loadoutBefore, 'New learning preserves battle slots');
    hero.abilityLoadout = [];
    assert.equal(battleAbilities(hero)[key], undefined, 'Unlocking alone must not equip a skill');
    assert.equal(sortedAbilityEntries(hero).some(([id]) => id === key), true);
    assert.equal(toggleAdventurerAbility(hero.id, key, state).ok, true);
    assert.ok(battleAbilities(hero)[key]);
    hero.level = Math.max(level, 5);
    const trainingGold = abilityGoldCost(hero, key, 2);
    assert.equal(purchaseAdventurerAbility(hero.id, key, state).ok, true);
    assert.equal(hero.abilityRanks[key], 2);
    assert.equal(hero.skillPoints, pointsBefore + 1 - abilitySkillPointCost(2));
    assert.equal(state.gold, goldBefore - trainingGold);
    assert.equal(abilityLevelRequired(hero, key, 3), Math.max(level, 10));
    checked++;
  }
}

// Disabled entries remain inaccessible even above their authored level-99 marker.
for (const id of DISABLED_ABILITY_IDS) {
  const ability = REPLACEMENT_ABILITY_ROWS.find(row => row.id === id);
  assert.ok(ability, 'Disabled art and authored definitions remain available');
  const className = ability.className;
  const hero = restoreAdventurerAbilities({ id: className, className, level: 100 }, {});
  const state = { roster: [hero], gold: 100000 };
  assert.equal(hero.abilityRanks[id], undefined);
  assert.equal(sortedAbilityEntries(hero).some(([key]) => key === id), false);
  hero.abilityRanks[id] = 1;
  hero.abilityLoadout = [id];
  const before = JSON.stringify(state);
  assert.equal(purchaseAdventurerAbility(hero.id, id, state).ok, false);
  assert.equal(toggleAdventurerAbility(hero.id, id, state).ok, false);
  assert.equal(battleAbilities(hero)[id], undefined);
  assert.equal(system.usable({ level: 100, isEnemy: true }, ability, 10000), false);
  assert.equal(JSON.stringify(state), before);
}

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
loadProfile(adventurers);
const hero = GameState.roster.find(hero => hero.className === 'Gladiator');
const healer = GameState.roster.find(hero => hero.className === 'Dawnpriest');
const learned = { ...hero.abilityRanks };
const slots = [...hero.abilityLoadout];
grantAdventurerLevels(hero, 11);
grantAdventurerLevels(healer, 4);
for (const [key, rank] of Object.entries(learned)) assert.equal(hero.abilityRanks[key], rank, 'Existing ranks stay unchanged');
assert.deepEqual(hero.abilityLoadout, slots);
assert.equal(pendingAbilityUnlocks([hero, healer]).length, 2);
const expected = abilityEntries(hero).filter(([key, a]) => a.minimumLevel > 1
  && a.minimumLevel <= 12 && abilityEnabled(a) && !learned[key]).map(([key]) => key).sort();
for (const key of expected) assert.equal(hero.abilityRanks[key], 1);
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
