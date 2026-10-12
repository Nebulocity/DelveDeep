// Retired test content must not become playable through catalogs or fallback encounters.
// Keep its artwork, floor outline and sprite registrations available for future reuse.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import delves, { getDelveById } from '../data/delves.js';
import enemies from '../data/enemies.js';
import retainedBackground from '../data/levels/VerdantTear.js';
import { createEncounterWaves, encounterEnemyCounts } from '../data/encounters.js';
import { getDelveArena } from '../combat/LayeredEnvironment.js';
import { VOID_SPRITES } from '../data/voidSprites.js';
import GameState from '../game/GameState.js';

const retiredMonsters = ['caveBat', 'stoneCrawler', 'voidWarden', 'riftSentinel', 'abyssalMaw'];
for (const type of retiredMonsters) assert.equal(enemies[type], undefined);
assert.equal(getDelveById('verdant-tear'), null);
assert.equal(delves.length, 6);
assert.deepEqual(createEncounterWaves({ id: 'verdant-tear', type: 'void' }), []);
assert.deepEqual(createEncounterWaves({ id: 'old-save', encounterId: 'verdant-tear' }), []);
assert.equal(retainedBackground.id, undefined);
assert.equal(retainedBackground.difficulty, undefined);

// Include future fallback difficulties and the guardian depth so no hidden wave revives a test monster.
const encounters = [...delves, ...Object.keys(encounterEnemyCounts).map(difficulty => ({ id: 'fallback', difficulty })),
  { id: 'void-portal', type: 'void', depth: 5 }];
for (const delve of encounters) {
  for (const wave of createEncounterWaves(delve, 1400, () => 0.5)) {
    for (const spawn of wave.enemies) {
      assert.ok(enemies[spawn.type], `${delve.id}: ${spawn.type} has an active definition`);
      assert.ok(!retiredMonsters.includes(spawn.type));
    }
  }
}

const environment = retainedBackground.visuals.environment;
assert.ok(fs.existsSync(new URL(environment.layers[0].url)));
for (const type of ['voidWarden', 'riftSentinel', 'abyssalMaw']) assert.ok(VOID_SPRITES[type]);
for (const [width, height] of [[2400, 1080], [960, 432]]) {
  const floor = getDelveArena(environment, width, height);
  assert.ok(floor.topLeftX < floor.topRightX);
  assert.ok(floor.bottomLeftX < floor.bottomRightX);
  assert.ok(floor.topY < floor.bottomY);
  assert.ok(floor.bottomY < height * 0.88);
}

// Boot already rejects retired encounter IDs and missing monster definitions. Exercise that real
// routing code with saved identities, while keeping roster progress and banked Gold intact.
let savedBattle;
const context = vm.createContext({ Phaser: { Scene: class {} }, GameState, adventurers: [],
  prepareBuildSave() {}, loadProfile() { GameState.activeBattle = savedBattle; },
  loadLeaderProgression() { return { level: 4 }; }, getDelveById, enemies });
vm.runInContext(fs.readFileSync(new URL('../scenes/BootScene.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replaceAll('import.meta.env.DEV', 'true')
  .replace('export default class BootScene', 'globalThis.Boot = class BootScene'), context);
GameState.roster = [{ id: 'hero', level: 8, xp: 123 }];
GameState.lastPartyIds = ['hero'];
GameState.gold = 456;
const boot = Object.create(context.Boot.prototype);
for (const snapshot of [{ delveId: 'verdant-tear', enemies: [] },
  ...retiredMonsters.map(enemyType => ({ delveId: 'slime-cave', enemies: [{ enemyType }] }))]) {
  savedBattle = snapshot;
  boot.initializeGameState();
  assert.equal(GameState.activeBattle, null);
  assert.equal(GameState.currentDelve, null);
  assert.equal(GameState.gold, 456);
  assert.equal(GameState.roster[0].level, 8);
  assert.equal(GameState.roster[0].xp, 123);
}
console.log('Retired monsters and Delve removed; fallback waves, artwork and saved progress remain safe.');
