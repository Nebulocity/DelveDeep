// This applies the persistent result of a run: rewards, records and world unlocks. A
// combat victory and a saved world clear are related but separate steps. Changes here need
// to preserve already banked wave rewards and avoid paying a finished run twice.

import GameState from './GameState.js';
import { grantAdventurerXp, adjustHappiness } from './AdventurerProgression.js';
import { recordDepthClear, saveLeaderProgression } from './LeaderProgression.js';
import { saveProfile } from './GameStorage.js';
import { isOrdinaryDelve } from './DelveCheckpoints.js';

// This helper snapshots the run start so timing and retreat costs stay consistent.
export function beginExpedition() {

  GameState.run.startedAt = Date.now();
  GameState.run.elapsedMs = 0;
  GameState.run.summary = null;
  GameState.run.startingGold = GameState.gold;
}

// This helper applies a successful expedition to persistent progression. It awards party
// experience and happiness, updates clear records and map discoveries, advances player
// progression, and saves a summary for the reward screen.
export function completeExpedition() {

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const elapsedMs = GameState.run.startedAt > 0 ? Date.now() - GameState.run.startedAt : 0;
  GameState.run.elapsedMs = elapsedMs;

  // Award experience and happiness only to roster members who participated in this
  // expedition.
  const partyIds = new Set(GameState.activeParty.map((entry) => entry.id));
  const adventurerResults = [];
  GameState.roster.forEach((adventurer) => {

    if (!partyIds.has(adventurer.id)) return;
    const xpResult = grantAdventurerXp(adventurer, 35);
    adjustHappiness(adventurer, 5);

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    adventurer.delvesCompleted = (adventurer.delvesCompleted ?? 0) + 1;
    adventurerResults.push({
      id: adventurer.id,
      name: adventurer.name,
      xpGained: xpResult.xpGained,
      levelsGained: xpResult.levelsGained,
      level: adventurer.level,
      happiness: adventurer.happiness
    });
  });

  // Compare the completed run with its prior clear count and best recorded time.
  const delveId = GameState.currentDelve?.id ?? 'unknown';

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  const prior = GameState.records[delveId] ?? { clears: 0, bestTimeMs: null };
  const previousBest = prior.bestTimeMs;
  const isNewBest = elapsedMs > 0 && (previousBest == null || elapsedMs < previousBest);

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  const depth = GameState.currentDelve?.depth ?? 1;

  // Save the clear count, best time, and a copy of the latest reward list for map reviews.
  GameState.records[delveId] = {
    ...prior,
    clears: prior.clears + 1,
    bestTimeMs: isNewBest ? elapsedMs : previousBest,
    waves: GameState.currentDelve?.rooms ?? 3,
    lastRewards: GameState.rewards.map((reward) => ({ ...reward })),
    lastClearedAt: Date.now()
  };

  if (!GameState.world.clearedDelves.includes(delveId)) GameState.world.clearedDelves.push(delveId);

  // Reveal the next map locations associated with this cleared delve.
  const revealMap = {
    'slime-cave': ['thornbriar-hollow'],
    'thornbriar-hollow': ['dolmark-den'],
    'dolmark-den': ['march-west-delves'],
    'march-west-delves': ['verge-delves'],
    'verge-delves': ['everdeep', 'murmuring-abyss'],
    'murmuring-abyss': [],
    'verdant-tear': []
  };

  (revealMap[delveId] ?? []).forEach((id) => {

    if (!GameState.world.discoveredLocations.includes(id)) GameState.world.discoveredLocations.push(id);
  });

  // Apply leader depth progress and gather all results into the reward-screen summary.
  const leaderResult = GameState.leader ? recordDepthClear(GameState.leader, depth) : { leveledUp: false, tacticsPointsEarned: 0 };
  GameState.run.summary = {
    result: 'victory',
    elapsedMs,
    isNewBest,
    adventurers: adventurerResults,
    leaderResult
  };

  saveProfile();
  return GameState.run.summary;
}

// This helper applies defeat morale loss and saves the unsuccessful run.
export function failExpedition() {

  // A Set keeps each value once. has checks membership without searching a list for
  // duplicate entries. map builds one output entry for each input entry, in the same
  // order. The callback's return value becomes that output entry.
  const partyIds = new Set(GameState.activeParty.map((entry) => entry.id));
  GameState.roster.forEach((adventurer) => {

    if (partyIds.has(adventurer.id)) adjustHappiness(adventurer, -3);
  });

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  GameState.run.summary = {
    result: 'defeat',
    elapsedMs: GameState.run.startedAt > 0 ? Date.now() - GameState.run.startedAt : 0,
    title: 'DEFEAT',
    message: isOrdinaryDelve()
      ? 'The party was driven back. Cleared wave rewards and the camp checkpoint remain saved.'
      : 'The party was driven back. The encounter remains uncleared.'
  };

  saveProfile();
}

// This helper handles retreat, deducts up to one Tactics Point, and saves the summary.
export function fleeExpedition() {

  // Ordinary Delve waves bank their rewards when cleared.
  if (!isOrdinaryDelve()) GameState.gold = GameState.run.startingGold ?? GameState.gold;
  GameState.rewards = [];
  GameState.currentRoom = 0;

  // Charge the retreat penalty without letting Tactics Points fall below zero.
  if (GameState.leader) {

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound. ?? uses the fallback only for null or
    // undefined. A real zero or false stays intact.
    GameState.leader.tacticsPoints = Math.max(0, (GameState.leader.tacticsPoints ?? 0) - 1);
    saveLeaderProgression(GameState.leader);
  }

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  GameState.run.summary = {
    result: 'fled',
    elapsedMs: GameState.run.startedAt > 0 ? Date.now() - GameState.run.startedAt : 0,
    title: 'PARTY FLED',
    message: isOrdinaryDelve()
      ? 'Cleared wave rewards remain banked. Tactics Points was reduced.'
      : 'The encounter was reset. Run rewards were abandoned and Tactics Points was reduced.'
  };

  saveProfile();
  return GameState.run.summary;
}

// This helper presents run times in minutes and seconds for easy comparison.
export function formatDuration(ms) {

  if (!Number.isFinite(ms) || ms <= 0) return '--:--';

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  const totalSeconds = Math.max(0, Math.round(ms / 1000));

  // Math.floor rounds toward the smaller whole number, so 3.8 becomes 3.
  const minutes = Math.floor(totalSeconds / 60);

  // % gives the remainder. With a nonnegative index and positive list length, it wraps the
  // index back to the start of the list.
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
