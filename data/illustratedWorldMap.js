// These points were traced on the selected map artwork. Coordinates belong to that image,
// before camera zoom or screen scaling. Roads connect nodes through their intermediate
// points; moving a label should not silently move the travel route.

export const TILE = 64;
export const WORLD_COLUMNS = 60;
export const WORLD_ROWS = 33.75;
export const WORLD_WIDTH = WORLD_COLUMNS * TILE;
export const WORLD_HEIGHT = WORLD_ROWS * TILE;
export const WORLD_LAYOUT_ID = 'illustrated-pineshire-v1';

export const regions = [{ id: 'pineshire-reach', name: 'Pineshire Reach', levelRange: [1, 30], column: 0 }];

export const areas = [{ id: 'pineshire-reach', name: 'Pineshire Reach', column: 0, row: 0 }];


// Keep established encounter IDs so prior boss clears and checkpoints remain attached.
export const pois = [
  { id: 'pineshire', name: 'Pineshire', type: 'town', position: [0.13, 0.76], label: [0.13, 0.60], conceptArt: 'town-concept-pineshire' },
  { id: 'slime-cave', name: 'The Slime Cave', type: 'delve', position: [0.16, 0.415], label: [0.15, 0.265], template: 'slime-cave' },
  { id: 'thornbriar-hollow', name: 'Thornbriar Hollow', type: 'delve', position: [0.30, 0.19], label: [0.30, 0.09], template: 'thornbriar-hollow', requiresClear: 'slime-cave' },
  { id: 'dolmark-den', name: 'Dolmark Den', type: 'delve', position: [0.57, 0.255], label: [0.57, 0.09], template: 'dolmark-den', requiresClear: 'thornbriar-hollow' },

  {
    id: 'march-west-delves',
    name: 'The Old Quarry',
    type: 'delve',
    position: [0.46, 0.54],
    label: [0.46, 0.37],
    template: 'old-quarry',
    requiresClear: 'dolmark-den',
    subtitle: 'An abandoned excavation haunted by creatures of stone and crystal.'
  },

  {
    id: 'verge-delves',
    name: 'The Sunken Watch',
    type: 'delve',
    position: [0.60, 0.775],
    label: [0.59, 0.59],
    template: 'sunken-watch',
    requiresClear: 'march-west-delves',
    subtitle: 'Drowned guardians haunt a ruined watchtower beside the river.'
  },

  { id: 'everdeep', name: 'The Everdeep', type: 'everdeep', position: [0.875, 0.34], label: [0.88, 0.09], regionId: 'pineshire-reach', requiresClear: 'verge-delves' },
  { id: 'murmuring-abyss', name: 'The Murmuring Abyss', type: 'void', position: [0.91, 0.74], label: [0.90, 0.555], template: 'murmuring-abyss', requiresClear: 'verge-delves' }
].map((poi) => ({ ...poi, node: poi.id }));

// Object.fromEntries turns [key, value] pairs back into an object. A later pair with the
// same key replaces the earlier value. map builds one output entry for each input entry,
// in the same order. The callback's return value becomes that output entry.
const normalizedNodes = Object.fromEntries(pois.map((poi) => [poi.node, poi.position]));
normalizedNodes['pineshire-fork'] = [0.825, 0.677];

export const nodes = Object.fromEntries(Object.entries(normalizedNodes).map(([id, [x, y]]) =>
  [id, [x * WORLD_COLUMNS - 0.5, y * WORLD_ROWS - 0.5]]));

export const nodePoint = (id) => {
  const tile = nodes[id];

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  return tile ? { x: tile[0] * TILE + TILE / 2, y: tile[1] * TILE + TILE / 2 } : null;
};

export const mapPoint = ([x, y]) => ({ x: x * WORLD_WIDTH, y: y * WORLD_HEIGHT });

export const branchLock = { position: [0.79, 0.705], requiresClear: 'verge-delves' };

export const regionExit = { position: [0.978, 0.80], requiresClear: 'murmuring-abyss', nextRegion: 'Highmere Crags' };

