// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as typography from '../config/uiTypography.js';
import GameState from '../game/GameState.js';
import { grantAdventurerLevels } from '../game/AdventurerProgression.js';
import adventurers from '../data/adventurers.js';
import { loadProfile, saveProfile } from '../game/GameStorage.js';

// A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
// object; get/set read and write that same key.
const storage = new Map();
globalThis.localStorage = {

  // We work out item here so callers can use the result. Keep the calculation together
  // with the checks below that decide which inputs are usable.
  getItem: (key) => storage.get(key) ?? null,

  // We bring item up to date here. The assignments below are the new values other code
  // will read after this step.
  setItem: (key, value) => storage.set(key, value)
};

loadProfile(adventurers);
assert.equal(GameState.development.showArenaBorder, false);
GameState.development.showArenaBorder = true;

class Scene {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods.
  constructor() {
    this.scale = { width: 2400, height: 1080 };
    this.objects = [];
    this.scene = { restart: () => { this.restarted = true; } };
    this.add = {};
    this.textures = { exists: () => true };

    for (const type of ['rectangle', 'text', 'image']) {
      this.add[type] = (x, y, value, height, color) => {
        const object = { type, x, y, value, color, width: value, height, handlers: {} };
        for (const method of ['setInteractive', 'setStrokeStyle', 'setDepth', 'setOrigin', 'setScrollFactor', 'setName', 'setDisplaySize', 'setTexture', 'setAlpha']) {
          object[method] = () => object;
        }
        object.setFillStyle = (color) => {
          object.color = color;
          return object;
        };
        object.setColor = (color) => {
          object.textColor = color;
          return object;
        };
        object.on = (event, handler) => {
          object.handlers[event] = handler;
          return object;
        };

        object.once = object.on;
        object.setText = (value) => {
          object.value = value;
          return object;
        };
        object.destroy = () => { object.destroyed = true; };
        this.objects.push(object);

        return object;
      };
    }
  }
}

const source = fs.readFileSync(new URL('../scenes/TitleScene.js', import.meta.url), 'utf8')
  .replace(/^import [\s\S]*?;\r?\n/gm, '')
  .replace('export default class TitleScene', 'globalThis.TitleScene = class TitleScene');
const context = vm.createContext({ ...typography,
  Phaser: { Scene }, GameState,
  HapticsService: { tap() {}, confirm() {} },
  saveProfile, grantAdventurerLevels, grantLeaderLevels(leader, amount) {
    leader.level += amount;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    return { tacticsPointsEarned: amount === 5 ? 1 : 0 };
  }
});

vm.runInContext(fs.readFileSync(new URL('../ui/RegionMapTheme.js', import.meta.url), 'utf8').replace(/^import [\s\S]*?;\r?\n/gm, '').replaceAll('export function ', 'function '), context);
vm.runInContext(source, context);
const scene = new context.TitleScene();
scene.currencyText = { setText(value) { this.value = value; } };
scene.showToast = (message) => { scene.lastToast = message; };
GameState.leader = { level: 1, tacticsPoints: 0 };
scene.showDevelopmentTools();

// We work out button here so callers can use the result. Keep the calculation together
// with the checks below that decide which inputs are usable.
function getButton(label, y) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const caption = scene.objects.find((object) => object.type === 'text' && object.value === label && object.y === y);
  assert.ok(caption, `Missing ${label} at ${y}`);
  const button = scene.objects.find((object) => object.type === 'rectangle'
    && object.x === caption.x && object.y === caption.y && object.handlers.pointerdown);
  assert.ok(button);

  return button;
}

// We handle tap here, keeping this operation in one place for its callers.
function tap(label, y) {
  const button = getButton(label, y);
  button.handlers.pointerdown();
}

const panelTop = (1080 - 850) / 2;
const row = (index) => panelTop + 180 + index * 84;
const primaryButtons = [
  getButton('OFF', row(0)), getButton('+1', row(1)), getButton('+100', row(3)),
  getButton('ON', row(4)), getButton('RESET', row(6))
];
const secondaryButtons = [getButton('+5', row(1)), getButton('+500', row(3))];
const closeButton = getButton('CLOSE', panelTop + 850 - 52);

// every requires all entries to pass the check; an empty list gives true.
assert.ok(primaryButtons.every((button) => button.x === primaryButtons[0].x));
assert.ok(secondaryButtons.every((button) => button.x > primaryButtons[0].x + primaryButtons[0].value));

// ... expands these entries into the new list or call. It does not deep-copy the objects
// inside.
assert.ok([...primaryButtons, ...secondaryButtons, closeButton].every((button) => button.value === 220));
assert.equal(closeButton.x, scene.scale.width / 2);
assert.equal(getButton('OFF', row(0)).regionMapState, 'normal');
assert.equal(getButton('+1', row(1)).regionMapState, 'normal');
assert.equal(getButton('+100', row(3)).regionMapState, 'normal');
assert.equal(getButton('ON', row(4)).regionMapState, 'selected');
tap('+1', row(1));

