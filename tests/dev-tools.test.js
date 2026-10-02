import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import GameState from '../game/GameState.js';
import adventurers from '../data/adventurers.js';
import { loadProfile, saveProfile } from '../game/GameStorage.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value)
};
loadProfile(adventurers);
assert.equal(GameState.development.showGridLines, true);

class Scene {
  constructor() {
    this.scale = { width: 2400, height: 1080 };
    this.objects = [];
    this.scene = { restart: () => { this.restarted = true; } };
    this.add = {};
    for (const type of ['rectangle', 'text']) {
      this.add[type] = (x, y, value, height, color) => {
        const object = { type, x, y, value, color, handlers: {} };
        for (const method of ['setInteractive', 'setStrokeStyle', 'setDepth', 'setOrigin']) {
          object[method] = () => object;
        }
        object.setFillStyle = (color) => { object.color = color; return object; };
        object.setColor = (color) => { object.textColor = color; return object; };
        object.on = (event, handler) => { object.handlers[event] = handler; return object; };
        object.setText = (value) => { object.value = value; return object; };
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
const context = vm.createContext({
  Phaser: { Scene }, GameState,
  HapticsService: { tap() {}, confirm() {} },
  saveProfile, grantLeaderLevels(leader, amount) {
    leader.level += amount;
    return { tacticsPointsEarned: amount === 5 ? 1 : 0 };
  }
});
vm.runInContext(source, context);
const scene = new context.TitleScene();
scene.currencyText = { setText(value) { this.value = value; } };
scene.showToast = (message) => { scene.lastToast = message; };
GameState.leader = { level: 1, tacticsPoints: 0 };
scene.showDevelopmentTools();

function getButton(label, y) {
  const caption = scene.objects.find((object) => object.type === 'text' && object.value === label && object.y === y);
  assert.ok(caption, `Missing ${label} at ${y}`);
  const button = scene.objects.find((object) => object.type === 'rectangle'
    && object.x === caption.x && object.y === caption.y && object.handlers.pointerdown);
  assert.ok(button);
  return button;
}
function tap(label, y) {
  const button = getButton(label, y);
  button.handlers.pointerdown();
}

const panelTop = (1080 - 850) / 2;
const row = (index) => panelTop + 180 + index * 105;
const primaryButtons = [
  getButton('OFF', row(0)), getButton('+1', row(1)), getButton('+1', row(2)),
  getButton('+100', row(3)), getButton('ON', row(4)), getButton('RESET', row(5))
];
const secondaryButtons = [getButton('+5', row(1)), getButton('+5', row(2)), getButton('+500', row(3))];
const closeButton = getButton('CLOSE', panelTop + 850 - 52);
assert.ok(primaryButtons.every((button) => button.x === primaryButtons[0].x));
assert.ok(secondaryButtons.every((button) => button.x > primaryButtons[0].x + primaryButtons[0].value));
assert.ok([...primaryButtons, ...secondaryButtons, closeButton].every((button) => button.value === 220));
assert.equal(closeButton.x, scene.scale.width / 2);
assert.equal(getButton('OFF', row(0)).color, 0x08192e);
assert.equal(getButton('+1', row(1)).color, 0x0e9c4b);
assert.equal(getButton('+1', row(2)).color, 0x4c0975);
assert.equal(getButton('+100', row(3)).color, 0xb38c0c);
assert.equal(getButton('ON', row(4)).color, 0xebed53);
tap('+1', row(1));
tap('+5', row(1));
assert.equal(GameState.leader.level, 7);
tap('+1', row(2));
tap('+5', row(2));
assert.equal(GameState.inventory.voidKeys, 6);
tap('+100', row(3));
tap('+500', row(3));
assert.equal(GameState.gold, 600);
assert.match(scene.currencyText.value, /Gold: 600   Void Keys: 6/);
tap('ON', row(4));
assert.equal(GameState.development.showGridLines, false);
assert.equal(getButton('OFF', row(4)).color, 0x4e4f19);
assert.equal(JSON.parse(storage.get('delveDeep.profile.v2')).development.showGridLines, false);
loadProfile(adventurers);
assert.equal(GameState.development.showGridLines, false);
assert.equal(GameState.gold, 600);
assert.equal(GameState.inventory.voidKeys, 6);

storage.set('delveDeep.profile.v2', JSON.stringify({ development: {} }));
loadProfile(adventurers);
assert.equal(GameState.development.showGridLines, true);
tap('OFF', row(0));
assert.equal(GameState.development.unlockAll, true);
assert.equal(GameState.development.replayCleared, true);
assert.equal(scene.restarted, true);
const enabledScene = new context.TitleScene();
enabledScene.showDevelopmentTools();
const enabledCaption = enabledScene.objects.find((object) => object.type === 'text'
  && object.value === 'ON' && object.y === row(0));
const enabledButton = enabledScene.objects.find((object) => object.type === 'rectangle'
  && object.x === enabledCaption.x && object.y === enabledCaption.y);
assert.equal(enabledButton.color, 0x00f2fa);

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
  Geom: { Point: class { constructor(x, y) { this.x = x; this.y = y; } } }
} });
vm.runInContext(geometrySource, geometryContext);
const drawings = [];
const battlefield = new geometryContext.BattlefieldGeometry({
  add: { graphics() {
    const graphic = { strokes: 0, paths: 0 };
    for (const method of ['fillStyle', 'fillPoints', 'lineStyle', 'beginPath', 'moveTo', 'lineTo']) {
      graphic[method] = () => graphic;
    }
    graphic.strokePoints = () => { graphic.strokes++; return graphic; };
    graphic.strokePath = () => { graphic.paths++; return graphic; };
    drawings.push(graphic);
    return graphic;
  } }
}, {
  bottomLeftX: 0, bottomRightX: 800, topLeftX: 100, topRightX: 700,
  bottomY: 600, topY: 100, logicalWidth: 800, logicalHeight: 600,
  columns: 8, rows: 6
});
battlefield.drawPerspectiveFloor(false);
battlefield.drawPerspectiveFloor(true);
assert.equal(drawings[0].strokes, 1);
assert.equal(drawings[0].paths, 0);
assert.equal(drawings[1].paths, 12);
assert.equal(battlefield.getCellPolygon(0, 0).length, 4);
console.log('Development tools grants and saved grid preference passed.');
