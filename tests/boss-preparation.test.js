// Check boss preparation against the real scene and revival methods without a renderer.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { packBattleValue, unpackBattleValue } from '../game/BattleSnapshot.js';

const context = { Phaser: { Scene: class {} }, Math };
for (const [path, name] of [['scenes/BattleScene.js', 'BattleScene'], ['combat/BattleUnit.js', 'BattleUnit']]) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
    .replace(/^import .*;\r?$/gm, '').replace(`export default class ${name}`, `class ${name}`);
  vm.runInNewContext(`${source}\nglobalThis.${name} = ${name};`, context);
}

const scene = new context.BattleScene();
scene.leaderAbilityCooldowns = new Map([['revive', 1000]]);
scene.lastPotionUseAt = new Map([['hero', 1000]]);
scene.usedLeaderAbilities = new Set(['arise']);
scene.updateHud = () => {};

// Drawing stand-ins let the real revival cleanup run, including input and death state.
function hero(alive, maxMana) {
  const unit = Object.create(context.BattleUnit.prototype);
  return Object.assign(unit, {
    scene, alive, hp: alive ? 1 : 0, maxHp: 101, mana: 0, maxMana,
    isEnemy: false, delvesUsed: { restock: 4 }, status: { stunnedUntil: 1000 },
    lastAttackAt: 1000, lastHealAt: 1000, lastAbilityAt: { primary: 1000, parry: 1000 },
    criticalKnockback: { elapsed: 0 }, seekingRestealth: true,
    body: { setFillStyle() {}, setPosition() {} }, container: { setAlpha() {} },
    hitZone: { setInteractive() {} }, finishAction() { this.pendingAction = null; },
    setStealthed(value) { this.stealthed = value; }, updateHealthBar() { this.barUpdated = true; }
  });
}

scene.partyUnits = [hero(true, 103), hero(false, 107), hero(true, 0)];
scene.restoreBossResources();
for (const unit of scene.partyUnits) {
  assert.equal(unit.alive, true);
  assert.equal(unit.hp, unit.maxHp);
  assert.equal(unit.mana, unit.maxMana);
  assert.equal(unit.lastAttackAt, -Infinity);
  assert.equal(unit.lastHealAt, -Infinity);
  assert.equal(Object.keys(unit.lastAbilityAt).length, 0);
  assert.equal(unit.barUpdated, true);
  assert.equal(unit.delvesUsed.restock, 4, 'Restocking remains spent for its wave.');
}
assert.equal(scene.partyUnits[1].status.stunnedUntil, 0, 'Revival clears disabling death state.');
assert.equal(scene.partyUnits[1].criticalKnockback, null);
assert.equal(scene.leaderAbilityCooldowns.size, 0);
assert.equal(scene.lastPotionUseAt.size, 0);
assert.equal(scene.usedLeaderAbilities.has('arise'), true, 'Once-per-encounter limits are separate from cooldowns.');

// Existing snapshot encoding already preserves ready timestamps and refreshed resources.
// No new save fields or version migration are needed for this refresh.
const unit = scene.partyUnits[0];
const ready = unpackBattleValue(JSON.parse(JSON.stringify(packBattleValue({
  hp: unit.hp, mana: unit.mana, lastAttackAt: unit.lastAttackAt, lastAbilityAt: unit.lastAbilityAt
}))));
assert.equal(ready.lastAttackAt, -Infinity);
assert.equal(ready.hp, 101);
assert.equal(ready.mana, 103);
console.log('Boss preparation restores living/fallen party resources and all cooldowns while preserving usage limits.');
