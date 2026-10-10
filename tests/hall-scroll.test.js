// Exercise the shared scroll gestures without loading Phaser's browser renderer.

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('ui/HallUI.js', 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf('export function hallScroll')).replace('export function', 'function'), context);
const container = Object.assign(new EventEmitter(), { setMask() {}, y: 0 });
const scene = {
  add: { container: () => container },
  make: { graphics: () => ({ fillRect() { return this; }, createGeometryMask: () => ({ destroy() {} }), destroy() {} }) },
  input: new EventEmitter(), events: new EventEmitter(), game: { events: new EventEmitter() }
};
const surface = () => ({ setVisible() {}, destroy() {} });
const list = context.hallScroll(scene, { x: 0, y: 0, width: 500, height: 500 }, [], 2000, 0, () => {}, surface);
const pointer = { id: 0, downTime: 100, isDown: true, downX: 200, downY: 400, x: 200, y: 200 };
scene.input.emit('pointermove', pointer);
assert.equal(container.y, -200, 'the first drag scrolls by its distance');

// Omit the scene release, as a shop button does when it consumes pointerup. The
// next press above the old endpoint includes normal tiny finger movement.
Object.assign(pointer, { downTime: 200, downY: 100, y: 102 });
scene.input.emit('pointermove', pointer);
assert.equal(container.y, -200, 'a new tap does not inherit the previous drag');
pointer.y = 50;
scene.input.emit('pointermove', pointer);
assert.equal(container.y, -250, 'a new drag uses its own starting point and offset');

// Another finger also starts its own gesture, even with an identical timestamp.
Object.assign(pointer, { id: 1, downY: 300, y: 302 });
scene.input.emit('pointermove', pointer);
assert.equal(container.y, -250);
scene.input.emit('pointerup', pointer);
scene.input.emit('wheel', { x: 200, y: 200 }, [], 0, 100);
assert.equal(container.y, -350, 'wheel input still works');
list.set(9999);
assert.equal(container.y, -1500, 'scrolling stays within the list');
container.emit('destroy');
assert.equal(scene.input.listenerCount('pointermove'), 0, 'destroy removes gesture listeners');
