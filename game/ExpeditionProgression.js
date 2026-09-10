import GameState from './GameState.js';
import { grantAdventurerXp, adjustHappiness } from './AdventurerProgression.js';
import { recordDepthClear } from './LeaderProgression.js';
import { saveProfile } from './GameStorage.js';

export function beginExpedition() {
  GameState.run.startedAt = Date.now();
  GameState.run.elapsedMs = 0;
  GameState.run.summary = null;
}

export function completeExpedition() {
  const elapsedMs = GameState.run.startedAt > 0 ? Date.now() - GameState.run.startedAt : 0;
  GameState.run.elapsedMs = elapsedMs;

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

  const delveId = GameState.currentDelve?.id ?? 'unknown';
  const prior = GameState.records[delveId] ?? { clears: 0, bestTimeMs: null };
  const previousBest = prior.bestTimeMs;
  const isNewBest = elapsedMs > 0 && (previousBest == null || elapsedMs < previousBest);

  GameState.records[delveId] = {
    clears: prior.clears + 1,
    bestTimeMs: isNewBest ? elapsedMs : previousBest
  };

  const depth = GameState.currentDelve?.depth ?? 1;
  const leaderResult = GameState.leader
    ? recordDepthClear(GameState.leader, depth)
    : { leveledUp: false, inspirationEarned: 0 };

  GameState.run.summary = {
    elapsedMs,
    isNewBest,
    adventurers: adventurerResults,
    leaderResult
  };

  saveProfile();
  return GameState.run.summary;
}

export function failExpedition() {
  const partyIds = new Set(GameState.activeParty.map((entry) => entry.id));
  GameState.roster.forEach((adventurer) => {
    if (partyIds.has(adventurer.id)) {
      adjustHappiness(adventurer, -3);
    }
  });
  saveProfile();
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '--:--';
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
