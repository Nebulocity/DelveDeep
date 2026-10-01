import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const frames = [];
const starts = [];
let loadingCount = 0;
let expeditionCount = 0;

class Scene {
  constructor() {
    this.scale = { width: 2400, height: 1080 };
    this.cameras = { main: { setBackgroundColor() {} } };
    this.events = { once() {} };
    this.scene = { start: (key) => starts.push(key) };
    this.add = {};
    for (const type of ['text', 'rectangle', 'circle']) {
      this.add[type] = (x, y, value, height, color) => {
        const object = { x, y, value, color, handlers: {} };
        object.on = (event, callback) => { object.handlers[event] = callback; return object; };
        object.setInteractive = () => object;
        object.setOrigin = () => object;
        this.objects.push(object);
        return object;
      };
    }
    this.objects = [];
  }
}

const context = vm.createContext({
  Phaser: { Scene },
  GameState: { currentDelve: { name: 'Slime Cave' }, activeParty: [], leader: { battleLoadout: [] } },
  HapticsService: { tap() {}, confirm() {} },
  bindSelectionDetails() {}, characterDetails() {}, getEquippedAdventurer() {},
  leaderAbilities: [], UI_SAFE_TOP: 132,
  showLoadingScreen() { loadingCount++; },
  beginExpedition() { expeditionCount++; },
  requestAnimationFrame(callback) { frames.push(callback); }
});
const source = fs.readFileSync(new URL('../scenes/DungeonScene.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default class DungeonScene', 'globalThis.DungeonScene = class DungeonScene');
vm.runInContext(source, context);

const dungeon = new context.DungeonScene();
for (let visit = 1; visit <= 2; visit++) {
  dungeon.init();
  dungeon.objects = [];
  dungeon.create();
  const button = dungeon.objects.find((object) => object.color === 0x7c2d12 && object.handlers.pointerdown);
  assert.ok(button, 'Delve entry button exists');
  button.handlers.pointerdown();
  button.handlers.pointerdown();
  assert.equal(loadingCount, visit, 'Repeated taps start only one loading transition');
  while (frames.length) frames.shift()();
  assert.equal(expeditionCount, visit, 'Each visit begins a new expedition');
  assert.equal(starts.at(-1), 'BattleScene');
}

assert.equal(starts.length, 2);
console.log('Dungeon reentry checks passed');
