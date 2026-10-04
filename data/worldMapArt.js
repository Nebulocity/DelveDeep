import { TILE, areas, nodes, roads, pois, nodePoint } from './worldMap.js';

export const BIOMES = [
  { id: 'thornwood', terrain: 'forest', density: 0.8, prop: 'pine', tint: 0xffffff },
  { id: 'highlands', terrain: 'meadow', density: 0.52, prop: 'mountain', tint: 0xd8e0d3 },
  { id: 'heights', terrain: 'river', density: 0.48, prop: 'mountain', tint: 0xd9eafa },
  { id: 'vale', terrain: 'forest', density: 0.32, prop: 'pine', tint: 0xbadba2 },
  { id: 'march', terrain: 'meadow', density: 0.2, prop: 'pine', tint: 0xe0d49c },
  { id: 'crossing', terrain: 'river', density: 0.22, prop: 'pine', tint: 0x91bebb },
  { id: 'foothills', terrain: 'forest', density: 0.48, prop: 'mountain', tint: 0xb5aaa7 },
  { id: 'drylands', terrain: 'meadow', density: 0.7, prop: 'ruin', tint: 0xe7c48e },
  { id: 'verge', terrain: 'river', density: 0.48, prop: 'ruin', tint: 0xabc5c3 }
];

export function noise(x, y, seed = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export function distanceToRoad(x, y) {
  let closest = Infinity;
  for (const road of roads) {
    const [ax, ay] = nodes[road.from];
    const [bx, by] = nodes[road.to];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    closest = Math.min(closest, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return closest;
}

export function sceneryClear(x, y, padding = 2.5) {
  return distanceToRoad(x, y) > padding && areas.every((area) =>
    Math.abs(x - (area.column * 40 + 8)) > 5 || Math.abs(y - (area.row * 24 + 5)) > 2)
    && pois.every((poi) => {
    const [px, py] = nodes[poi.node];
    return Math.abs(x - px) > 5 || Math.abs(y - py) > 4;
  });
}

export function terrainVertex(terrain, x, y) {
  if (terrain === 'river') {
    const riverX = 106 + Math.sin(y * 0.09) * 1.5;
    const lake = ((x - 88) / 6) ** 2 + ((y - 63) / 4) ** 2 < 1;
    return Number(Math.abs(x - riverX) < 1.8 || lake);
  }
  const field = Math.sin(x * 0.22) + Math.cos(y * 0.29) + Math.sin((x + y) * 0.12);
  return Number(field > (terrain === 'forest' ? -0.15 : 0.1));
}

export function terrainCorners(terrain, x, y) {
  return [terrainVertex(terrain, x, y), terrainVertex(terrain, x + 1, y),
    terrainVertex(terrain, x + 1, y + 1), terrainVertex(terrain, x, y + 1)];
}

export const biomeForArea = (area) => BIOMES[area.row * 3 + area.column];

export function decorationPlan() {
  const plan = [];
  for (const area of areas) {
    const biome = biomeForArea(area);
    for (let y = 2; y < 24; y += 3) for (let x = 2; x < 40; x += 3) {
      const gx = area.column * 40 + x + noise(x, y, area.row) * 1.5;
      const gy = area.row * 24 + y + noise(y, x, area.column) * 1.5;
      if (!sceneryClear(gx, gy) || noise(gx, gy, 8) > biome.density) continue;
      if (biome.terrain === 'river' && terrainVertex('river', gx, gy)) continue;
      plan.push({ texture: `map-${biome.prop}`, x: (gx + 0.5) * TILE, y: (gy + 0.5) * TILE,
        size: biome.prop === 'mountain' ? 210 : biome.prop === 'ruin' ? 150 : 180, tint: biome.tint });
    }
  }
  return plan;
}

export function poiArt(poi) {
  if (poi.type === 'town') return 'map-town';
  if (poi.type === 'void') return 'map-portal';
  if (poi.type === 'waypoint') return 'map-ruin';
  if (poi.id === 'verge-delves' || poi.id === 'thornbriar-hollow') return 'map-ruin';
  return 'map-cave';
}

export function roadSegments() {
  return roads.map((road) => ({ ...road, a: nodePoint(road.from), b: nodePoint(road.to) }));
}
