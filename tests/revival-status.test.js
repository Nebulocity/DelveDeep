// Exercise real revival, saved-unit restoration and combat ticking without Phaser views.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ReplacementAbilitySystem from '../combat/ReplacementAbilitySystem.js';
import { packBattleValue, unpackBattleValue } from '../game/BattleSnapshot.js';
import { replacementMultiplier } from '../combat/ReplacementEffects.js';

// Use the same headless source loading as the other BattleUnit checks. Only display
// methods are stubbed; revival and persistence execute the production implementations.
const context = vm.createContext({ unpackBattleValue, replacementMultiplier });
const source = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '');
vm.runInContext(source('../combat/BattleUnit.js')
  .replace('export default class BattleUnit', 'globalThis.Unit = class BattleUnit'), context);
vm.runInContext(source('../combat/BattlePersistence.js').replace(/^export /gm, '')
  + '\nglobalThis.restoreUnit = restoreUnit;', context);

const listKeys = ['replacementEffects', 'replacementPreparations', 'replacementPeriodic',
  'replacementReactions', 'replacementZones'];
const scene = { time: { now: 1000 }, partyUnits: [], enemies: [], currentWaveIndex: 0 };
const unit = Object.assign(Object.create(context.Unit.prototype), {
  id: 'hero', alive: false, isEnemy: false, maxHp: 1000, hp: 0, maxMana: 100, mana: 0,
  scene, status: { stunnedUntil: 9000, replacementChannel: { until: 9000 },
    replacementCooldownFactors: { primary: .75 }, huntersMarkVisual: true },
  abilities: {}, lastAbilityAt: { primary: 500 }, delvesUsed: { recovery: true },
  replacementPotion: null, lastAttackAt: 500, busyUntil: 0, pendingAction: null,
  body: { setFillStyle() {}, setPosition() {} }, container: { setAlpha() {} },
  hitZone: { setInteractive() {} }, finishAction() {}, setStealthed() {},
  updateHealthBar() {}, syncPresentation() {}, setTargetName() {}
});
for (const key of listKeys) unit.status[key] = [{ until: 9000 }];
scene.partyUnits = [unit];

assert.equal(unit.revive(), true);
assert.equal(unit.hp, 500);
assert.equal(unit.mana, 50);
assert.equal(unit.status.stunnedUntil, 0);
assert.equal(unit.status.replacementChannel, null);
assert.equal(unit.status.huntersMarkVisual, false);
assert.equal(unit.lastAbilityAt.primary, 500);
assert.equal(unit.delvesUsed.recovery, true);
for (const key of listKeys) assert.equal(Array.isArray(unit.status[key]) && unit.status[key].length === 0, true);
assert.equal(unit.canStartAction(1000), true);
const system = new ReplacementAbilitySystem({ scene });
system.tick(1000);

// A previously saved revival has zeros for all collections. JSON round-tripping models
// local storage and verifies that restoration repairs it before the first combat tick.
const saved = { id: unit.id, alive: true, hp: 500, mana: 50, status: {
  ...Object.fromEntries(listKeys.map(key => [key, 0])), replacementCooldownFactors: 0
} };
context.restoreUnit(unit, JSON.parse(JSON.stringify(packBattleValue(saved))));
for (const key of listKeys) assert.equal(Array.isArray(unit.status[key]), true);
unit.status.replacementCooldownFactors.primary = .8;
assert.equal(unit.status.replacementCooldownFactors.primary, .8);
system.tick(1000);

// Real active records must retain their potency, ownership and combat-clock deadline.
saved.status.replacementEffects = [{ key: 'saved:beneficial', ownerId: 'hero', until: 4000,
  changes: { attack: .25 }, removable: true }];
context.restoreUnit(unit, JSON.parse(JSON.stringify(packBattleValue(saved))));
system.tick(1000);
assert.equal(replacementMultiplier(unit, 'attack', 1000), 1.25);
assert.equal(unit.status.replacementEffects[0].until, 4000);
system.tick(4000);
assert.equal(unit.status.replacementEffects.length, 0);
console.log('Revival status types, legacy saved revival repair and resumed effect expiry passed.');
