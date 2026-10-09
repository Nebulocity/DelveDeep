// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import * as map from '../data/worldMap.js';
import GameState from '../game/GameState.js';
import { loadProfile, saveProfile } from '../game/GameStorage.js';
import { PROFILE_STORAGE_KEY } from '../game/BuildSave.js';
import { everdeepUnlocked } from '../game/Everdeep.js';

assert.equal(map.pois.length, 8);

// filter keeps entries whose callback returns true. It builds a new list and leaves the
// original list in place.
assert.equal(map.pois.filter((poi) => poi.type === 'town').length, 1);
assert.equal(map.pois.filter((poi) => poi.type === 'delve').length, 5);
assert.equal(map.pois.filter((poi) => poi.type === 'void').length, 1);
assert.equal(map.pois.filter((poi) => poi.type === 'everdeep').length, 1);
assert.equal(map.routeBetween('pineshire', 'everdeep'), null);
assert.equal(map.routeBetween('pineshire', 'murmuring-abyss'), null);

// A Set keeps each value once. has checks membership without searching a list for
// duplicate entries.
const clears = new Set();

// The live destination list supplies the sequence; a separate runtime constant should
// not be needed just for this check. Keep the authored five-delve order explicit here.
const ordinaryDelves = map.pois.filter(poi => poi.type === 'delve').map(poi => poi.id);
assert.deepEqual(ordinaryDelves, ['slime-cave', 'thornbriar-hollow', 'dolmark-den', 'march-west-delves', 'verge-delves']);
for (const [index, id] of ordinaryDelves.entries()) {
  assert.ok(map.routeBetween('pineshire', id, (gate) => clears.has(gate)));
  assert.equal(map.routeBetween('pineshire', 'everdeep', (gate) => clears.has(gate)), null);
  if (index < 4) assert.equal(map.routeBetween('pineshire', ordinaryDelves[index + 1], (gate) => clears.has(gate)), null);
  clears.add(id);
}

for (const poi of map.pois) assert.ok(map.routeBetween('pineshire', poi.node, (gate) => clears.has(gate)));
for (const edge of map.roads) {
  assert.deepEqual(map.roadPoint(edge, 0), map.nodePoint(edge.from));
  const end = map.roadPoint(edge, 1), expected = map.nodePoint(edge.to);

  // Math.hypot calculates straight-line length from the x/y differences: square each, add
  // them, then take the square root.
  assert.ok(Math.hypot(end.x - expected.x, end.y - expected.y) < 0.0001);
  assert.ok(edge.length > 0);
}

const first = map.roads[0];
const halfway = map.roadPoint(first, 0.5);
const straight = { x: (first.points[0].x + first.points.at(-1).x) / 2, y: (first.points[0].y + first.points.at(-1).y) / 2 };
assert.ok(Math.hypot(halfway.x - straight.x, halfway.y - straight.y) > 10);
assert.equal(map.routeFromEdge(first.id, 0.1, 'slime-cave')[0], 'slime-cave');
assert.equal(map.routeFromEdge(first.id, 0.9, 'pineshire')[0], 'pineshire');
assert.equal(map.nearestTown('everdeep', () => true).id, 'pineshire');

// A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
// object; get/set read and write that same key.
const saved = new Map();
globalThis.localStorage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
saved.set(PROFILE_STORAGE_KEY, JSON.stringify({ gold: 37, records: { 'verge-delves': { clears: 1 } },
  delveCheckpoints: { 'march-west-delves': { nextWave: 3, campUnlocked: false } },
  world: { currentLocation: 'duskfall', clearedDelves: ['slime-cave'], travel: { edgeId: first.id, t: 0.4 } } }));
loadProfile([]);
assert.equal(GameState.world.currentLocation, 'pineshire');

assert.equal(GameState.gold, 37);
assert.equal(GameState.delveCheckpoints['march-west-delves'].nextWave, 3);
assert.equal(GameState.records['verge-delves'].clears, 1);
assert.equal(GameState.world.travel, null);
assert.equal(everdeepUnlocked(), true);
GameState.records = {};
GameState.world.clearedDelves = ordinaryDelves.slice(0, 3);

assert.equal(everdeepUnlocked(), false);
GameState.world.clearedDelves.push('verge-delves');
assert.equal(everdeepUnlocked(), true);
GameState.world.travel = { edgeId: first.id, t: 0.42, target: first.to, destinationId: 'slime-cave' };
saveProfile();
loadProfile([]);
assert.equal(GameState.world.travel.t, 0.42);

assert.equal(GameState.world.travel.destinationId, 'slime-cave');
console.log('Illustrated map progression, curved roads, Everdeep lock, and save migration passed.');
