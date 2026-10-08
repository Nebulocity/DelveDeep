// Combat measures distance on the flat logical arena, before perspective changes what we
// see. Adjacent, Near and Ranged describe reach, not squares on a board. Keep distance
// checks in this space so units near the back of the artwork have the same gameplay reach
// as units near the front.

export const ADJACENT_DISTANCE = 100;
export const NEAR_DISTANCE = 240;
export const ARENA_RANGE = 1000;

// Turn a logical reach into the Adjacent, Near or Ranged label shown to the player.
export function rangeLabel(range) {
  if (!range) return 'Self';

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  return range <= 1 ? 'Adjacent' : range <= NEAR_DISTANCE / ADJACENT_DISTANCE ? 'Near' : 'Ranged';
}

// Measure straight-line distance using arena coordinates, with x/y points supported as
// inputs.
export function arenaDistance(a, b) {

  // Math.hypot calculates straight-line length from the x/y differences: square each, add
  // them, then take the square root. ?? uses the fallback only for null or undefined. A
  // real zero or false stays intact.
  return Math.hypot((a.arenaX ?? a.x) - (b.arenaX ?? b.x),
    (a.arenaY ?? a.y) - (b.arenaY ?? b.y));
}
