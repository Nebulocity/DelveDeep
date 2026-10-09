// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import GameState from '../game/GameState.js';
import { awardOrdinaryWave, isOrdinaryDelve } from '../game/DelveCheckpoints.js';
import { getDelveById } from '../data/delves.js';
import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';

globalThis.localStorage = { getItem: () => null, setItem() {} };
const context = { Phaser: { Scene: class {} }, GameState, awardOrdinaryWave, isOrdinaryDelve,
  HapticsService: { tap() {} }, fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS, Math };
const source = readFileSync(new URL('../scenes/BattleScene.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?$/gm, '').replace('export default class BattleScene', 'class BattleScene');
vm.runInNewContext(`${source}\nglobalThis.BattleScene = BattleScene;`, context);
const scene = new context.BattleScene();

const hero = { id: 'hero', name: 'Hero', level: 1, xp: 0, happiness: 70, maxHp: 100, attackPower: 10 };
GameState.currentDelve = { ...getDelveById('slime-cave') };
GameState.delveCheckpoints = { 'slime-cave': { nextWave: 5, campUnlocked: true } };
GameState.world.clearedDelves = [];

// ... copies the source's own fields into this object; fields listed later replace earlier
// ones. This is a shallow copy, so nested objects are still shared.
GameState.roster = [{ ...hero }];
GameState.activeParty = [{ ...hero }];
GameState.inventory.materials = {};
GameState.gold = 0;
GameState.run.entry = 'farm';
const unit = { id: 'hero', alive: true, hp: 20, maxHp: 100, arenaX: 0, arenaY: 0,

  // Restore actual missing HP without exceeding the unit's maximum.
  heal(amount) { this.hp += amount; } };

// Object.assign writes these fields into its first argument. Later sources replace earlier
// fields; nested values are not deep-copied. A Map pairs a key with a value. Unlike an
// array index, the key can be an ID or an object; get/set read and write that same key. A
// Set keeps each value once. has checks membership without searching a list for duplicate
// entries.
Object.assign(scene, {
  partyUnits: [unit], bossWaveIndex: 5, currentWaveIndex: 4, farmStopRequested: false,
  battleOver: false, waveTransitioning: false, earnedGold: 99,
  waves: Array.from({ length: 6 }, () => ({})),
  waveReturnPositions: new Map([['hero', { x: 0, y: 0 }]]),
  manualTargets: new Map(), heldUnitIds: new Set(), attackTargets: new Map(), activeTelegraphs: [], enemies: [],
  movement: { getWaveReturnPointClearOfFallenAllies: (u, home) => home, getSafeArenaPoint: (x, y) => ({ x, y }) },
  game: {}, combatRandom: () => 0.25, battleEvents: new Set(),
  time: { now: 10000, delayedCall() {} }, tweens: { add() {} },
  scale: { width: 2400, height: 1080 },

  add: { text() {
    const text = { destroy() {} };
    for (const method of ['setOrigin', 'setDepth', 'setName']) text[method] = () => text;
    return text;
  } },

  // We handle clear battle message here, keeping this operation in one place for its
  // callers.
  clearBattleMessage() {}, updateHud() {}, showBattleMessage() {}, formatWaveReward: reward => String(reward.gold),

  // We bring encounter status up to date here. The assignments below are the new values
  // other code will read after this step.
  updateEncounterStatus() {}, showWaveAnnouncement() {}, updateWaveCountdown() {}
});

let camps = 0;
scene.showDelveCamp = () => { camps += 1; };
const finishReturn = () => {
  scene.updateWaveRetreat(scene.time.now, 0.016, 16);
  assert.equal(camps, 0);
  scene.time.now += 3000;
  scene.updateWaveRetreat(scene.time.now, 0.016, 16);
};

// Completed farm waves bank rewards before repeating the same final pre-boss wave.
for (let round = 1; round <= 2; round += 1) {
  scene.waveTransitioning = false;
  scene.completeWave();
  assert.equal(GameState.gold, round);
  assert.equal(GameState.roster[0].xp, round);
  assert.equal(GameState.roster[0].happiness, 70 + round);

  // reduce carries an accumulated result from one entry to the next. The callback returns
  // the accumulator for the next step; the final argument supplies its starting value.
  assert.equal(Object.values(GameState.inventory.materials).reduce((sum, count) => sum + count, 0), round);
  assert.equal(unit.hp, 50);
  assert.equal(scene.earnedGold, 0);
  finishReturn();
  assert.equal(camps, 0);
  assert.equal(scene.currentWaveIndex, 4);
  assert.equal(GameState.run.entry, 'farm');
}

// A stop request cannot advance combat, grant rewards, or restore resources.
scene.waveTransitioning = false;
scene.waveRetreating = false;
unit.hp = 17;
assert.equal(scene.requestFarmStop(), true);
assert.equal(scene.requestFarmStop(), false);
assert.equal(scene.waveTransitioning, false);
assert.equal(scene.waveRetreating, false);

assert.equal(scene.currentWaveIndex, 4);
assert.equal(unit.hp, 17);
assert.equal(GameState.gold, 2);
assert.equal(camps, 0);
scene.completeWave();
assert.equal(GameState.gold, 3);
assert.equal(GameState.roster[0].xp, 3);

finishReturn();
assert.equal(camps, 1);
assert.deepEqual(GameState.delveCheckpoints['slime-cave'], { nextWave: 5, campUnlocked: true });

GameState.run.entry = 'progress';
scene.farmStopRequested = false;
assert.equal(scene.requestFarmStop(), false);
GameState.run.entry = 'farm';
GameState.currentDelve.type = 'void';
assert.equal(scene.requestFarmStop(), false);
GameState.currentDelve.type = 'delve';

scene.battleOver = true;
assert.equal(scene.requestFarmStop(), false);
console.log('Farm repeat, banked rewards and end-of-combat cancellation checks passed.');

let confirmation;
context.showConfirmation = (scene, options) => { confirmation = options; };
scene.battleOver = false;
scene.farmStopRequested = false;
GameState.run.entry = 'farm';
scene.confirmFarmStop();
assert.equal(scene.farmStopRequested, false);

assert.equal(confirmation.title, 'Cancel Farm?');

// ?. only follows this link when the value exists; a missing optional value gives
// undefined.
confirmation.onCancel?.();
assert.equal(scene.farmStopRequested, false);
scene.confirmFarmStop();
confirmation.onConfirm();
assert.equal(scene.farmStopRequested, true);
confirmation = null;
scene.confirmFarmStop();

assert.equal(confirmation, null);
let retreats = 0;
scene.fleeBattle = () => { retreats += 1; };
scene.confirmRetreat();
assert.equal(retreats, 0);
assert.match(confirmation.description, /stay banked/);
confirmation.onCancel?.();

assert.equal(retreats, 0);
confirmation.onConfirm();
assert.equal(retreats, 1);
GameState.currentDelve.type = 'void';
scene.confirmRetreat();
assert.match(confirmation.description, /rewards are lost/);
scene.battleOver = true;

confirmation = null;
scene.confirmRetreat();
assert.equal(confirmation, null);
console.log('Farm cancellation and retreat require confirmation before their actions run.');
