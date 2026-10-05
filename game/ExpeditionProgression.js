import GameState from './GameState.js';
import { grantAdventurerXp, adjustHappiness } from './AdventurerProgression.js';
import { recordDepthClear, saveLeaderProgression } from './LeaderProgression.js';
import { saveProfile } from './GameStorage.js';
import { isOrdinaryDelve } from './DelveCheckpoints.js';

// This function snapshots the run start so timing and retreat costs stay
// consistent.
export function beginExpedition() {

  GameState.run.startedAt = Date.now();
  GameState.run.elapsedMs = 0;
  GameState.run.summary = null;
  GameState.run.startingGold = GameState.gold;
}

// This function applies a successful expedition to persistent progression. It
// awards party experience and happiness, updates
// clear records and map discoveries, advances player progression, and saves a
// summary for the reward screen.
export function completeExpedition() {

  const elapsedMs = GameState.run.startedAt > 0 ? Date.now() - GameState.run.startedAt : 0;
  GameState.run.elapsedMs = elapsedMs;

  // Award experience and happiness only to roster members who participated in
  // this expedition.
  const partyIds = new Set(GameState.activeParty.map((entry) => entry.id));
  const adventurerResults = [];
  GameState.roster.forEach((adventurer) => {

    if (!partyIds.has(adventurer.id)) return;
    const xpResult = grantAdventurerXp(adventurer, 35);
    adjustHappiness(adventurer, 5);
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

  // Compare the completed run with its prior clear count and best recorded
  // time.
  const delveId = GameState.currentDelve?.id ?? 'unknown';
  const prior = GameState.records[delveId] ?? { clears: 0, bestTimeMs: null };
  const previousBest = prior.bestTimeMs;
  const isNewBest = elapsedMs > 0 && (previousBest == null || elapsedMs < previousBest);
  const depth = GameState.currentDelve?.depth ?? 1;

  // Save the clear count, best time, and a copy of the latest reward list for
  // map reviews.
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

  // Apply leader depth progress and gather all results into the reward-screen
  // summary.
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

// This function applies defeat morale loss and saves the unsuccessful run.
export function failExpedition() {

  const partyIds = new Set(GameState.activeParty.map((entry) => entry.id));
  GameState.roster.forEach((adventurer) => {

    if (partyIds.has(adventurer.id)) adjustHappiness(adventurer, -3);
  });
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

// This function handles retreat, deducts up to one Tactics Point, and saves the summary.
export function fleeExpedition() {

  // Ordinary Delve waves bank their rewards when cleared.
  if (!isOrdinaryDelve()) GameState.gold = GameState.run.startingGold ?? GameState.gold;
  GameState.rewards = [];
  GameState.currentRoom = 0;

  // Charge the retreat penalty without letting Tactics Points fall below zero.
  if (GameState.leader) {
    GameState.leader.tacticsPoints = Math.max(0, (GameState.leader.tacticsPoints ?? 0) - 1);
    saveLeaderProgression(GameState.leader);
  }

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

// This function presents run times in minutes and seconds for easy
// comparison.
export function formatDuration(ms) {

  if (!Number.isFinite(ms) || ms <= 0) return '--:--';
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
