import assert from 'node:assert/strict';
import { AREA_COLUMNS, AREA_ROWS, TILE, areas, nodes, pois, roads, seams, nodePoint, routeBetween } from '../data/worldMap.js';
import GameState from '../game/GameState.js';
import { loadProfile } from '../game/GameStorage.js';

assert.equal(areas.length, 9);
assert.equal(new Set(areas.map((area) => `${area.column}:${area.row}`)).size, 9);
assert.equal(pois.filter((poi) => poi.type === 'void').length, 2);
assert.deepEqual(roads.filter((road) => road.gate).map((road) => road.gate), ['murmuring-abyss', 'verdant-tear']);

for (const seam of seams) {
  const [a, b] = seam.areas.map((id) => areas.find((area) => area.id === id));
  assert.ok(a && b);
  if (seam.axis === 'horizontal') {
    assert.equal(a.column, b.column);
    assert.equal(Math.abs(a.row - b.row), 1);
    assert.equal(nodePoint(seam.node).y, Math.max(a.row, b.row) * AREA_ROWS * TILE);
  } else {
    assert.equal(a.row, b.row);
    assert.equal(Math.abs(a.column - b.column), 1);
    assert.equal(seam.tile, 60);
    const gateRoad = roads.find((road) => road.gate === seam.gate);
    const left = nodePoint(gateRoad.from);
    const right = nodePoint(gateRoad.to);
    const boundaryX = Math.max(a.column, b.column) * AREA_COLUMNS * TILE;
    assert.ok(Math.min(left.x, right.x) < boundaryX && boundaryX < Math.max(left.x, right.x));
    assert.equal(left.y, right.y);
  }
}

assert.equal(routeBetween('pineshire', 'far-verge'), null);
assert.equal(routeBetween('pineshire', 'far-verge', (gate) => gate === 'murmuring-abyss'), null);
assert.ok(routeBetween('pineshire', 'far-verge', () => true).includes('verdant-tear'));
for (const poi of pois) assert.ok(nodes[poi.node]);
for (const area of areas) {
  const areaPois = pois.filter((poi) => {
    const [x, y] = nodes[poi.node];
    return Math.floor(x / AREA_COLUMNS) === area.column && Math.floor(y / AREA_ROWS) === area.row;
  });
  assert.ok(areaPois.length, `No POI in ${area.id}`);
}

const saved = new Map();
globalThis.localStorage = {
  getItem: (key) => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value)
};
loadProfile([]);
assert.equal(GameState.world.currentLocation, 'pineshire');
assert.equal(GameState.world.travel, null);
assert.ok(GameState.world.discoveredLocations.includes('slime-cave'));
assert.ok(pois.some((poi) => poi.id === 'verdant-tear'));

console.log('World map graph, seams, gates, and fresh state passed.');