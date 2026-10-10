// Exercise the complete XP curve, clipped gains and material-only farming at a cap.
import assert from 'node:assert/strict';
import { ADVENTURER_XP_COSTS, ADVENTURER_XP_BANDS, FARM_HOURS_BY_DIFFICULTY } from '../config/adventurerXp.js';
import { xpRequired, grantAdventurerXp, grantAdventurerLevels } from '../game/AdventurerProgression.js';
import GameState from '../game/GameState.js';
import { getDelveById } from '../data/delves.js';
import { awardOrdinaryWave, delveRewardEligibility, cappedDelveGold } from '../game/DelveCheckpoints.js';
import { completeExpedition } from '../game/ExpeditionProgression.js';
import { loadProfile, saveProfile } from '../game/GameStorage.js';

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
assert.equal(ADVENTURER_XP_COSTS.length, 49);
assert.deepEqual(Object.values(FARM_HOURS_BY_DIFFICULTY), [4, 8, 16, 32, 64, 128]);
for (const band of ADVENTURER_XP_BANDS) {
  const budget = ADVENTURER_XP_COSTS.slice(band.start - 1, band.cap - 1).reduce((sum, xp) => sum + xp, 0);
  assert.equal(budget, Math.round(FARM_HOURS_BY_DIFFICULTY[band.difficulty] * 3600 / band.cycleSeconds));
}
assert.equal(ADVENTURER_XP_COSTS.slice(0, 4).reduce((sum, xp) => sum + xp, 0), 600);
for (let level = 1; level < 50; level++) {
  assert.ok(Number.isSafeInteger(xpRequired(level)) && xpRequired(level) > 0);
}
assert.equal(xpRequired(50), 2550);
const hero = () => ({ id: 'hero', name: 'Hero', level: 1, xp: 0, happiness: 70, maxHp: 100, attackPower: 10 });
const capped = hero();
assert.deepEqual(grantAdventurerXp(capped, 100000, 5), { levelsGained: 4, xpGained: 600 });
assert.equal(capped.level, 5);
assert.equal(capped.xp, 0);
assert.equal(grantAdventurerXp(capped, 999, 5).xpGained, 0);
assert.equal(capped.xp, 0);

// An older overleveled hero keeps both saved level and banked XP without earning more.
const older = { ...hero(), level: 30, xp: 17 };
assert.equal(grantAdventurerXp(older, 1, 5).xpGained, 0);
assert.equal(older.level, 30);
assert.equal(older.xp, 17);
const plannedEnd = hero();
const totalPlan = ADVENTURER_XP_COSTS.reduce((sum, xp) => sum + xp, 0);
grantAdventurerXp(plannedEnd, totalPlan);
assert.equal(plannedEnd.level, 50);
assert.equal(plannedEnd.xp, 0);

// Planning through 50 does not invalidate older level-54/55 rank-10 training paths.
assert.equal(grantAdventurerLevels(plannedEnd, 5).levelsGained, 5);
assert.equal(plannedEnd.level, 55);

const delve = getDelveById('murmuring-abyss');
GameState.currentDelve = delve;
GameState.roster = [0, 1, 2, 3, 4].map(index => ({ ...hero(), id: `hero-${index}`, level: index < 3 ? 30 : 29 }));
GameState.activeParty = structuredClone(GameState.roster);
GameState.delveCheckpoints = { [delve.id]: { nextWave: 33, campUnlocked: true } };
GameState.world.clearedDelves = [];
const units = GameState.roster.map(hero => ({ id: hero.id, alive: true }));
assert.equal(cappedDelveGold(5, delveRewardEligibility(delve)), 2);
const mixed = awardOrdinaryWave(delve, 32, 33, true, units);
assert.equal(mixed.gold, 2);
assert.deepEqual(mixed.xpByHero, { 'hero-0': 0, 'hero-1': 0, 'hero-2': 0, 'hero-3': 1, 'hero-4': 1 });
assert.equal(GameState.roster[0].happiness, 70);
assert.equal(GameState.roster[3].happiness, 75);

// Force material successes on a cave encounter while every adventurer is capped.
const cave = getDelveById('slime-cave');
GameState.currentDelve = cave;
GameState.roster.forEach(hero => { hero.level = 5; hero.xp = 0; hero.happiness = 70; });
GameState.delveCheckpoints = { [cave.id]: { nextWave: 5, campUnlocked: true } };
const beforeGold = GameState.gold;
const materialsOnly = awardOrdinaryWave(cave, 4, 5, true, units, () => 0);
assert.equal(materialsOnly.gold, 0);
assert.equal(materialsOnly.xp, 0);
assert.equal(materialsOnly.happiness, 0);
assert.equal(Object.values(materialsOnly.materials).reduce((sum, count) => sum + count, 0), 2);
assert.equal(GameState.gold, beforeGold);
assert.ok(GameState.roster.every(hero => hero.xp === 0 && hero.happiness === 70));
GameState.rewards = [];
const boss = completeExpedition();
assert.ok(boss.adventurers.every(hero => hero.xpGained === 0));
assert.ok(GameState.roster.every(hero => hero.happiness === 70));

// Reloaded profiles still use the cap and keep previously banked XP and material counts.
const baseRoster = structuredClone(GameState.roster);
saveProfile();
loadProfile(baseRoster);
const afterReload = awardOrdinaryWave(cave, 4, 5, true, units, () => 0);
assert.equal(afterReload.gold, 0);
assert.equal(afterReload.xp, 0);
assert.equal(Object.values(afterReload.materials).reduce((sum, count) => sum + count, 0), 2);
console.log('Level-50 XP plan, overflow clipping, mixed Gold, materials-only farm and boss caps passed.');
