// Exercise real reward paths, persistence, global milestone claims and shop gates.
import assert from 'node:assert/strict';
import GameState from '../game/GameState.js';
import { loadLeaderProgression, saveLeaderProgression, leaderAbilities, purchaseLeaderAbility,
  grantLeaderLevels, recordDelveCompletion } from '../game/LeaderProgression.js';
import { grantAdventurerLevels, grantAdventurerXp, xpRequired } from '../game/AdventurerProgression.js';
import { awardOrdinaryWave, delveRewardEligibility } from '../game/DelveCheckpoints.js';
import { awardOfflineFarmWaves } from '../game/OfflineFarmRewards.js';
import { completeExpedition, fleeExpedition, failExpedition } from '../game/ExpeditionProgression.js';
import { getDelveById } from '../data/delves.js';
import { LEADERSHIP_RARITIES } from '../config/renown.js';

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const fresh = () => {
  storage.clear();
  GameState.leader = loadLeaderProgression();
  return GameState.leader;
};
const hero = (id, level = 1) => ({ id, name: id, level, xp: 0, happiness: 70, maxHp: 100, attackPower: 10 });
let leader = fresh();
assert.equal(leader.level, 1);
assert.equal(leader.renownPoints, 1);
assert.deepEqual(leader.unlockedAbilities, []);
assert.deepEqual(leader.battleLoadout, []);
assert.equal(purchaseLeaderAbility(leader, 'focusFire'), true);
assert.equal(leader.renownPoints, 0);
assert.equal(leader.level, 1);
assert.deepEqual(leader.battleLoadout, ['focusFire']);
assert.deepEqual(loadLeaderProgression().battleLoadout, ['focusFire']);
assert.equal(purchaseLeaderAbility(leader, 'focusFire'), false);

// Buying a sixth tactic unlocks it without replacing any of the five chosen tactics.
const fullLeader = { ...leader, level: 50, renownPoints: 100, spentRenownPoints: 0,
  unlockedAbilities: ['focusFire', 'brace', 'shieldWall', 'supplies', 'ready'],
  battleLoadout: ['focusFire', 'brace', 'shieldWall', 'supplies', 'ready'] };
assert.equal(purchaseLeaderAbility(fullLeader, 'encouragement'), true);
assert.ok(fullLeader.unlockedAbilities.includes('encouragement'));
assert.deepEqual(fullLeader.battleLoadout, ['focusFire', 'brace', 'shieldWall', 'supplies', 'ready']);
saveLeaderProgression(leader);

// Two adventurers reaching five in the same banked wave award only one shared claim.
const cave = getDelveById('slime-cave');
GameState.currentDelve = cave;
GameState.roster = [hero('Valtheris', 4), hero('Durgrim', 4)];
GameState.roster.forEach(member => { member.xp = xpRequired(4) - 1; });
GameState.activeParty = structuredClone(GameState.roster);
GameState.world.clearedDelves = [];
GameState.delveCheckpoints = { [cave.id]: { nextWave: 5, campUnlocked: true } };
const units = GameState.roster.map(member => ({ id: member.id, alive: true }));
const wave = awardOrdinaryWave(cave, 4, 5, true, units, () => 0.99);
assert.equal(wave.leaderResult.renownPointsEarned, 1);
assert.equal(leader.level, 2);
assert.equal(leader.renownPoints, 1);
assert.deepEqual(leader.claimedCharacterMilestones, [5]);
leader = GameState.leader = loadLeaderProgression();
grantAdventurerLevels(hero('Elyra', 4), 1);
assert.equal(leader.renownPoints, 1);
assert.deepEqual(leader.battleLoadout, ['focusFire']);

// Boss XP crossing another milestone and first boss victory are separate achievements.
GameState.currentDelve = getDelveById('thornbriar-hollow');
GameState.roster = [hero('Valtheris', 9)];
GameState.roster[0].xp = xpRequired(9) - 10;
GameState.activeParty = structuredClone(GameState.roster);
GameState.records = {};
GameState.rewards = [];
const boss = completeExpedition();
assert.equal(boss.leaderResult.renownPointsEarned, 2);
assert.equal(leader.level, 4);
assert.equal(leader.renownPoints, 3);
assert.equal(completeExpedition().leaderResult.renownPointsEarned, 0);
const beforeRetreat = leader.renownPoints;
failExpedition();
fleeExpedition();
assert.equal(leader.renownPoints, beforeRetreat);

