// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as map from '../data/worldMap.js';
import delves from '../data/delves.js';
import { createEncounterWaves } from '../data/encounters.js';
import GameState from '../game/GameState.js';

import { loadProfile, saveProfile } from '../game/GameStorage.js';
import { awardOrdinaryWave } from '../game/DelveCheckpoints.js';
import { everdeepUnlocked } from '../game/Everdeep.js';

// A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
// object; get/set read and write that same key.
const saved = new Map();
globalThis.localStorage = { getItem: (id) => saved.get(id) ?? null, setItem: (id, value) => saved.set(id, value) };
loadProfile([]);

// ... copies the source's own fields into this object; fields listed later replace earlier
// ones. This is a shallow copy, so nested objects are still shared.
const context = vm.createContext({ ...map, GameState, delves, saveProfile,
  HapticsService: { tap() {} }, everdeepUnlocked, settleEverdeep() {} });
vm.runInContext(fs.readFileSync(new URL('../ui/RegionMapUI.js', import.meta.url), 'utf8')
  .replace(/^import [\s\S]*?;\r?\n/gm, '').replaceAll('export function ', 'function ').replaceAll('export const ', 'const '), context);
vm.runInContext(fs.readFileSync(new URL('../scenes/ScrollingWorldMap.js', import.meta.url), 'utf8')
  .replace(/^import [\s\S]*?;\r?\n/gm, '').replaceAll('export function ', 'function ')
  .replaceAll('import.meta.env.DEV', 'false'), context);

for (const id of ['march-west-delves', 'verge-delves']) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const poi = map.pois.find((entry) => entry.id === id);
  const source = delves.find((delve) => delve.id === poi.template);
  const branch = { ...source, id, encounterId: poi.template };
  assert.deepEqual(createEncounterWaves(branch, 1400, () => 0), createEncounterWaves(source, 1400, () => 0));
  awardOrdinaryWave(branch, 0, branch.rooms - 1);
  assert.equal(GameState.delveCheckpoints[id].nextWave, 1);
  assert.equal(GameState.delveCheckpoints[source.id], undefined);
}

assert.equal(context.available(map.pois.find((poi) => poi.id === 'dolmark-den')), false);
GameState.world.clearedDelves.push('slime-cave', 'thornbriar-hollow');
assert.equal(context.available(map.pois.find((poi) => poi.id === 'dolmark-den')), true);
assert.equal(context.available(map.pois.find((poi) => poi.id === 'everdeep')), false);

const scene = { partyNode: 'pineshire', activeEdge: null, edgeTarget: null, edgeT: 0, partyFacing: 'south-east',
  party: { ...map.nodePoint('pineshire'), play() {}, setPosition(x, y) {
    this.x = x;
    this.y = y;
  } },

  partyLabel: { setPosition() {} }, partyCameraOffset: 200,
  cameras: { main: { scrollX: 1000, scrollY: 300, stopFollow() {}, startFollow() {},

    // We work out scroll here so callers can use the result. Keep the calculation together
    // with the checks below that decide which inputs are usable.
    getScroll(x, y) { return { x: x - 500, y: y - 300 }; },

    // We bring scroll up to date here. The assignments below are the new values other code
    // will read after this step.
    setScroll(x, y) {
      this.scrollX = x;
      this.scrollY = y;
    } } },

  tweens: { addCounter(options) {
    scene.panOptions = options;
    return { stop() {} };
  } },

  scene: { start(key) { scene.opened = key; } }, showToast(message) { this.toast = message; } };

context.selectPoi(scene, map.pois.find((poi) => poi.id === 'slime-cave'));
assert.equal(scene.cameras.main.scrollX, 1000);
scene.panOptions.onUpdate({ getValue: () => 0.5 });
assert.ok(scene.cameras.main.scrollX < 1000);
assert.ok(scene.cameras.main.scrollX > scene.cameras.main.getScroll(scene.party.x, scene.party.y - 200).x);
scene.panOptions.onUpdate({ getValue: () => 1 });
const panEndX = scene.cameras.main.scrollX;

scene.panOptions.onComplete();
assert.equal(scene.cameras.main.scrollX, panEndX);
assert.equal(JSON.parse(saved.get('delveDeep.profile.v2')).world.travel.destinationId, 'slime-cave');
for (let tick = 0; tick < 8; tick++) context.updateScrollingWorldMap(scene, 100);
const point = map.roadPoint(scene.activeEdge, scene.edgeT);
assert.equal(scene.party.x, point.x);
assert.equal(scene.party.y, point.y);

context.persistTravel(scene);
loadProfile([]);
assert.equal(GameState.world.travel.destinationId, 'slime-cave');
const display = (x = 0, y = 0) => {
  const object = { x, y, play() {}, setPosition(x, y) {
    this.x = x;
    this.y = y;
  } };
  for (const method of ['setDisplaySize', 'setOrigin', 'setDepth']) object[method] = () => object;
  return object;
};

const resumed = { ...scene, anims: { exists: () => true }, add: { sprite: display, text: display } };
context.createParty(resumed);
assert.equal(resumed.destination.id, 'slime-cave');
assert.equal(resumed.party.x, point.x);
assert.equal(resumed.party.y, point.y);
assert.equal(resumed.edgeTarget, 'slime-cave');
const beforePause = scene.edgeT;

scene.selectionDetailsClose = () => {};
context.updateScrollingWorldMap(scene, 100);
assert.equal(scene.edgeT, beforePause);
scene.selectionDetailsClose = null;
for (let tick = 0; tick < 50 && !scene.opened; tick++) context.updateScrollingWorldMap(scene, 100);
assert.equal(scene.opened, 'DelveSelectScene');
assert.equal(GameState.world.currentLocation, 'slime-cave');

assert.equal(GameState.world.travel, null);
assert.equal(GameState.currentDelve.id, 'slime-cave');
scene.opened = null;
context.selectPoi(scene, map.pois.find((poi) => poi.id === 'pineshire'));
for (let tick = 0; tick < 50 && !scene.opened; tick++) context.updateScrollingWorldMap(scene, 100);
assert.equal(scene.opened, 'TownScene');
assert.equal(GameState.world.currentLocation, 'pineshire');

console.log('Illustrated road travel, reload, pause, town return, and independent branch encounters passed.');