tap('+5', row(1));
assert.equal(GameState.leader.level, 7);
assert.match(scene.lastToast, /^Renown Level 7/);
const heroBefore = { ...GameState.roster[0] };
tap('+1', row(2));
tap('+5', row(2));
assert.equal(GameState.roster[0].level, heroBefore.level + 6);

assert.equal(GameState.roster[0].maxHp, heroBefore.maxHp + 66);
assert.equal(GameState.roster[0].attackPower, heroBefore.attackPower + 12);
assert.equal(GameState.roster[0].xp, heroBefore.xp);
assert.equal(GameState.roster[0].skillPoints, heroBefore.skillPoints + 6);

tap('+100', row(3));
tap('+500', row(3));
assert.equal(GameState.gold, 600);
assert.match(scene.currencyText.value, /Gold: 600/);
tap('ON', row(4));
assert.equal(GameState.development.showArenaBorder, false);
assert.equal(getButton('OFF', row(4)).regionMapState, 'normal');

assert.equal(JSON.parse(storage.get('delveDeep.profile.v2')).development.showArenaBorder, false);
loadProfile(adventurers);
assert.equal(GameState.development.showArenaBorder, false);
assert.equal(GameState.gold, 600);

storage.set('delveDeep.profile.v2', JSON.stringify({ development: { showGridLines: true } }));
loadProfile(adventurers);
assert.equal(GameState.development.showArenaBorder, true);
storage.set('delveDeep.profile.v2', JSON.stringify({ development: { showGridLines: true, showArenaBorder: false } }));
loadProfile(adventurers);
assert.equal(GameState.development.showArenaBorder, false);

storage.set('delveDeep.profile.v2', JSON.stringify({ development: {} }));
loadProfile(adventurers);
assert.equal(GameState.development.showArenaBorder, false);
tap('OFF', row(0));
assert.equal(GameState.development.unlockAll, true);
assert.equal(GameState.development.replayCleared, true);
assert.equal(scene.restarted, true);

const enabledScene = new context.TitleScene();
enabledScene.showDevelopmentTools();

// find returns the first matching entry, or undefined when none matches. Check for that
// missing result before using its fields.
const enabledCaption = enabledScene.objects.find((object) => object.type === 'text'
  && object.value === 'ON' && object.y === row(0));
const enabledButton = enabledScene.objects.find((object) => object.type === 'rectangle'
  && object.x === enabledCaption.x && object.y === enabledCaption.y);
assert.equal(enabledButton.regionMapState, 'selected');

const toastScene = new context.TitleScene();
const tweens = [];
toastScene.tweens = { add(config) {
  const tween = { config, stopped: false, stop() { this.stopped = true; } };
  tweens.push(tween);
  return tween;
} };

toastScene.showToast('First');
const firstToast = toastScene.activeToast;
toastScene.showToast('Second');
assert.equal(tweens[0].stopped, true);
assert.equal(firstToast.panel.destroyed, true);
assert.equal(firstToast.text.destroyed, true);
assert.equal(toastScene.activeToast.text.value, 'Second');

tweens[1].config.onComplete();
assert.equal(toastScene.activeToast, null);

const geometrySource = fs.readFileSync(new URL('../combat/BattlefieldGeometry.js', import.meta.url), 'utf8')
  .replace(/^import [\s\S]*?;\r?\n/gm, '')
  .replace('export default class BattlefieldGeometry', 'globalThis.BattlefieldGeometry = class BattlefieldGeometry');
const geometryContext = vm.createContext({ Phaser: {
  Math: { Clamp: (value, min, max) => Math.min(max, Math.max(min, value)), Linear: (a, b, t) => a + (b - a) * t },

  Geom: { Point: class { constructor(x, y) {
    this.x = x;
    this.y = y;
  } } }
} });

vm.runInContext(geometrySource, geometryContext);
const drawings = [];
const battlefield = new geometryContext.BattlefieldGeometry({
  add: { graphics() {
    const graphic = { fills: 0, strokes: 0, paths: 0, setDepth() { return this; } };
    for (const method of ['lineStyle', 'beginPath', 'moveTo', 'lineTo']) {
      graphic[method] = () => graphic;
    }
    graphic.fillPoints = () => {
      graphic.fills++;
      return graphic;
    };
    graphic.strokePoints = () => {
      graphic.strokes++;
      return graphic;
    };
    graphic.strokePath = () => {
      graphic.paths++;
      return graphic;
    };

    drawings.push(graphic);
    return graphic;
  } }
}, {
  bottomLeftX: 0, bottomRightX: 800, topLeftX: 100, topRightX: 700,
  bottomY: 600, topY: 100, logicalWidth: 800, logicalHeight: 600,
  columns: 8, rows: 6
});

battlefield.drawArenaBorder(false);
battlefield.drawArenaBorder(true);
assert.equal(drawings[0].fills, 0);
assert.equal(drawings[0].strokes, 0);
assert.equal(drawings[0].paths, 0);
assert.equal(drawings[1].fills, 0);
assert.equal(drawings[1].strokes, 1);

assert.equal(drawings[1].paths, 0);
assert.equal(battlefield.boundary.length, 4);
console.log('Development tools grants and saved arena border preference passed.');
