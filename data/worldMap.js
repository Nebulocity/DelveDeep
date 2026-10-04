export const TILE = 64;
export const AREA_COLUMNS = 40;
export const AREA_ROWS = 24;
export const WORLD_COLUMNS = AREA_COLUMNS * 3;
export const WORLD_ROWS = AREA_ROWS * 3;

export const regions = [
  { id: 'pineshire-reach', name: 'Pineshire Reach', levelRange: [1, 3], column: 0 },
  { id: 'middle-march', name: 'Middle March', levelRange: [4, 6], column: 1 },
  { id: 'eastern-verge', name: 'Eastern Verge', levelRange: [7, 9], column: 2 }
];

export const areas = [
  { id: 'northwest', name: 'Thornwood', column: 0, row: 0 },
  { id: 'north', name: 'Northern March', column: 1, row: 0 },
  { id: 'northeast', name: 'Eastern Heights', column: 2, row: 0 },
  { id: 'west', name: 'Pineshire Vale', column: 0, row: 1 },
  { id: 'center', name: 'The Crossroads', column: 1, row: 1 },
  { id: 'east', name: 'Eastern Crossing', column: 2, row: 1 },
  { id: 'southwest', name: 'Duskfall Foothills', column: 0, row: 2 },
  { id: 'south', name: 'Southern March', column: 1, row: 2 },
  { id: 'southeast', name: 'The Far Verge', column: 2, row: 2 }
];

// Tile coordinates are global, so the same node defines both sides of every seam.
export const nodes = {
  pineshire: [12, 36],
  'slime-cave': [25, 35],
  'west-crossroads': [20, 36],
  'west-north-seam': [20, 23.5],
  'thornbriar-hollow': [20, 14],
  'west-south-seam': [20, 47.5],
  duskfall: [14, 58],
  'dolmark-den': [27, 62],
  everdeep: [15, 68],
  'murmuring-abyss': [35, 59],
  'first-gate-west': [39, 60],
  'first-gate-east': [41, 60],
  'south-march': [53, 59],
  'verdant-tear': [69, 59],
  'second-gate-west': [79, 60],
  'second-gate-east': [81, 60],
  'far-verge': [94, 59],
  'middle-center': [60, 36],
  'middle-north-seam': [60, 23.5],
  'middle-south-seam': [60, 47.5],
  'middle-north': [60, 15],
  'east-center': [100, 36],
  'east-north-seam': [100, 23.5],
  'east-south-seam': [100, 47.5],
  'east-north': [100, 15],
  'middle-northwest': [48, 13],
  'middle-northeast': [72, 13],
  'east-northwest': [88, 13],
  'east-northeast': [112, 13],
  'east-west-crossing': [88, 36],
  'east-east-crossing': [112, 36],
  'far-north-verge': [100, 7],
  'middle-northwest-seam': [48, 23.5],
  'middle-northeast-seam': [72, 23.5],
  'east-northwest-seam': [88, 23.5],
  'east-northeast-seam': [112, 23.5],
  'far-south-verge': [100, 69],
  'middle-southwest': [48, 59],
  'pineshire-south-branch': [12, 46],
  'thornwood-east-branch': [30, 14],
  'march-west-branch': [48, 36],
  'march-east-branch': [72, 36],
  'far-verge-north-branch': [94, 46]
};

export const seams = [
  { areas: ['northwest', 'west'], axis: 'horizontal', tile: 20, node: 'west-north-seam' },
  { areas: ['west', 'southwest'], axis: 'horizontal', tile: 20, node: 'west-south-seam' },
  { areas: ['north', 'center'], axis: 'horizontal', tile: 60, node: 'middle-north-seam' },
  { areas: ['center', 'south'], axis: 'horizontal', tile: 60, node: 'middle-south-seam' },
  { areas: ['northeast', 'east'], axis: 'horizontal', tile: 100, node: 'east-north-seam' },
  { areas: ['east', 'southeast'], axis: 'horizontal', tile: 100, node: 'east-south-seam' },
  { areas: ['southwest', 'south'], axis: 'vertical', tile: 60, gate: 'murmuring-abyss' },
  { areas: ['south', 'southeast'], axis: 'vertical', tile: 60, gate: 'verdant-tear' }
];

const link = (from, to, gate = null) => ({ id: `${from}:${to}`, from, to, gate });

