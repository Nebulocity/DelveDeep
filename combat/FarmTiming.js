// Optional version-1 snapshot fields learn a party's whole farm-cycle duration. Old
// saves can seed this history from their recent wave-start log entries.
import { OFFLINE_FARM } from '../config/offlineFarm.js';

export function farmCycleMs(scene) {
  const timing = scene.farmTiming ??= { samples: [] };
  if (!timing.samples?.length) {
    const starts = (scene.combatLog?.entries ?? []).filter(entry => entry.type === 'wave');
    const samples = [];
    for (let index = 1; index < starts.length; index++) {
      const previous = starts[index - 1], current = starts[index];
      if (previous.wave !== scene.currentWaveIndex + 1 || current.wave !== previous.wave) continue;
      const duration = (current.time - previous.time) * 1000;
      if (Number.isFinite(duration) && duration >= OFFLINE_FARM.minimumCycleMs) samples.push(duration);
    }
    timing.samples = samples.slice(-OFFLINE_FARM.sampleCount);
  }
  const samples = timing.samples.filter(value => Number.isFinite(value) && value >= OFFLINE_FARM.minimumCycleMs);
  return samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length
    : OFFLINE_FARM.fallbackCycleMs;
}

// Only real completed cycles teach the average. The first clear after a staged return
// establishes a new starting timestamp; its shortened fight is not a speed sample.
export function recordFarmClear(scene) {
  const timing = scene.farmTiming ??= { samples: [] };
  const duration = scene.time.now - timing.measuredClearAt;
  if (Number.isFinite(timing.measuredClearAt) && duration >= OFFLINE_FARM.minimumCycleMs) {
    timing.samples = [...(timing.samples ?? []), duration].slice(-OFFLINE_FARM.sampleCount);
  }
  timing.measuredClearAt = scene.time.now;
  timing.lastClearAt = scene.time.now;
}
