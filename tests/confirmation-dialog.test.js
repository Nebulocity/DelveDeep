import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';

const context = vm.createContext({ HapticsService: { tap() {} } });
vm.runInContext(fs.readFileSync(new URL('../ui/ConfirmationDialog.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export function', 'function'), context);
function createScene() {
  const objects = [];
  const display = (x, y, text) => {
    const object = new EventEmitter();
    Object.assign(object, { x, y, text, height: 160 });
    for (const method of ['setDepth', 'setInteractive', 'setOrigin']) object[method] = () => object;
    object.setY = (value) => { object.y = value; return object; };
    object.destroy = () => { object.emit('destroy'); object.destroyed = true; };
    objects.push(object);
    return object;
  };
  return { objects, scale: { width: 2400, height: 1080 }, input: new EventEmitter(), events: new EventEmitter(),
    add: { rectangle: display, text: display } };
}
const pointer = { id: 1, x: 100, y: 100 };
const event = { stopPropagation() {} };
const press = (button) => button.emit('pointerdown', pointer, 0, 0, event);
const release = (button) => button.emit('pointerup', pointer, 0, 0, event);
const buttonFor = (scene, label) => {
  const text = scene.objects.find((object) => object.text === label && !object.destroyed);
  return scene.objects.find((object) => object.x === text.x && object.y === text.y && object.listenerCount('pointerup') && !object.destroyed);
};
let commits = 0;
const open = (scene) => context.showConfirmation(scene, { title: 'Confirm purchase', description: 'Buy 1 weapon for 100 gold?', onConfirm: () => commits++ });

const scene = createScene();
open(scene);
let confirm = buttonFor(scene, 'CONFIRM');
release(confirm); // The release that opened a dialog must not confirm it.
assert.equal(commits, 0);
press(confirm);
scene.input.emit('pointermove', { ...pointer, x: pointer.x + 60 });
release(confirm);
assert.equal(commits, 0);
press(confirm);
confirm.emit('pointerout');
release(confirm);
assert.equal(commits, 0);
press(confirm);
scene.input.emit('gameout');
release(confirm);
assert.equal(commits, 0);
const cancel = buttonFor(scene, 'CANCEL');
press(cancel); release(cancel);
assert.equal(commits, 0);
assert.equal(scene.selectionDetailsClose, null);
assert.ok(scene.objects.every((object) => object.destroyed));
assert.equal(scene.input.listenerCount('pointermove'), 0);

open(scene);
confirm = buttonFor(scene, 'CONFIRM');
press(confirm); release(confirm);
press(confirm); release(confirm); // Even a queued callback cannot spend twice.
assert.equal(commits, 1);
assert.equal(scene.events.listenerCount('shutdown'), 0);

open(scene);
confirm = buttonFor(scene, 'CONFIRM');
press(confirm);
scene.events.emit('shutdown');
release(confirm);
assert.equal(commits, 1);
assert.equal(scene.input.listenerCount('pointerup'), 0);

open(scene);
const prior = buttonFor(scene, 'CONFIRM');
open(scene); // Replacing a modal cancels the previous transaction.
press(prior); release(prior);
assert.equal(commits, 1);
scene.selectionDetailsClose();
console.log('Confirmation cancel, fresh press, drag, duplicate, shutdown, and cleanup checks passed.');