// Offline rewards can cross several thresholds and retain them after a reload.
leader = fresh();
const quarry = getDelveById('march-west-delves');
GameState.currentDelve = quarry;
GameState.roster = [hero('A'), hero('B')];
GameState.activeParty = structuredClone(GameState.roster);
GameState.delveCheckpoints = { [quarry.id]: { nextWave: 23, campUnlocked: true } };
const offline = awardOfflineFarmWaves(quarry, 22, 23, 10000,
  GameState.roster.map(member => ({ id: member.id, alive: true })), () => 0.99);
assert.equal(offline.renownPoints, 4);
assert.deepEqual(leader.claimedCharacterMilestones, [5, 10, 15, 20]);
GameState.leader = loadLeaderProgression();
assert.equal(GameState.leader.renownPoints, 5);
const again = awardOfflineFarmWaves(quarry, 22, 23, 10,
  GameState.roster.map(member => ({ id: member.id, alive: true })), () => 0.99);
assert.equal(again.renownPoints, 0);

// The authored route totals one starting point, six milestones and six completions.
leader = fresh();
const champion = hero('Champion');
for (const [level, id] of [[5, 'slime-cave'], [10, 'thornbriar-hollow'], [15, 'dolmark-den'],
  [20, 'march-west-delves'], [25, 'verge-delves'], [30, 'murmuring-abyss']]) {
  grantAdventurerLevels(champion, level - champion.level);
  assert.equal(recordDelveCompletion(leader, getDelveById(id)).renownPointsEarned, 1);
  assert.equal(recordDelveCompletion(leader, getDelveById(id)).renownPointsEarned, 0);
}
assert.equal(leader.level, 13);
assert.equal(leader.renownPoints, 13);
assert.equal(leader.claimedDelveBosses.length, 5);
assert.deepEqual(leader.closedVoidPortals, ['murmuring-abyss']);
assert.equal(recordDelveCompletion(leader, getDelveById('old-quarry')).renownPointsEarned, 0);
assert.equal(recordDelveCompletion(leader, getDelveById('sunken-watch')).renownPointsEarned, 0);

// Extra currency cannot bypass rarity gates. Test every future tier with catalog fixtures.
for (const [rarity, rule] of Object.entries(LEADERSHIP_RARITIES)) {
  const ability = { id: 'test-' + rarity, rarity, cost: rule.minCost ?? 0 };
  leaderAbilities.push(ability);
  leader.renownPoints = 1000;
  leader.level = Math.max(1, rule.level - 1);
  if (rule.level > 1) assert.equal(purchaseLeaderAbility(leader, ability.id), false);
  leader.level = rule.level;
  assert.equal(purchaseLeaderAbility(leader, ability.id), !rule.questOnly);
  leaderAbilities.pop();
}

// At the global cap, XP grants and Dev Tools stop, but new achievements still pay RP.
leader = fresh();
leader.level = 49;
assert.equal(grantLeaderLevels(leader, 5).levelsGained, 1);
assert.equal(grantLeaderLevels(leader, 1).renownPointsEarned, 0);
const capped = hero('Capped', 49);
grantAdventurerXp(capped, 1000000, 100);
assert.equal(capped.level, 50);
assert.equal(capped.xp, 0);
assert.equal(grantAdventurerXp(capped, 100).xpGained, 0);
assert.equal(grantAdventurerLevels(capped, 5).levelsGained, 0);
assert.equal(leader.level, 50);
assert.equal(recordDelveCompletion(leader, cave).renownPointsEarned, 1);
GameState.roster = [capped];
GameState.activeParty = [capped];
assert.equal(delveRewardEligibility({ bossPreparation: { level: 100 } }).eligibleIds.size, 0);
saveLeaderProgression(leader);
assert.deepEqual(loadLeaderProgression(), leader);
console.log('Renown achievements, purchases, persistence and caps passed.');