export const roads = [
  link('pineshire', 'west-crossroads'), link('west-crossroads', 'slime-cave'),
  link('pineshire', 'pineshire-south-branch'), link('pineshire-south-branch', 'west-south-seam'),
  link('west-crossroads', 'west-north-seam'), link('west-north-seam', 'thornbriar-hollow'),
  link('west-north-seam', 'middle-northwest'),
  link('thornbriar-hollow', 'thornwood-east-branch'), link('thornwood-east-branch', 'middle-northwest'),
  link('west-crossroads', 'west-south-seam'), link('west-south-seam', 'duskfall'),
  link('west-south-seam', 'middle-southwest'),
  link('duskfall', 'dolmark-den'), link('dolmark-den', 'murmuring-abyss'),
  link('duskfall', 'everdeep'),
  link('murmuring-abyss', 'first-gate-west'),
  link('first-gate-west', 'first-gate-east', 'murmuring-abyss'),
  link('first-gate-east', 'south-march'),
  link('south-march', 'middle-southwest'),
  link('south-march', 'verdant-tear'),
  link('verdant-tear', 'second-gate-west'),
  link('second-gate-west', 'second-gate-east', 'verdant-tear'),
  link('second-gate-east', 'far-verge'),
  link('far-verge', 'far-verge-north-branch'), link('far-verge-north-branch', 'east-south-seam'),
  link('far-verge', 'far-south-verge'),
  link('south-march', 'middle-south-seam'), link('middle-south-seam', 'middle-center'),
  link('middle-south-seam', 'march-west-branch'), link('march-west-branch', 'middle-center'),
  link('middle-south-seam', 'march-east-branch'), link('march-east-branch', 'middle-center'),
  link('middle-center', 'middle-north-seam'), link('middle-north-seam', 'middle-north'),
  link('middle-north', 'middle-northwest'), link('middle-north', 'middle-northeast'),
  link('middle-northwest', 'middle-northwest-seam'), link('middle-northwest-seam', 'middle-north-seam'),
  link('middle-northeast', 'middle-northeast-seam'), link('middle-northeast-seam', 'middle-north-seam'),
  link('far-verge', 'east-south-seam'), link('east-south-seam', 'east-center'),
  link('east-center', 'east-north-seam'), link('east-north-seam', 'east-north'),
  link('east-north', 'east-northwest'), link('east-north', 'east-northeast'),
  link('east-northwest', 'east-northwest-seam'), link('east-northwest-seam', 'east-north-seam'),
  link('east-northeast', 'east-northeast-seam'), link('east-northeast-seam', 'east-north-seam'),
  link('east-center', 'east-west-crossing'), link('east-center', 'east-east-crossing')
];

export const pois = [
  { id: 'pineshire', name: 'Pineshire', node: 'pineshire', type: 'town', conceptArt: 'town-concept-pineshire' },
  { id: 'slime-grotto', name: 'The Mosslight Grotto', node: 'pineshire-south-branch', type: 'delve', template: 'slime-cave' },
  { id: 'slime-cave', name: 'The Slime Cave', node: 'slime-cave', type: 'delve' },
  { id: 'thornbriar-hollow', name: 'Thornbriar Hollow', node: 'thornbriar-hollow', type: 'delve' },
  { id: 'thornwood-rift', name: 'The Thornwood Rift', node: 'thornwood-east-branch', type: 'void', template: 'murmuring-abyss' },
  { id: 'duskfall', name: 'Duskfall', node: 'duskfall', type: 'town', conceptArt: 'town-concept-mountain-hold' },
  { id: 'dolmark-den', name: 'Dolmark Den', node: 'dolmark-den', type: 'delve' },
  { id: 'everdeep', name: 'The Everdeep', node: 'everdeep', type: 'everdeep', regionId: 'pineshire-reach' },
  { id: 'murmuring-abyss', name: 'The Murmuring Abyss', node: 'murmuring-abyss', type: 'void' },
  { id: 'south-march', name: 'Southern March', node: 'south-march', type: 'waypoint' },
  { id: 'middle-center', name: 'The Crossroads', node: 'middle-center', type: 'waypoint' },
  { id: 'middle-north', name: 'Northern March', node: 'middle-north', type: 'waypoint' },
  { id: 'middle-northwest', name: 'Pinewatch', node: 'middle-northwest', type: 'waypoint' },
  { id: 'middle-northeast', name: 'Highmere', node: 'middle-northeast', type: 'waypoint' },
  { id: 'march-west-delves', name: 'The Old Quarry', node: 'march-west-branch', type: 'delve', template: 'dolmark-den' },
  { id: 'march-east-portal', name: 'The Gloaming Scar', node: 'march-east-branch', type: 'void', template: 'murmuring-abyss' },
  { id: 'verdant-tear', name: 'The Verdant Tear', node: 'verdant-tear', type: 'void' },
  { id: 'far-verge', name: 'The Far Verge', node: 'far-verge', type: 'waypoint' },
  { id: 'east-center', name: 'Eastern Crossing', node: 'east-center', type: 'waypoint' },
  { id: 'east-north', name: 'Eastern Heights', node: 'east-north', type: 'waypoint' },
  { id: 'east-northwest', name: 'Westwatch', node: 'east-northwest', type: 'waypoint' },
  { id: 'east-northeast', name: 'Sunward Crest', node: 'east-northeast', type: 'waypoint' },
  { id: 'east-west-crossing', name: 'Old Bridge', node: 'east-west-crossing', type: 'waypoint' },
  { id: 'east-east-crossing', name: 'Rivergate', node: 'east-east-crossing', type: 'waypoint' },
  { id: 'verge-delves', name: 'The Sunken Watch', node: 'far-verge-north-branch', type: 'delve', template: 'thornbriar-hollow', conceptArt: 'delve-concept-sunken-watch' }
];

export const nodePoint = (id) => {
  const tile = nodes[id];
  return tile ? { x: tile[0] * TILE + TILE / 2, y: tile[1] * TILE + TILE / 2 } : null;
};

export function routeBetween(from, to, isGateOpen = () => false) {
  if (!nodes[from] || !nodes[to]) return null;
  const distances = new Map([[from, 0]]);
  const previous = new Map();
  const pending = new Set([from]);
  while (pending.size) {
    const current = [...pending].reduce((best, id) => distances.get(id) < distances.get(best) ? id : best);
    pending.delete(current);
    if (current === to) break;
    for (const edge of roads) {
      if (edge.gate && !isGateOpen(edge.gate)) continue;
      const next = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (!next) continue;
      const a = nodePoint(current);
      const b = nodePoint(next);
      const distance = distances.get(current) + Math.hypot(a.x - b.x, a.y - b.y);
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
