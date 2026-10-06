export const ADJACENT_DISTANCE = 100;
export const NEAR_DISTANCE = 240;
export const ARENA_RANGE = 1000;

export function rangeLabel(range) {
  if (!range) return 'Self';
  return range <= 1 ? 'Adjacent' : range <= NEAR_DISTANCE / ADJACENT_DISTANCE ? 'Near' : 'Ranged';
}

export function arenaDistance(a, b) {
  return Math.hypot((a.arenaX ?? a.x) - (b.arenaX ?? b.x),
    (a.arenaY ?? a.y) - (b.arenaY ?? b.y));
}
