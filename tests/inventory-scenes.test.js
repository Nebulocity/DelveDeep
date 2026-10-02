import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import GameState from '../game/GameState.js';
import adventurers from '../data/adventurers.js';
import { loadProfile } from '../game/GameStorage.js';
import * as itemData from '../data/items.js';
import * as equipment from '../game/Equipment.js';
import { CLASS_DEFINITIONS } from '../data/classes.js';
import * as leaderProgression from '../game/LeaderProgression.js';
import { battleAbilities } from '../game/AdventurerAbilities.js';

globalThis.localStorage = { getItem: () => null, setItem() {} };
loadProfile(adventurers);
let saves = 0;

// Exercise the actual scene callbacks with a minimal display adapter. This
// catches routing/render exceptions without requiring a browser or Phaser GPU.
class Scene {
  constructor() {
    this.objects = [];
    this.scale = { width: 2400, height: 1080 };
    this.cameras = { main: { setBackgroundColor() {} } };
    this.scene = { key: this.constructor.name, start: (name) => { this.destination = name; }, restart() {} };
    this.time = { delayedCall() {} };
    this.children = { list: this.objects, removeAll: () => { this.objects = []; this.children.list = this.objects; } };
    this.events = { once() {}, off() {} };
    this.input = { on() {} };
    this.make = { graphics: () => ({ fillRect() {}, createGeometryMask: () => ({}), destroy() {} }) };
    this.add = {};
    for (const type of ['rectangle', 'circle', 'text', 'image', 'container']) {
      this.add[type] = (x, y, value, height, color) => {
        const object = { type, x, y, value, height, color };
        object.handlers = {};
        object.on = (event, callback) => { object.handlers[event] = callback; return object; };
        object.setText = (text) => { object.value = text; return object; };
        for (const method of ['setStrokeStyle', 'setOrigin', 'setAlpha', 'setInteractive', 'setDepth', 'setMask', 'setScale']) object[method] = () => object;
        object.destroy = () => { object.destroyed = true; };
        object.width = 2400; object.height = 1080;
        this.objects.push(object);
        return object;
      };
    }
  }
}
const context = vm.createContext({
  Phaser: { Scene, Math: { Clamp: (value, min, max) => Math.max(min, Math.min(max, value)) } }, GameState, ...itemData, ...equipment, ...leaderProgression, battleAbilities, CLASS_DEFINITIONS, UI_SAFE_TOP: 132,
  HapticsService: { tap() {}, confirm() {} }, saveProfile() { saves++; },
  showConfirmation(scene, options) { scene.pendingConfirmation = options; }, addHallBackground() {},
  bindSelectionDetails(scene, target, details, tap) { target.tap = tap ?? target.handlers?.pointerdown; },
  characterDetails: (hero) => ({ title: hero.name }), TONIC_DESCRIPTION: 'Healing Tonic',
  abilityEntries: (hero) => Object.entries(CLASS_DEFINITIONS[hero.className]?.abilities ?? {}),
  abilityGoldCost: () => 80, abilityLevelRequired: () => 1, MAX_ABILITY_RANK: 3, MAX_EQUIPPED_ABILITIES: 4,
  purchaseAdventurerAbility() {}, toggleAdventurerAbility() {}, happinessLabel: () => 'Content', xpRequired: () => 100,
  console
});
function load(path, name) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8')
    .replace(/^import [\s\S]*?;\r?\n/gm, '')
    .replace(`export default class ${name}`, `globalThis.${name} = class ${name}`);
  vm.runInContext(source, context);
  return context[name];
}
vm.runInContext(fs.readFileSync(new URL('../ui/ReturnButton.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export function addReturnButton', 'globalThis.addReturnButton = function addReturnButton'), context);
load('../ui/InventoryScene.js', 'InventoryScene');
const Blacksmith = load('../scenes/BlacksmithScene.js', 'BlacksmithScene');
const Roster = load('../scenes/RosterScene.js', 'RosterScene');
const Items = load('../scenes/ItemsScene.js', 'ItemsScene');
function tap(scene, label, occurrence = 0) {
  const text = scene.objects.filter((object) => object.type === 'text' && object.value === label)[occurrence];
  assert.ok(text, `Missing ${label}`);
  const button = scene.objects.find((object) => object.type === 'rectangle' && object.x === text.x && object.y === text.y && object.tap);
  assert.ok(button, `Disabled or missing control: ${label}`);
  button.tap();
}
function pressAt(scene, x, y) {
  const button = scene.objects.findLast((object) => object.type === 'rectangle' && object.x === x && object.y === y && !object.destroyed);
  assert.ok(button?.handlers.pointerdown, `Missing control at ${x}, ${y}`);
  button.handlers.pointerdown({}, 0, 0, { stopPropagation() {} });
}
function hasText(scene, phrase) {
  return scene.objects.some((object) => object.type === 'text' && String(object.value).includes(phrase));
}
function confirm(scene) {
  assert.ok(scene.pendingConfirmation);
  const action = scene.pendingConfirmation.onConfirm;
  scene.pendingConfirmation = null;
  action();
}

const smith = new Blacksmith();
smith.create();
assert.ok(hasText(smith, 'BLACKSMITH'));
Object.assign(smith, { kind: 'materials', classIndex: 2, rarity: 'rare', page: 3 });
smith.change('mode', 'sell');
assert.equal(smith.kind, 'equipment');
assert.equal(smith.classIndex, 0);
assert.equal(smith.rarity, 'all');
assert.equal(smith.page, 0);
Object.assign(smith, { classIndex: 2, rarity: 'rare', page: 3 });
smith.change('kind', 'materials');
assert.equal(smith.classIndex, 0);
assert.equal(smith.rarity, 'all');
assert.equal(smith.page, 0);
smith.create();
// Empty/insufficient-funds screens still render and navigate.
tap(smith, 'SELL');
assert.ok(hasText(smith, 'No items match'));
tap(smith, 'CRAFT');
assert.ok(hasText(smith, 'Iron Ingot 0/2'));
GameState.gold = 1000;
tap(smith, 'BUY');
tap(smith, 'BUY 100g');
assert.equal(GameState.gold, 1000);
assert.equal(GameState.inventory.equipment.length, 0);
smith.pendingConfirmation = null; // Cancel must not run the transaction.
assert.equal(GameState.gold, 1000);
tap(smith, 'BUY 100g');
confirm(smith);
assert.equal(GameState.inventory.equipment.length, 1);
assert.equal(GameState.gold, 900);
tap(smith, 'SELL');
tap(smith, 'SELL 50g');
assert.equal(GameState.inventory.equipment.length, 1); // First tap only confirms intent.
confirm(smith);
assert.equal(GameState.inventory.equipment.length, 0);
assert.equal(GameState.gold, 950);
tap(smith, 'BUY');
tap(smith, 'Materials');
tap(smith, 'BUY 50g');
confirm(smith);
tap(smith, 'BUY 50g');
confirm(smith);
tap(smith, 'CRAFT');
tap(smith, 'CRAFT', 1); // Mode tab is the first label; recipe action is the second.
assert.equal(GameState.inventory.materials.iron, 2);
confirm(smith);
assert.equal(GameState.inventory.equipment.length, 1);
assert.equal(GameState.inventory.materials.iron, 0);
assert.ok(hasText(smith, 'crafted'));
// Every class and rarity, including empty future tiers, can be browsed.
for (const mode of ['buy', 'sell', 'craft']) {
  for (const rarity of ['all', ...Object.keys(itemData.ITEM_RARITIES)]) {
    for (let classIndex = 0; classIndex <= Object.keys(CLASS_DEFINITIONS).length; classIndex++) {
      Object.assign(smith, { mode, rarity, classIndex, page: 999, kind: 'equipment' });
      smith.render();
      assert.ok(smith.page >= 0 && smith.page < Math.ceil(itemData.EQUIPMENT_ITEMS.length / 4));
    }
  }
}

const gear = new Roster();
gear.create();
const abilityRowRight = 1945 + 804 / 2;
const rightActions = gear.objects.filter((object) => object.type === 'text' && ['TRAIN', 'UNLOCK'].includes(object.value));
assert.ok(rightActions.length > 0);
let checkedActionGaps = 0;
for (const action of rightActions) {
  const box = gear.objects.find((object) => object.type === 'rectangle' && object.x === action.x && object.y === action.y);
  assert.ok(box && box.x + box.value / 2 <= abilityRowRight - 20, `${action.value} extends past its ability card`);
  const leftAction = gear.objects.find((object) => object.type === 'text' && object.y === action.y && ['EQUIP', 'UNEQUIP'].includes(object.value));
  if (leftAction) {
    const leftBox = gear.objects.find((object) => object.type === 'rectangle' && object.x === leftAction.x && object.y === leftAction.y);
    assert.ok(leftBox && box.x - box.value / 2 - (leftBox.x + leftBox.value / 2) >= 20, 'Ability actions need a gap');
    checkedActionGaps++;
  }
}
assert.ok(checkedActionGaps > 0);
gear.role = 'Tank';
gear.heroId = 'laurana';
gear.render();
pressAt(gear, 845, 971);
pressAt(gear, 1740, 395);
assert.ok(GameState.roster.find((hero) => hero.id === 'laurana').equipment.weapon);
pressAt(gear, 845, 971);
pressAt(gear, 1740, 258);
assert.equal(GameState.roster.find((hero) => hero.id === 'laurana').equipment.weapon, null);
pressAt(gear, 845, 971);
pressAt(gear, 1740, 395);
const inventory = new Items();
inventory.create();
assert.ok(hasText(inventory, 'No armor owned'));
tap(inventory, 'Weapons');
assert.ok(hasText(inventory, 'Equipped by Laurana'));
tap(inventory, 'Materials');
assert.ok(hasText(inventory, 'No crafting materials owned'));
tap(inventory, 'Void');
assert.ok(hasText(inventory, 'No Void Keys owned'));
GameState.inventory.healingTonic = 3;
GameState.inventory.voidKeys = 2;
tap(inventory, 'Items');
assert.ok(hasText(inventory, 'Owned: 3'));
assert.equal(hasText(inventory, 'Void Key'), false);
tap(inventory, 'Void');
assert.ok(hasText(inventory, 'Owned: 2'));
assert.ok(hasText(inventory, 'Void Key'));
const returnButton = inventory.objects.find((object) => object.type === 'rectangle' && object.x === 312 && object.y === 52);
assert.ok(returnButton?.handlers.pointerdown);
assert.ok(hasText(inventory, "Return to Adventurer's Hall"));
returnButton.handlers.pointerdown();
assert.equal(inventory.destination, 'AdventurersHallScene');
assert.ok(saves >= 8);

// Tonics and tactic unlocks also defer spending, revalidate on confirm, and
// leave equipping an already-owned tactic as an immediate loadout action.
const Shop = load('../scenes/ShopScene.js', 'ShopScene');
const shop = new Shop();
shop.messageText = { setText() {} };
shop.refresh = () => {};
GameState.gold = 100;
const tonics = GameState.inventory.healingTonic;
shop.buyTonic();
assert.equal(GameState.gold, 100);
assert.equal(GameState.inventory.healingTonic, tonics);
shop.pendingConfirmation = null;
shop.buyTonic();
confirm(shop);
assert.equal(GameState.gold, 75);
assert.equal(GameState.inventory.healingTonic, tonics + 1);
shop.buyTonic();
GameState.gold = 0;
confirm(shop);
assert.equal(GameState.inventory.healingTonic, tonics + 1);

const Tactics = load('../scenes/RaidLeaderScene.js', 'RaidLeaderScene');
const tactics = new Tactics();
GameState.leader = leaderProgression.loadLeaderProgression();
GameState.leader.tacticsPoints = 2;
assert.deepEqual(new Set(leaderProgression.leaderAbilities.map((entry) => entry.category)), new Set(['Assault', 'Protect', 'Restore', 'Prepare']));
tactics.create();
for (const category of ['ASSAULT', 'PROTECT', 'RESTORE', 'PREPARE']) assert.ok(hasText(tactics, category));
const ability = leaderProgression.leaderAbilities.find((entry) => entry.id === 'brace');
const tacticTap = () => {
  tactics.createAbilityCard(ability, 500, 400, 680, 190);
  tactics.objects.filter((object) => object.type === 'rectangle').at(-1).tap();
};
tacticTap();
assert.equal(GameState.leader.tacticsPoints, 2);
assert.equal(GameState.leader.unlockedAbilities.includes('brace'), false);
tactics.pendingConfirmation = null;
tacticTap();
GameState.leader.tacticsPoints = 0;
confirm(tactics);
assert.equal(GameState.leader.unlockedAbilities.includes('brace'), false);
GameState.leader.tacticsPoints = 2;
tacticTap();
confirm(tactics);
assert.equal(GameState.leader.tacticsPoints, 2 - ability.cost);
assert.equal(GameState.leader.unlockedAbilities.includes('brace'), true);
tacticTap();
assert.equal(tactics.pendingConfirmation, null);
assert.equal(GameState.leader.battleLoadout.includes('brace'), true);

// Actual combat setup must consume effective stats even when activeParty is
// an older pre-equipment snapshot. Roster base stats must stay untouched.
const sturm = GameState.roster.find((hero) => hero.id === 'laurana');
GameState.activeParty = [{ ...sturm, equipment: { weapon: null, armor: null } }];
context.BattleUnit = class {
  constructor(scene, config) {
    Object.assign(this, config);
    this.hitZone = { setInteractive() {}, on() {} };
  }
  setArenaPosition() {}
};
const Battle = load('../scenes/BattleScene.js', 'BattleScene');
const battle = new Battle();
battle.battlefield = { logicalWidth: 1750 };
battle.waveReturnPositions = new Map();
battle.tactics = { registerParty() {}, getSpawnPosition: () => ({ x: 0, y: 0 }) };
battle.movement = { validateUnitPosition() {} };
battle.createParty();
assert.equal(battle.partyUnits[0].attackPower, sturm.attackPower + 3);
assert.equal(battle.partyUnits[0].maxHp, sturm.maxHp);
console.log('Inventory scene purchase, sale confirmation, crafting, loadout, browsing, and combat setup passed.');
