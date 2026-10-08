// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createEncounterWaves, encounterEnemyCounts } from '../data/encounters.js';
import enemies, { forgottenCavernWaves, voidPortalWaves } from '../data/enemies.js';

// ... expands these entries into the new list or call. It does not deep-copy the objects
// inside.
for (const wave of [...forgottenCavernWaves, ...voidPortalWaves]) assert.equal(Object.hasOwn(wave, 'name'), false);

// map builds one output entry for each input entry, in the same order. The callback's
// return value becomes that output entry.
for (const delve of [
  { id: 'slime-cave', difficulty: 'Easy' },
  { id: 'thornbriar-hollow', difficulty: 'Easy' },
  { id: 'dolmark-den', difficulty: 'Easy' },
  { id: 'verdant-tear', type: 'void' },

  { id: 'void-portal', type: 'void', depth: 5 },
  ...Object.keys(encounterEnemyCounts).map(difficulty => ({ id: 'fallback', difficulty }))
]) {
  for (const wave of createEncounterWaves(delve, 1750)) {
    assert.equal(Object.hasOwn(wave, 'name'), false, `${delve.id}: waves have no names`);

    // every requires all entries to pass the check; an empty list gives true.
    assert.ok(wave.enemies.every(spawn => enemies[spawn.type]?.name), 'Monsters retain their own names');
    if (!wave.boss) assert.equal(wave.enemies.length, encounterEnemyCounts[delve.type === 'void' ? 'Unknown' : delve.difficulty]);
  }
}

const context = vm.createContext({ Phaser: { Scene: class {} }, GameState: {} });
vm.runInContext(fs.readFileSync(new URL('../scenes/BattleScene.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default class BattleScene', 'globalThis.Battle = class BattleScene'), context);

// Object.assign writes these fields into its first argument. Later sources replace earlier
// fields; nested values are not deep-copied.
const scene = Object.assign(Object.create(context.Battle.prototype), {
  waves: [{}, { boss: true }], time: { delayedCall() {} },

  // Match the visible cancel label to farm mode and the pending stop request.
  refreshFarmControls() {}, updateEncounterStatus() {}, updateWaveCountdown() {},

  // We build or display wave announcement using the current inputs. The objects and values
  // made below are the pieces this part of the screen needs.
  showWaveAnnouncement(title, boss) { this.announcement = { title, boss }; }
});

scene.startWave(0);
assert.equal(scene.announcement.title, 'WAVE 1');
assert.equal(scene.announcement.boss, false);
scene.startWave(1);
assert.equal(scene.announcement.title, 'WAVE 2');
assert.equal(scene.announcement.boss, true);
console.log('All encounter waves have numbers only; monster names and boss announcements remain.');
