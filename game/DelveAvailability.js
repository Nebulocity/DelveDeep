import GameState from './GameState.js';
import { everdeepUnlocked } from './Everdeep.js';

// Share the map's entry gates with preparation so a detour cannot bypass progression.
export function available(poi) {
  if (!poi) return false;
  if (GameState.development.unlockAll) return true;
  if (poi.type === 'everdeep') return everdeepUnlocked();
  return !poi.requiresClear || GameState.world.clearedDelves.includes(poi.requiresClear)
    || (GameState.records[poi.requiresClear]?.clears ?? 0) > 0;
}
