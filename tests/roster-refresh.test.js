// A transaction should replace character details while preserving the costly room
// and roster. Small scene doubles check ownership and cleanup without a renderer.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const hero = { id: 'hero' };
let saves = 0, confirmations = 0;
const context = vm.createContext({
  Phaser: { Scene: class {} }, GameState: { roster: [hero], gold: 250 }, HALL: { muted: '#d2b895' },
  saveProfile: () => saves++, HapticsService: { confirm: () => confirmations++ }
});
const source = readFileSync('scenes/RosterScene.js', 'utf8').replace(/^import .*;\r?\n/gm, '')
  .replace('export default class RosterScene', 'globalThis.RosterScene = class RosterScene');
vm.runInContext(source, context);
const scene = new context.RosterScene();
scene.heroId = hero.id;
scene.tab = 'skills';
scene.message = '';
scene.children = { list: [], getByName(name) { return this.list.find(object => object.name === name); } };
const add = name => {
  const object = {
    name, active: true, text: '', color: '',
    setText(value) { this.text = value; return this; },
    setColor(value) { this.color = value; return this; },
    destroy() { this.active = false; scene.children.list.splice(scene.children.list.indexOf(this), 1); }
  };
  scene.children.list.push(object);
  return object;
};
const roster = add('roster'), gold = add('hall-gold'), feedback = add('hall-feedback');
scene.renderSummary = () => add('summary');
scene.renderSkills = () => add('skills');
scene.renderGear = () => add('gear');
scene.render = () => assert.fail('transactions must not rebuild the whole screen');
scene.refreshDetails();
const oldDetails = [...scene.detailObjects];

// Closing a popup can remove scene children too. They must not become retained
// detail objects or survive the next transaction.
const modal = add('modal');
scene.selectionDetailsClose = () => { modal.destroy(); scene.selectionDetailsClose = null; };
scene.commit({ ok: true, message: 'Trained' });
assert.equal(roster.active, true);
assert.equal(gold.text, '250 GOLD');
assert.equal(feedback.text, 'Trained');
assert.equal(feedback.color, '#ffe0a7');
assert.equal(modal.active, false);
assert.ok(oldDetails.every(object => !object.active));
assert.deepEqual(scene.children.list.map(object => object.name), ['roster', 'hall-gold', 'hall-feedback', 'summary', 'skills']);
assert.equal(saves, 1);
assert.equal(confirmations, 1);

// Failed actions still show feedback, but cannot save or confirm a purchase.
scene.tab = 'gear';
scene.commit({ ok: false, message: 'Not enough Gold' });
assert.equal(feedback.text, 'Not enough Gold');
assert.equal(scene.children.list.at(-1).name, 'gear');
assert.equal(saves, 1);
assert.equal(confirmations, 1);
