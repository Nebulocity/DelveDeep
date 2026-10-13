// All durations are milliseconds. A complete cycle includes fighting, returning home,
// resting and the next countdown. Live clears replace the fallback with observed times.
export const OFFLINE_FARM = {
  minimumGapMs: 5000,
  fallbackCycleMs: 60000,
  minimumCycleMs: 8000,
  sampleCount: 8,
  maxWavesPerBatch: 10000,
  partyHealth: [0.75, 0.95],
  partyMana: [0.65, 0.95],
  remainingEnemies: [0.4, 0.7],
  enemyHealth: [0.35, 0.8]
};
