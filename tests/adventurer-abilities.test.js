import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import GameState from '../game/GameState.js';
import adventurers from '../data/adventurers.js';
import { loadProfile, saveProfile } from '../game/GameStorage.js';
import { battleAbilities, purchaseAdventurerAbility, toggleAdventurerAbility } from '../game/AdventurerAbilities.js';
import { abilityEntries, abilityGoldCost, abilityLevelRequired, MAX_ABILITY_RANK, MAX_EQUIPPED_ABILITIES } from '../game/AdventurerAbilities.js';
import { equippedItem, getEquippedAdventurer, ownedEquipment, equipmentOwner, equipItem, unequipItem } from '../game/Equipment.js';
import { EQUIPMENT_BY_ID, ITEM_RARITIES, equipmentDetails, equipmentStatsText } from '../data/items.js';
import { happinessLabel, xpRequired } from '../game/AdventurerProgression.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value)
};

loadProfile(adventurers);
const caramon = GameState.roster.find((hero) => hero.id === 'caramon-gladiator');
assert.deepEqual(caramon.abilityLoadout, ['roar', 'net']);
assert.deepEqual(Object.keys(battleAbilities(caramon)), ['roar', 'net']);
assert.equal(purchaseAdventurerAbility(caramon.id, 'cleave').ok, false);
caramon.level = 3;
GameState.gold = 500;
assert.equal(purchaseAdventurerAbility(caramon.id, 'cleave').ok, true);
assert.equal(caramon.abilityLoadout.includes('cleave'), true);
assert.equal(purchaseAdventurerAbility(caramon.id, 'net').ok, true);
assert.equal(battleAbilities(caramon).net.power, 14);
assert.equal(battleAbilities(caramon).net.cooldown, 13500);
assert.equal(toggleAdventurerAbility(caramon.id, 'net').ok, true);
assert.equal(battleAbilities(caramon).net, undefined);
assert.equal(toggleAdventurerAbility(caramon.id, 'net').ok, true);
saveProfile();
loadProfile(adventurers);
const restored = GameState.roster.find((hero) => hero.id === caramon.id);
assert.equal(restored.abilityRanks.net, 2);
assert.equal(restored.abilityLoadout.includes('net'), true);

storage.clear();
storage.set('delveDeep.profile.v2', JSON.stringify({ roster: [{ id: caramon.id, level: 3 }] }));
loadProfile(adventurers);
const legacy = GameState.roster.find((hero) => hero.id === caramon.id);
assert.deepEqual(Object.keys(legacy.abilityRanks), ['roar', 'net', 'cleave', 'sand']);
assert.deepEqual(Object.keys(battleAbilities(legacy)), ['roar', 'net', 'cleave', 'sand']);

class Scene {
  constructor() {
    this.scale = { width: 2400, height: 1080 };
    this.cameras = { main: { setBackgroundColor() {} } };
    this.objects = [];
    this.children = { list: this.objects, removeAll: () => { this.objects = []; this.children.list = this.objects; } };
    this.scene = { start: (key) => { this.destination = key; } };
    this.input = { on() {} };
    this.events = { once() {}, off() {} };
    this.make = { graphics: () => ({ fillRect() {}, createGeometryMask: () => ({}), destroy() {} }) };
    this.add = {};
    for (const type of ['rectangle', 'circle', 'text', 'container']) {
      this.add[type] = (x, y, value, style) => {
        const object = { type, x, y, value, style, handlers: {} };
        for (const method of ['setStrokeStyle', 'setOrigin', 'setInteractive', 'setDepth', 'setMask']) object[method] = () => object;
        object.destroy = () => {};
        object.on = (event, handler) => { object.handlers[event] = handler; return object; };
        this.objects.push(object);
        return object;
      };
    }
  }
}
const source = fs.readFileSync(new URL('../scenes/RosterScene.js', import.meta.url), 'utf8')
  .replace(/^import [\s\S]*?;\r?\n/gm, '')
  .replace('export default class RosterScene', 'globalThis.RosterScene = class RosterScene');
const context = vm.createContext({
  Phaser: { Scene, Math: { Clamp: (value, min, max) => Math.max(min, Math.min(max, value)) } }, GameState,
  equippedItem, getEquippedAdventurer, ownedEquipment, equipmentOwner, equipItem, unequipItem,
  EQUIPMENT_BY_ID, ITEM_RARITIES, equipmentDetails, equipmentStatsText,
  abilityEntries, abilityGoldCost, abilityLevelRequired, MAX_ABILITY_RANK, MAX_EQUIPPED_ABILITIES,
  purchaseAdventurerAbility, toggleAdventurerAbility, happinessLabel, xpRequired,
  saveProfile, bindSelectionDetails() {}, showConfirmation() {}, addHallBackground() {},
  HapticsService: { tap() {}, confirm() {} }, UI_SAFE_TOP: 132
});
vm.runInContext(source, context);
const rosterScene = new context.RosterScene();
rosterScene.create();
assert.ok(rosterScene.objects.some((object) => object.type === 'text' && object.value === 'Caramon'));
assert.ok(rosterScene.objects.some((object) => object.type === 'text' && object.value === 'TRAIN'));
assert.equal(rosterScene.objects.some((object) => object.type === 'text' && object.value === 'RANK UP'), false);
assert.equal(rosterScene.objects.find((object) => object.type === 'rectangle' && object.x === 2270 && object.y === 462)?.handlers.pointerdown, undefined);
assert.equal(rosterScene.objects.find((object) => object.type === 'text' && object.value === 'R1/3 EQUIPPED')?.style.wordWrap.width, 415);
assert.equal(rosterScene.objects.find((object) => object.type === 'text' && object.value === '•  TRAINING COMING SOON')?.style.wordWrap.width, 750);
assert.ok(rosterScene.abilityList);
rosterScene.objects.find((object) => object.type === 'rectangle' && object.x === 315 && object.y === 644).handlers.pointerdown();
assert.equal(rosterScene.heroId, 'laurana');
rosterScene.objects.find((object) => object.type === 'rectangle' && object.x === 440 && object.y === 345).handlers.pointerdown();
assert.ok(rosterScene.objects.some((object) => object.type === 'text' && object.value === 'Goldmoon'));
rosterScene.objects.find((object) => object.type === 'rectangle' && object.x === 190 && object.y === 345).handlers.pointerdown();
assert.equal(rosterScene.heroId, 'caramon-gladiator');
rosterScene.objects.find((object) => object.type === 'rectangle' && object.x === 315 && object.y === 644).handlers.pointerdown();
rosterScene.create();
assert.equal(rosterScene.heroId, 'caramon-gladiator');

console.log('Adventurer ability unlocks, ranks, loadout, combat values, and legacy saves passed.');
