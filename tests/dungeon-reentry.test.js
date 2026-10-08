// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const frames = [];
const starts = [];
let loadingCount = 0;
let expeditionCount = 0;

class Scene {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods.
  constructor() {
    this.scale = { width: 2400, height: 1080 };
    this.cameras = { main: { setBackgroundColor() {} } };
    this.events = { once() {} };
    this.scene = { start: (key) => starts.push(key) };
    this.add = {};

    for (const type of ['text', 'rectangle', 'circle']) {
      this.add[type] = (x, y, value, height, color) => {
        const object = { x, y, value, color, handlers: {} };
        object.on = (event, callback) => {
          object.handlers[event] = callback;
          return object;
        };
        object.setInteractive = () => object;
        object.setOrigin = () => object;
        object.setDepth = () => object;
        object.setStrokeStyle = () => object;
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

  // We handle bind selection details here, keeping this operation in one place for its
  // callers.
  bindSelectionDetails() {}, characterDetails() {}, getEquippedAdventurer() {},
  leaderAbilities: [], UI_SAFE_TOP: 132,
  CHARACTER_SPRITES: {}, STONE: { muted: '#ccc' },

  // Build the selected encounter's shared preparation workspace frame.
  preparationFrame() {}, preparationNotice() {}, addStonePanel() {},

  // Create centered, outlined stone-interface text. options can override the shared
  // defaults.
  stoneText() { return { setOrigin() {} }; },

  // Build a shared Delve preparation control with the selected encounter's stone theme.
  // width is the available width in this coordinate space.
  preparationButton(scene, x, y, width, height, label, callback) {
    scene.objects.push({ label, callback });
  },

  // Show the existing HTML splash while the next Phaser loading step is in progress.
  showLoadingScreen() { loadingCount++; },

  // Initialize persistent run tracking before entering the selected encounter.
  beginExpedition() { expeditionCount++; },

  // We handle request animation frame here, keeping this operation in one place for its
  // callers.
  requestAnimationFrame(callback) { frames.push(callback); }
});

vm.runInContext(fs.readFileSync(new URL('../ui/WoodenPanel.js', import.meta.url), 'utf8').replaceAll('export function ', 'function '), context);
vm.runInContext(fs.readFileSync(new URL('../ui/ReturnButton.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export function addReturnButton', 'globalThis.addReturnButton = function addReturnButton'), context);
const source = fs.readFileSync(new URL('../scenes/DungeonScene.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default class DungeonScene', 'globalThis.DungeonScene = class DungeonScene');

vm.runInContext(source, context);

const dungeon = new context.DungeonScene();
for (let visit = 1; visit <= 2; visit++) {
  dungeon.init();
  dungeon.objects = [];
  dungeon.create();

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const button = dungeon.objects.find((object) => object.label === 'DELVE DEEP!');
  assert.ok(button, 'Delve entry button exists');
  button.callback();
  button.callback();
  assert.equal(loadingCount, visit, 'Repeated taps start only one loading transition');

  while (frames.length) frames.shift()();
  assert.equal(expeditionCount, visit, 'Each visit begins a new expedition');
  assert.equal(starts.at(-1), 'BattleScene');
}

assert.equal(starts.length, 2);
console.log('Dungeon reentry checks passed');
