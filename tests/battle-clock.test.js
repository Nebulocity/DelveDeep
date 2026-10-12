// Use Phaser's real clock methods to check timer callbacks and saved status deadlines
// together. The fixture supplies only the scene event emitter that the plugin needs.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { installBattleClock } from '../combat/BattleClock.js';

const require = createRequire(import.meta.url);
const Clock = require('phaser/src/time/Clock.js');
const EventEmitter = require('eventemitter3');
const events = new EventEmitter();
const scene = { sys: { events, game: { loop: { time: 1000 } } } };
const clock = scene.time = new Clock(scene);
events.emit('boot');
events.emit('start');
installBattleClock(scene);
installBattleClock(scene);
assert.equal(events.listenerCount('update'), 1);
let resolvedAt = null;
clock.delayedCall(500, () => { resolvedAt = clock.now; });
clock.preUpdate();
events.emit('update', 1100, 100);
assert.equal(clock.now, 1100);
clock.paused = true;
events.emit('update', 101100, 100000);
assert.equal(clock.now, 1100);
assert.equal(resolvedAt, null);
clock.paused = false;
events.emit('update', 101500, 400);
assert.equal(resolvedAt, 1500);

// A restored timestamp is a continuation point, independent of fresh browser uptime.
clock.now = 40000;
events.emit('update', 200, 20);
assert.equal(clock.now, 40020);
events.emit('shutdown');
assert.equal(events.listenerCount('update'), 0);
events.emit('start');
installBattleClock(scene);
assert.equal(events.listenerCount('update'), 1);
events.emit('update', 300, 20);
assert.equal(clock.now, 40040);
console.log('Battle clock: paused callbacks, effect deadlines, saved time and scene restart passed.');
