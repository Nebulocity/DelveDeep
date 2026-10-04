import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import GameState from '../game/GameState.js';
import adventurers from '../data/adventurers.js';
import { loadProfile, saveProfile } from '../game/GameStorage.js';
import { battleAbilities, purchaseAdventurerAbility, toggleAdventurerAbility } from '../game/AdventurerAbilities.js';
import { abilityEntries, abilityGoldCost, abilityLevelRequired, abilityLearningAvailable, sortedAbilityEntries, MAX_ABILITY_RANK, MAX_EQUIPPED_ABILITIES } from '../game/AdventurerAbilities.js';
import { equippedItem, getEquippedAdventurer, ownedEquipment, equipmentOwner, equipItem, unequipItem, equipmentStatsText } from '../game/Equipment.js';
import { happinessLabel, xpRequired } from '../game/AdventurerProgression.js';
import { ABILITY_BORDER_FRAGMENT } from '../ui/AbilityBorderShader.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value)
};

loadProfile(adventurers);
const caramon = GameState.roster.find((hero) => hero.id === 'caramon-gladiator');
assert.deepEqual(caramon.abilityLoadout, ['roar', 'cleave', 'secondWind']);
assert.deepEqual(Object.keys(battleAbilities(caramon)), ['roar', 'cleave', 'secondWind']);
assert.equal(caramon.skillPoints, 1);
assert.equal(purchaseAdventurerAbility(caramon.id, 'cleave').ok, false);
caramon.level = 5;
caramon.skillPoints = 5;
GameState.gold = 500;
assert.equal(purchaseAdventurerAbility(caramon.id, 'cleave').ok, true);
assert.equal(caramon.abilityLoadout.includes('cleave'), true);
assert.equal(purchaseAdventurerAbility(caramon.id, 'net').ok, true);
assert.equal(battleAbilities(caramon).cleave.power, 29);
assert.equal(battleAbilities(caramon).cleave.cooldown, 10000);
assert.equal(caramon.skillPoints, 2);
assert.equal(toggleAdventurerAbility(caramon.id, 'net').ok, true);
assert.equal(battleAbilities(caramon).net, undefined);
assert.equal(toggleAdventurerAbility(caramon.id, 'net').ok, true);
saveProfile();
loadProfile(adventurers);
const restored = GameState.roster.find((hero) => hero.id === caramon.id);
assert.equal(restored.abilityRanks.cleave, 2);
assert.equal(restored.abilityLoadout.includes('net'), true);
assert.equal(restored.skillPoints, 2);

storage.clear();
storage.set('delveDeep.profile.v2', JSON.stringify({ roster: [{ id: caramon.id, level: 3 }] }));
loadProfile(adventurers);
const legacy = GameState.roster.find((hero) => hero.id === caramon.id);
assert.deepEqual(Object.keys(legacy.abilityRanks), ['roar', 'net', 'cleave', 'sand', 'secondWind']);
assert.deepEqual(Object.keys(battleAbilities(legacy)), ['roar', 'net', 'cleave', 'sand']);

class Scene {
  constructor() {
    this.scale = { width: 2400, height: 1080 };
    this.cameras = { main: { setBackgroundColor() {} } };
    this.objects = [];
    this.children = { list: this.objects, removeAll: () => { this.objects = []; this.children.list = this.objects; } };
    this.scene = { start: (key) => { this.destination = key; } };
    this.input = { handlers: {}, on(event, handler) { this.handlers[event] = handler; } };
    this.events = { once() {}, off() {} };
    this.sys = { renderer: { type: 1, gl: {} } };
    this.textures = { keys: new Set(), exists(key) { return this.keys.has(key); } };
    this.make = { graphics: () => {
      const graphics = { fillRect() {}, createGeometryMask: () => ({}), destroy() {} };
      for (const method of ['fillStyle', 'fillCircle', 'lineStyle', 'beginPath', 'moveTo', 'lineTo', 'strokePath']) {
        graphics[method] = () => graphics;
      }
      graphics.generateTexture = (key) => { this.textures.keys.add(key); };
      return graphics;
    } };
    this.add = {};
    for (const type of ['rectangle', 'circle', 'text', 'container', 'graphics']) {
      this.add[type] = (x, y, value, style) => {
        const object = { type, x, y, value, style, handlers: {} };
        for (const method of ['setOrigin', 'setInteractive', 'setDepth', 'setMask']) object[method] = () => object;
        if (type === 'graphics') {
          object.commands = [];
          object.clear = () => { object.commands = []; return object; };
          for (const method of ['lineStyle', 'beginPath', 'moveTo', 'lineTo', 'strokePath', 'fillStyle', 'fillCircle']) {
            object[method] = (...args) => { object.commands.push([method, ...args]); return object; };
          }
        }
        object.setStrokeStyle = (width, color, alpha = 1) => { object.stroke = { width, color, alpha }; return object; };
        object.destroy = () => {};
        object.on = (event, handler) => { object.handlers[event] = handler; return object; };
        this.objects.push(object);
        return object;
      };
    }
    this.add.shader = (shader, x, y, width, height) => {
      const object = {
        type: 'shader', shader, x, y, width, height, visible: true,
        setVisible(value) { this.visible = value; return this; }, destroy() {}
      };
      this.objects.push(object);
      return object;
    };
  }
}
const source = fs.readFileSync(new URL('../scenes/RosterScene.js', import.meta.url), 'utf8')
  .replace(/^import [\s\S]*?;\r?\n/gm, '')
  .replace('export default class RosterScene', 'globalThis.RosterScene = class RosterScene');
