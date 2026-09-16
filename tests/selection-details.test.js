import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import vm from 'node:vm';

const timers = new Map();
let nextId = 0;
const context = vm.createContext({
  HapticsService: { tap() {} },
  setTimeout(callback) { timers.set(++nextId, callback); return nextId; },
  clearTimeout(id) { timers.delete(id); }
});
vm.runInContext(fs.readFileSync(new URL('../ui/SelectionDetails.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/export /g, ''), context);
const scene = { input: new EventEmitter(), events: new EventEmitter() };
const card = new EventEmitter();
card.setInteractive = () => card;
let taps = 0;
let details = 0;
card.on('pointerdown', () => taps++);
context.bindSelectionDetails(scene, card, null, undefined, () => details++);
const pointer = { id: 1, x: 50, y: 50, isDown: true };
const event = { stopPropagation() {} };
const down = () => { pointer.isDown = true; card.emit('pointerdown', pointer, 0, 0, event); };
const up = () => { pointer.isDown = false; card.emit('pointerup', pointer, 0, 0, event); scene.input.emit('pointerup', pointer); };
const hold = () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); };

down();
assert.equal(taps, 0);
up();
assert.equal(taps, 1);
assert.equal(timers.size, 0);
down(); hold(); up();
assert.equal(details, 1);
assert.equal(taps, 1);
down(); pointer.x += 30; scene.input.emit('pointermove', pointer); hold(); up();
assert.equal(details, 1);
assert.equal(taps, 1);
down(); card.emit('pointerout'); hold(); up();
assert.equal(details, 1);
down(); scene.input.emit('gameout'); hold();
assert.equal(details, 1);
down(); card.emit('destroy'); hold();
assert.equal(details, 1);
assert.equal(scene.input.listenerCount('pointermove'), 0);
assert.equal(scene.events.listenerCount('shutdown'), 0);

// Closing details restores both an active battle and an already-paused one.
for (const paused of [false, true]) {
  const objects = [];
  const display = () => {
    const object = new EventEmitter();
    Object.assign(object, { height: 120, y: 0, destroy() { this.destroyed = true; } });
    for (const method of ['setDepth', 'setInteractive', 'setStrokeStyle', 'setOrigin', 'setScale']) {
      object[method] = () => object;
    }
    object.setY = (y) => { object.y = y; return object; };
    objects.push(object);
    return object;
  };
  const battle = {
    scale: { width: 2400, height: 1080 }, events: new EventEmitter(),
    add: { text: display, rectangle: display }, combatPaused: paused, time: { paused }
  };
  context.showSelectionDetails(battle, { title: 'Test', description: 'Details' });
  assert.equal(battle.combatPaused, true);
  assert.equal(battle.time.paused, true);
  battle.selectionDetailsClose();
  assert.equal(battle.combatPaused, paused);
  assert.equal(battle.time.paused, paused);
  assert.ok(objects.every(object => object.destroyed));
  assert.equal(battle.events.listenerCount('shutdown'), 0);
}
console.log('Selection gesture checks passed.');
