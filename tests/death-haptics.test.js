// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

let pulses = 0;
const context = vm.createContext({ HapticsService: { heavy() { pulses += 1; } } });
vm.runInContext(fs.readFileSync(new URL('../combat/BattleUnit.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default class BattleUnit', 'globalThis.Unit = class BattleUnit'), context);
const visual = { setVisible() {}, disableInteractive() {} };

// We handle unit here, keeping this operation in one place for its callers.
function unit(options = {}) {

  // Object.assign writes these fields into its first argument. Later sources replace
  // earlier fields; nested values are not deep-copied. ... copies the source's own fields
  // into this object; fields listed later replace earlier ones. This is a shallow copy, so
  // nested objects are still shared.
  return Object.assign(Object.create(context.Unit.prototype), {
    alive: true, hp: 100, isEnemy: false, scene: { game: {} },

    // Clear the current action and its visible cast bar.
    finishAction() {}, updateHealthBar() {}, setStealthed() {},
    body: { setFillStyle() {} }, container: { setAlpha() {} }, hitZone: visual,
    ...options
  });
}

const ally = unit();
ally.defeat();
assert.equal(pulses, 1, 'party death pulses');
ally.defeat();
assert.equal(pulses, 1, 'repeated defeat does not pulse');
ally.alive = true;
ally.defeat();

assert.equal(pulses, 2, 'a new death after revival pulses again');
unit({ isEnemy: true }).defeat();
unit({ alive: false }).defeat();
unit({ scene: { restoringBattle: true } }).defeat();
unit({ scene: { game: { backgroundProgress: { isReplaying: true } } } }).defeat();
assert.equal(pulses, 2, 'enemy, restored and replayed deaths stay silent');

let impacts = 0;
const serviceContext = vm.createContext({
  Haptics: { impact() { impacts += 1; } }, ImpactStyle: { Heavy: 'heavy' }
});
vm.runInContext(fs.readFileSync(new URL('../services/HapticsService.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default HapticsService;', 'globalThis.Service = HapticsService;'), serviceContext);
await serviceContext.Service.heavy();

serviceContext.Service.background = true;
await serviceContext.Service.heavy();
assert.equal(impacts, 1, 'background deaths suppress device feedback');
console.log('Party death haptics: repeat defeat, revival, enemies, restore, replay and background checks passed.');