const context = vm.createContext({
  Phaser: { Scene, WEBGL: 1, Display: { BaseShader: class BaseShader {
    constructor(key, fragmentSrc) { this.key = key; this.fragmentSrc = fragmentSrc; }
  } }, Math: { Clamp: (value, min, max) => Math.max(min, Math.min(max, value)) } }, GameState,
  equippedItem, getEquippedAdventurer, ownedEquipment, equipmentOwner, equipItem, unequipItem,
  equipmentStatsText,
  abilityEntries, abilityGoldCost, abilityLevelRequired, abilityLearningAvailable, sortedAbilityEntries, MAX_ABILITY_RANK, MAX_EQUIPPED_ABILITIES,
  purchaseAdventurerAbility, toggleAdventurerAbility, happinessLabel, xpRequired,
  saveProfile, bindSelectionDetails() {}, showConfirmation() {}, addHallBackground() {}, addReturnButton() {},
  HapticsService: { tap() {}, confirm() {} }, UI_SAFE_TOP: 132, ABILITY_BORDER_FRAGMENT
});
vm.runInContext(source, context);
const rosterScene = new context.RosterScene();
rosterScene.create();
assert.ok(rosterScene.objects.some((object) => object.type === 'text' && object.value === 'Caramon'));
assert.ok(rosterScene.objects.some((object) => object.type === 'text' && object.value === 'TRAIN'));
assert.equal(rosterScene.objects.some((object) => object.type === 'text' && object.value === 'RANK UP'), false);
assert.equal(rosterScene.objects.find((object) => object.type === 'rectangle' && object.x === 2270 && object.y === 462)?.handlers.pointerdown, undefined);
assert.equal(rosterScene.objects.find((object) => object.type === 'text' && object.value === 'R1/10 EQUIPPED')?.style.wordWrap.width, 415);
assert.ok(rosterScene.objects.some((object) => object.type === 'text' && String(object.value).includes('SKILL POINTS')));
assert.ok(rosterScene.objects.some((object) => object.type === 'text' && String(object.value).includes('SCROLL DOWN FOR GOLD OUTLINES')));
assert.ok(rosterScene.objects.some((object) => object.type === 'rectangle' && object.stroke?.color === 0xffd24f && object.stroke.width === 2));
assert.ok(rosterScene.abilityBorderEffects.length > 0);
const border = rosterScene.abilityBorderEffects[0];
assert.equal(border.shader.shader.fragmentSrc, ABILITY_BORDER_FRAGMENT);
assert.equal(rosterScene.objects.some((object) => object.type === 'particles'), false);
const hiddenBorder = rosterScene.abilityBorderEffects.find((effect) => !effect.shader.visible);
assert.ok(hiddenBorder);
rosterScene.scrollAbilities(hiddenBorder.y - 480);
assert.equal(hiddenBorder.shader.visible, true);
const initialAlpha = border.row.stroke.alpha;
rosterScene.update(100, 100);
assert.notEqual(border.row.stroke.alpha, initialAlpha);
assert.ok(rosterScene.abilityList);
assert.ok(rosterScene.abilityScrollbarThumb);
assert.ok(rosterScene.abilityScrollbarThumbHeight >= 100);
rosterScene.scrollAbilities(-rosterScene.abilityScroll);
const initialThumbY = rosterScene.abilityScrollbarThumb.y;
rosterScene.input.handlers.wheel({ x: 1945, y: 700 }, [], 0, 132);
assert.equal(rosterScene.abilityScroll, 132);
assert.ok(rosterScene.abilityScrollbarThumb.y > initialThumbY);
rosterScene.input.handlers.pointerdown({ x: 2358, y: rosterScene.abilityScrollbarThumb.y, isDown: true });
rosterScene.input.handlers.pointermove({ x: 2358, y: 1200, isDown: true });
assert.equal(rosterScene.abilityScroll, rosterScene.abilityScrollMax);
rosterScene.input.handlers.pointerup();
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
