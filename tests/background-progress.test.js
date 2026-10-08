// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import BackgroundProgress from '../services/BackgroundProgress.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Clock = require('phaser/src/time/Clock.js');
const TweenManager = require('phaser/src/tweens/TweenManager.js');
const EventEmitter = require('eventemitter3');
let wallTime = 1000;
let advanced = 0;
let paused = false;
let muted = false;

// A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
// object; get/set read and write that same key.
const listeners = new Map();
const surface = {
  hidden: false,

  // We build or display event listener using the current inputs. The objects and values
  // made below are the pieces this part of the screen needs.
  addEventListener(name, callback) { listeners.set(name, callback); },

  // We handle remove event listener here, keeping this operation in one place for its
  // callers.
  removeEventListener(name) { listeners.delete(name); },

  // We bring interval up to date here. The assignments below are the new values other code
  // will read after this step.
  setInterval() { return 1; }, clearInterval() {},
  body: { appendChild() {} },

  // We build or display element using the current inputs. The objects and values made
  // below are the pieces this part of the screen needs.
  createElement() { return { style: {}, setAttribute() {}, remove() {} }; }
};

const tween = { getDelta: () => 17 };
const originalTweenDelta = tween.getDelta;
const steps = [];
const game = { loop: { time: 0 }, events: { once() {} }, scene: {
  scenes: [{ tweens: tween }], isProcessing: false,

  // We bring update up to date here. The assignments below are the new values other code
  // will read after this step. time is a timestamp on the gameplay clock in milliseconds,
  // not a duration. delta is elapsed frame time in milliseconds; divide by 1000 for
  // movement in seconds.
  update(time, delta) {
    steps.push({ time, delta });
    this.isProcessing = true;
    if (!paused) advanced += delta;
  }
} };

const originalUpdate = game.scene.update;
const progress = new BackgroundProgress(game, {

  // We handle now here, keeping this operation in one place for its callers.
  now: () => wallTime, budgetNow: () => 0,
  document: surface, window: surface,

  // We handle on background here, keeping this operation in one place for its callers.
  onBackground: value => { muted = value; }
});

wallTime += 17;
game.scene.update(17, 17);
assert.equal(advanced, 17);
progress.setHidden(true);
wallTime += 10000;
progress.pump();
assert.equal(advanced, 10017);

assert.equal(muted, true);
assert.equal(game.scene.isProcessing, false);
assert.equal(tween.getDelta, originalTweenDelta);

// every requires all entries to pass the check; an empty list gives true.
assert.ok(steps.every(step => step.delta <= 50));
assert.ok(steps.every((step, index) => index === 0 || step.time > steps[index - 1].time));

// Duplicate lifecycle signals and hidden RAF callbacks must never double count time.
progress.setHidden(true);
game.scene.update(10017, 17);
progress.setHidden(false);
assert.equal(advanced, 10017);
assert.equal(muted, false);
wallTime += 17;
game.scene.update(10034, 17);

assert.equal(advanced, 10034);

// Manual pause consumes elapsed background time without progressing combat.
paused = true;
progress.setHidden(true);
wallTime += 5000;
progress.pump();
assert.equal(advanced, 10034);
progress.setHidden(false);
paused = false;

wallTime += 17;
game.scene.update(15051, 17);
assert.equal(advanced, 10051);

// Resume also catches suspension where no visibility notification was delivered.
wallTime += 60000;
game.scene.update(75051, 17);
assert.equal(advanced, 70051);
assert.ok(progress.pendingMs < 50);

// A long replay yields with all remaining time retained, then completes exactly once.
const before = advanced;
let budgetTime = 0;
progress.budgetNow = () => budgetTime += 13;
progress.setHidden(true);
wallTime += 60000;
progress.pump();
assert.equal(advanced - before, 100);

assert.equal(progress.pendingMs, 59900);
progress.budgetNow = () => 0;
progress.setHidden(false);
assert.equal(advanced - before, 60000);
assert.equal(progress.pendingMs, 0);

// A backwards system clock never produces negative combat steps.
wallTime -= 1000;
progress.setHidden(true);
assert.equal(progress.pendingMs, 0);
progress.destroy();
assert.equal(game.scene.update, originalUpdate);
assert.equal(listeners.size, 0);
assert.equal(muted, false);

console.log('Background elapsed time, suspension, pause, tween clocks and lifecycle checks passed.');

// Exercise real Phaser clocks and tween completion, including timers added by callbacks.
const events = new EventEmitter();
const realScene = { sys: { events, game: { loop: { time: 0 } } } };
realScene.time = new Clock(realScene);
realScene.tweens = new TweenManager(realScene);
events.emit('boot');
events.emit('start');
let countdown = 3;
let landed = false;
let attacks = 0;
const sprite = { y: -100 };
const countDown = () => {
  countdown -= 1;
  if (countdown > 0) realScene.time.delayedCall(1000, countDown);
  else realScene.tweens.add({ targets: sprite, y: 0, duration: 400, onComplete() {
    landed = true;
    realScene.time.addEvent({ delay: 1000, loop: true, callback: () => attacks += 1 });
  } });
};

// The delay is in milliseconds. Phaser calls the supplied function later on this scene's
// clock, so pause and cleanup affect when it can run.
realScene.time.delayedCall(1000, countDown);
const realGame = { loop: { time: 0 }, events: new EventEmitter(), scene: {
  scenes: [realScene], update(time, delta) {
    events.emit('preupdate', time, delta);
    events.emit('update', time, delta);
    events.emit('postupdate', time, delta);
  }
} };

const realProgress = new BackgroundProgress(realGame, {

  // We handle now here, keeping this operation in one place for its callers.
  now: () => wallTime, budgetNow: () => 0, document: surface, window: surface
});
realProgress.setHidden(true);
wallTime += 20000;

realProgress.pump();
assert.equal(countdown, 0);
assert.equal(landed, true);
assert.equal(sprite.y, 0);
assert.ok(attacks >= 15 && attacks <= 17);
assert.ok(realScene.tweens.getDelta(false) < 250);
realScene.time.paused = true;

const pausedAttacks = attacks;
wallTime += 10000;
realProgress.pump();
assert.equal(attacks, pausedAttacks);
realProgress.destroy();
events.emit('shutdown');
console.log('Real Phaser countdowns, landing tweens, chained callbacks and paused actions passed.');
