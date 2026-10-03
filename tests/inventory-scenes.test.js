import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import GameState from '../game/GameState.js';
import adventurers from '../data/adventurers.js';
import { loadProfile } from '../game/GameStorage.js';
import * as equipment from '../game/Equipment.js';
import { CLASS_DEFINITIONS } from '../data/classes.js';
import { CRAFTING_MATERIALS } from '../data/items.js';

globalThis.localStorage = { getItem: () => null, setItem() {} };
loadProfile(adventurers);

class Scene {
  constructor() {
    this.objects = [];
    this.scale = { width: 2400, height: 1080 };
    this.cameras = { main: { setBackgroundColor() {} } };
    this.scene = { key: this.constructor.name, start: (name) => { this.destination = name; } };
    this.children = { list: this.objects, removeAll: () => { this.objects = []; this.children.list = this.objects; } };
    this.events = { once() {} };
    this.input = { on() {} };
    this.make = { graphics: () => ({ fillRect() {}, createGeometryMask: () => ({}), destroy() {} }) };
    this.add = {};
    for (const type of ['rectangle', 'circle', 'text', 'image', 'container']) {
      this.add[type] = (x, y, value, height, color) => {
        const object = { type, x, y, value, height, color, handlers: {} };
        object.on = (event, callback) => { object.handlers[event] = callback; return object; };
        object.setText = (text) => { object.value = text; return object; };
        for (const method of ['setStrokeStyle', 'setOrigin', 'setAlpha', 'setInteractive', 'setDepth', 'setMask', 'setScale']) object[method] = () => object;
        object.destroy = () => { object.destroyed = true; };
        object.width = 2400;
        object.height = 1080;
        this.objects.push(object);
        return object;
      };
    }
  }
}

const context = vm.createContext({
  Phaser: { Scene, Math: { Clamp: (value, min, max) => Math.max(min, Math.min(max, value)) } },
  GameState, ...equipment, CLASS_DEFINITIONS, CRAFTING_MATERIALS, UI_SAFE_TOP: 132,
  HapticsService: { tap() {}, confirm() {} }, saveProfile() {},
  addHallBackground() {}, bindSelectionDetails(scene, target, details, tap) { target.tap = tap; },
  addDetailsHint() {},
  abilityEntries: (hero) => Object.entries(CLASS_DEFINITIONS[hero.className]?.abilities ?? {}),
  abilityGoldCost: () => 80, abilityLevelRequired: () => 1, MAX_ABILITY_RANK: 3, MAX_EQUIPPED_ABILITIES: 4,
  purchaseAdventurerAbility() {}, toggleAdventurerAbility() {}, happinessLabel: () => 'Content', xpRequired: () => 100,
  showConfirmation() {}, console
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
vm.runInContext(fs.readFileSync(new URL('../ui/FacilityMenu.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export const FACILITIES', 'globalThis.FACILITIES')
  .replace('export function renderFacilityMenu', 'globalThis.renderFacilityMenu = function renderFacilityMenu'), context);
load('../ui/InventoryScene.js', 'InventoryScene');
const Blacksmith = load('../scenes/BlacksmithScene.js', 'BlacksmithScene');
const Facility = load('../scenes/FacilityScene.js', 'FacilityScene');
const Items = load('../scenes/ItemsScene.js', 'ItemsScene');
const Shop = load('../scenes/ShopScene.js', 'ShopScene');
const Roster = load('../scenes/RosterScene.js', 'RosterScene');

const hasText = (scene, phrase) => scene.objects.some((object) => object.type === 'text' && String(object.value).includes(phrase));
function tap(scene, label) {
  const text = scene.objects.find((object) => object.type === 'text' && object.value === label);
  assert.ok(text, `Missing ${label}`);
  const button = scene.objects.find((object) => object.type === 'rectangle' && object.x === text.x && Math.abs(object.y - text.y) <= 24 && object.tap);
  assert.ok(button, `Disabled or missing control: ${label}`);
  button.tap();
}

const smith = new Blacksmith();
smith.create();
assert.ok(smith.objects.some((object) => object.type === 'image' && object.value === 'blacksmith'));
tap(smith, 'BUY');
assert.ok(hasText(smith, 'No equipment or crafting supplies are stocked.'));
tap(smith, 'SELL');
assert.ok(hasText(smith, 'no equipment or materials to sell'));
tap(smith, 'CRAFT');
assert.ok(hasText(smith, 'No crafting recipes are available.'));
smith.objects.find((object) => object.type === 'rectangle' && object.x === 312 && object.y === 164).handlers.pointerdown();
assert.equal(smith.mode, null);
smith.objects.find((object) => object.type === 'rectangle' && object.x === 312 && object.y === 164).handlers.pointerdown();
assert.equal(smith.destination, 'TownScene');

for (const [title, background, choice, message] of [
  ['Alchemist', 'alchemist', 'BREW', 'No brewing recipes are available yet.'],
  ['Enchanter', 'enchanter', 'ENCHANT', 'No enchantments are available yet.']
]) {
  const facility = new Facility();
  facility.init({ title });
  facility.create();
  assert.ok(facility.objects.some((object) => object.type === 'image' && object.value === background));
  tap(facility, choice);
  assert.ok(hasText(facility, message));
  facility.objects.find((object) => object.type === 'rectangle' && object.x === 312 && object.y === 164).handlers.pointerdown();
  assert.equal(facility.selection, null);
  facility.objects.find((object) => object.type === 'rectangle' && object.x === 312 && object.y === 164).handlers.pointerdown();
  assert.equal(facility.destination, 'TownScene');
}

const inventory = new Items();
inventory.create();
for (const [category, message] of [
  ['Armor', 'No armor'], ['Accessories', 'No accessories'],
  ['Items', 'No items'], ['Materials', 'No materials'], ['Potions', 'No potions'], ['Weapons', 'No weapons']
]) {
  tap(inventory, category);
  assert.ok(hasText(inventory, message));
}
GameState.inventory.materials = { iron: 3 };
tap(inventory, 'Materials');
assert.ok(hasText(inventory, 'Iron Ore'));
assert.ok(hasText(inventory, 'x3'));
GameState.inventory.materials = {};
const returnButton = inventory.objects.find((object) => object.type === 'rectangle' && object.x === 312 && object.y === 52);
assert.ok(returnButton?.handlers.pointerdown);
returnButton.handlers.pointerdown();
assert.equal(inventory.destination, 'AdventurersHallScene');

const shop = new Shop();
shop.create();
assert.ok(hasText(shop, 'QUARTERMASTER'));
assert.ok(hasText(shop, 'No supplies are stocked yet.'));

const roster = new Roster();
roster.create();
for (const label of ['WEAPON', 'ARMOR', 'ACCESSORY', 'POTION']) assert.ok(hasText(roster, label));
roster.openEquipment(GameState.roster.find((hero) => hero.id === roster.heroId), 'accessory');
assert.ok(hasText(roster, 'No equipment is available yet.'));
roster.openEquipment(GameState.roster.find((hero) => hero.id === roster.heroId), 'potion');
assert.ok(hasText(roster, 'No potion packs are available yet.'));
console.log('Facility menus, empty shops, inventory, and four equipment slots passed.');