// Trace the painted paths; a saved t is the fraction of the complete curved road.
const link = (from, to, bends = [], gate = null) => {

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry. ... expands these entries into the new list or
  // call. It does not deep-copy the objects inside.
  const points = [normalizedNodes[from], ...bends, normalizedNodes[to]].map(mapPoint);

  // reduce carries an accumulated result from one entry to the next. The callback returns
  // the accumulator for the next step; the final argument supplies its starting value.
  const length = points.slice(1).reduce((total, point, index) =>
    total + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
  return { id: `${from}:${to}`, from, to, gate, points, length };
};

export const roads = [
  link('pineshire', 'slime-cave', [[0.145, 0.705], [0.15, 0.64], [0.151, 0.58], [0.157, 0.53], [0.175, 0.49], [0.182, 0.45]]),
  link('slime-cave', 'thornbriar-hollow', [[0.199, 0.393], [0.218, 0.366], [0.236, 0.325], [0.248, 0.281], [0.263, 0.236]], 'slime-cave'),
  link('thornbriar-hollow', 'dolmark-den', [[0.345, 0.207], [0.389, 0.219], [0.436, 0.217], [0.481, 0.23], [0.523, 0.254]], 'thornbriar-hollow'),
  link('dolmark-den', 'march-west-delves', [[0.566, 0.293], [0.541, 0.32], [0.515, 0.351], [0.50, 0.398], [0.478, 0.438], [0.481, 0.481]], 'dolmark-den'),
  link('march-west-delves', 'verge-delves', [[0.482, 0.576], [0.495, 0.62], [0.526, 0.65], [0.552, 0.681], [0.576, 0.714]], 'march-west-delves'),
  link('verge-delves', 'pineshire-fork', [[0.634, 0.743], [0.66, 0.728], [0.689, 0.71], [0.716, 0.695], [0.746, 0.706], [0.772, 0.72], [0.795, 0.703]], 'verge-delves'),
  link('pineshire-fork', 'everdeep', [[0.835, 0.622], [0.839, 0.567], [0.831, 0.521], [0.835, 0.48], [0.847, 0.428], [0.85, 0.39]]),
  link('pineshire-fork', 'murmuring-abyss', [[0.851, 0.694], [0.877, 0.719]])
];

// Find a point along the traced road, using progress through its connected line segments.
export function roadPoint(edge, t) {

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  let remaining = Math.max(0, Math.min(1, t)) * edge.length;
  for (let index = 1; index < edge.points.length; index++) {
    const a = edge.points[index - 1], b = edge.points[index];

    // Math.hypot calculates straight-line length from the x/y differences: square each,
    // add them, then take the square root.
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= length || index === edge.points.length - 1) {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const fraction = length ? Math.min(1, remaining / length) : 0;
      return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction };
    }

    remaining -= length;
  }

  return edge.points[0];
}

// Find connected roads between locations instead of cutting a straight line through the
// map.
export function routeBetween(from, to, isGateOpen = () => false) {
  if (!nodes[from] || !nodes[to]) return null;

  // A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
  // object; get/set read and write that same key. A Set keeps each value once. has checks
  // membership without searching a list for duplicate entries.
  const distances = new Map([[from, 0]]), previous = new Map(), pending = new Set([from]);
  while (pending.size) {

    // reduce carries an accumulated result from one entry to the next. The callback
    // returns the accumulator for the next step; the final argument supplies its starting
    // value. ... expands these entries into the new list or call. It does not deep-copy
    // the objects inside.
    const current = [...pending].reduce((best, id) => distances.get(id) < distances.get(best) ? id : best);
    pending.delete(current);
    if (current === to) break;

    for (const edge of roads) {
      if (edge.gate && !isGateOpen(edge.gate)) continue;

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const next = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (!next) continue;
      const distance = distances.get(current) + edge.length;

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      if (distance >= (distances.get(next) ?? Infinity)) continue;
      distances.set(next, distance);
      previous.set(next, current);
      pending.add(next);
    }
  }

  if (!distances.has(to)) return null;
  const result = [to];
  while (result[0] !== from) result.unshift(previous.get(result[0]));

  return result;
}

const routeLength = (route) => route.slice(1).reduce((total, id, index) => total + roads.find((road) =>
  road.from === route[index] && road.to === id || road.to === route[index] && road.from === id).length, 0);

// Continue a route from the road the party is already traveling.
export function routeFromEdge(edgeId, t, to, isGateOpen = () => false) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const edge = roads.find((candidate) => candidate.id === edgeId);
  if (!edge || edge.gate && !isGateOpen(edge.gate)) return null;

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  const progress = Math.max(0, Math.min(1, t));
  let best = null, shortest = Infinity;
  for (const [from, partial] of [[edge.from, progress], [edge.to, 1 - progress]]) {
    const route = routeBetween(from, to, isGateOpen);
    if (!route) continue;
    const distance = routeLength(route) + partial * edge.length;

    if (distance < shortest) {
      shortest = distance;
      best = route;
    }
  }

  return best;
}

// Choose an accessible return town using the world's connected routes.
export function nearestTown(from, isGateOpen = () => false, canVisit = () => true) {
  let nearest = null, shortest = Infinity;

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  for (const town of pois.filter((poi) => poi.type === 'town' && canVisit(poi))) {
    const route = routeBetween(from, town.node, isGateOpen);
    if (!route) continue;
    const distance = routeLength(route);

    if (distance < shortest) {
      shortest = distance;
      nearest = town;
    }
  }

  return nearest;
}
