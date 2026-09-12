import GameState from './GameState.js';
import { grantAdventurerXp, adjustHappiness } from './AdventurerProgression.js';
import { recordDepthClear, saveLeaderProgression } from './LeaderProgression.js';
import { saveProfile } from './GameStorage.js';

export function beginExpedition() {
  GameState.run.startedAt = Date.now();
  GameState.run.elapsedMs = 0;
  GameState.run.summary = null;
  GameState.run.startingGold = GameState.gold;
  GameState.run.startingInventory = { ...GameState.inventory };
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
  const depth = GameState.currentDelve?.depth ?? 1;

  let voidKeysAwarded = 0;
  if (GameState.currentDelve?.type !== 'void') {
    const milestoneKey = depth % 5 === 0;
    const luckyKey = !milestoneKey && Math.random() < 0.20;
    if (milestoneKey || luckyKey) {
      voidKeysAwarded = 1;
      GameState.inventory.voidKeys = (GameState.inventory.voidKeys ?? 0) + 1;
      GameState.rewards.push({ type: 'voidKey', amount: 1, label: 'Void Key' });
    }
  }

  GameState.records[delveId] = {
    ...prior,
    clears: prior.clears + 1,
    bestTimeMs: isNewBest ? elapsedMs : previousBest,
    waves: GameState.currentDelve?.rooms ?? 3,
    lastRewards: GameState.rewards.map((reward) => ({ ...reward })),
    lastClearedAt: Date.now()
  };

  if (!GameState.world.clearedDelves.includes(delveId)) GameState.world.clearedDelves.push(delveId);
  const revealMap = {
    'slime-cave': ['thornbriar-hollow'],
    'thornbriar-hollow': ['duskfall'],
    'dolmark-den': [],
    'murmuring-abyss': []
  };
  (revealMap[delveId] ?? []).forEach((id) => {
    if (!GameState.world.discoveredLocations.includes(id)) GameState.world.discoveredLocations.push(id);
  });

  const leaderResult = GameState.leader ? recordDepthClear(GameState.leader, depth) : { leveledUp: false, inspirationEarned: 0 };
  GameState.run.summary = {
    result: 'victory',
    elapsedMs,
    isNewBest,
    adventurers: adventurerResults,
    leaderResult,
    voidKeysAwarded
  };
  saveProfile();
  return GameState.run.summary;
}

export function failExpedition() {
  const partyIds = new Set(GameState.activeParty.map((entry) => entry.id));
  GameState.roster.forEach((adventurer) => {
    if (partyIds.has(adventurer.id)) adjustHappiness(adventurer, -3);
  });
  GameState.run.summary = {
    result: 'defeat',
    elapsedMs: GameState.run.startedAt > 0 ? Date.now() - GameState.run.startedAt : 0,
    title: 'DEFEAT',
    message: 'The party was driven back. The Delve remains uncleared.'
  };
  saveProfile();
}

export function fleeExpedition() {
  GameState.gold = GameState.run.startingGold ?? GameState.gold;
  if (GameState.run.startingInventory) GameState.inventory = { ...GameState.run.startingInventory };
  GameState.rewards = [];
  GameState.currentRoom = 0;

  if (GameState.leader) {
    GameState.leader.inspirationPoints = Math.max(0, (GameState.leader.inspirationPoints ?? 0) - 1);
    saveLeaderProgression(GameState.leader);
  }

  GameState.run.summary = {
    result: 'fled',
    elapsedMs: GameState.run.startedAt > 0 ? Date.now() - GameState.run.startedAt : 0,
    title: 'PARTY FLED',
    message: 'The encounter was reset. Run rewards were abandoned and Inspiration was reduced.'
  };
  saveProfile();
  return GameState.run.summary;
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '--:--';
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
