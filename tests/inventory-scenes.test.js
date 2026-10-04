import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import GameState from '../game/GameState.js';
import adventurers from '../data/adventurers.js';
import { loadProfile } from '../game/GameStorage.js';
import * as equipment from '../game/Equipment.js';
import { CLASS_DEFINITIONS } from '../data/classes.js';
import { abilityLearningAvailable, sortedAbilityEntries } from '../game/AdventurerAbilities.js';
import { CRAFTING_MATERIALS, POTION_ITEMS, getPotionDefinition } from '../data/items.js';

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
    for (const type of ['rectangle', 'circle', 'text', 'image', 'container', 'graphics']) {
      this.add[type] = (x, y, value, height, color) => {
        const object = { type, x, y, value, height, color, style: type === 'text' ? height : null, handlers: {} };
        object.on = (event, callback) => { object.handlers[event] = callback; return object; };
        object.setText = (text) => { object.value = text; return object; };
        for (const method of ['setStrokeStyle', 'setOrigin', 'setAlpha', 'setInteractive', 'setDepth', 'setMask', 'setScale',
          'setPosition', 'fillStyle', 'fillRoundedRect', 'lineStyle', 'strokeRoundedRect', 'lineBetween', 'fillRect',
          'strokeCircle', 'fillCircle', 'strokeEllipse', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'strokePath']) object[method] = () => object;
        object.setOrigin = (x, y = x) => { object.originX = x; object.originY = y; return object; };
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
  GameState, ...equipment, CLASS_DEFINITIONS, CRAFTING_MATERIALS, POTION_ITEMS, getPotionDefinition, UI_SAFE_TOP: 132,
  HapticsService: { tap() {}, confirm() {} }, saveProfile() {},
  addHallBackground() {}, bindSelectionDetails(scene, target, details, tap) { target.tap = tap; },
  addDetailsHint() {},
  abilityEntries: (hero) => Object.entries(CLASS_DEFINITIONS[hero.className]?.abilities ?? {}),
  abilityLearningAvailable, sortedAbilityEntries,
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
vm.runInContext(fs.readFileSync(new URL('../ui/FacilityChoiceArt.js', import.meta.url), 'utf8')
  .replace('export function addFacilityChoiceCard', 'globalThis.addFacilityChoiceCard = function addFacilityChoiceCard'), context);
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
assert.ok(hasText(smith, 'Return to Town'));
assert.ok(!hasText(smith, 'Return to Blacksmith'));
const smithClose = smith.objects.find((object) => object.type === 'text' && object.value === 'X');
assert.ok(smithClose.x > 1800 && smithClose.y < 500);
smith.objects.find((object) => object.type === 'rectangle' && object.x === smithClose.x && object.y === smithClose.y).handlers.pointerdown();
assert.equal(smith.mode, null);
tap(smith, 'CRAFT');
smith.objects.find((object) => object.type === 'rectangle' && object.x === 312 && object.y === 164).handlers.pointerdown();
assert.equal(smith.destination, 'TownScene');

for (const [title, background, choice, message] of [
  ['Alchemist', 'alchemist', 'BREW', 'No brewing recipes are available yet.'],
  ['Enchanter', 'enchanter', 'CRAFT', 'No scroll recipes are available yet.']
]) {
  const facility = new Facility();
  facility.init({ title });
  facility.create();
  assert.ok(facility.objects.some((object) => object.type === 'image' && object.value === background));
  tap(facility, choice);
  assert.ok(hasText(facility, message));
  assert.ok(hasText(facility, 'Return to Town'));
  assert.ok(!hasText(facility, `Return to ${title}`));
  const close = facility.objects.find((object) => object.type === 'text' && object.value === 'X');
  assert.ok(close.x > 1800 && close.y < 500);
  facility.objects.find((object) => object.type === 'rectangle' && object.x === close.x && object.y === close.y).handlers.pointerdown();
  assert.equal(facility.selection, null);
  facility.objects.find((object) => object.type === 'rectangle' && object.x === 312 && object.y === 164).handlers.pointerdown();
  assert.equal(facility.destination, 'TownScene');
}

GameState.gold = 0;
const alchemist = new Facility();
alchemist.init({ title: 'Alchemist' });
alchemist.create();
tap(alchemist, 'BUY');
const unaffordableBuy = alchemist.objects.find((object) => object.type === 'rectangle' && object.x === 1810 && object.y === 467);
assert.equal(unaffordableBuy.color, 0x3f3a34);
assert.equal(unaffordableBuy.tap, undefined);
GameState.gold = 120;
alchemist.render();
assert.ok(hasText(alchemist, 'Return to Town'));
assert.ok(!hasText(alchemist, 'Return to Alchemist'));
const potionClose = alchemist.objects.find((object) => object.type === 'text' && object.value === 'X');
assert.ok(potionClose.x > 1950 && potionClose.y < 380);
assert.ok(hasText(alchemist, 'Health Potion'));
assert.ok(hasText(alchemist, 'Mana Potion'));
const shopCounts = alchemist.objects.filter((object) => object.type === 'text' && object.value === 'x3');
assert.equal(shopCounts.length, 2);
assert.ok(shopCounts.every((object) => object.x < 1000 && object.style.fontSize === '26px'));
for (const name of ['Health Potion', 'Mana Potion']) {
  const nameText = alchemist.objects.find((object) => object.type === 'text' && object.value === name);
  const badge = alchemist.objects.find((object) => object.type === 'rectangle'
    && object.color === 0x14532d && object.y === nameText.y);
  assert.ok(badge);
  assert.equal(nameText.originY, 1);
  assert.equal(badge.originY, 1);
}
tap(alchemist, 'Buy: 60g');
assert.equal(GameState.gold, 60);
assert.equal(GameState.inventory.equipment.filter((item) => item.slot === 'potion').length, 1);
tap(alchemist, 'Buy: 60g');
assert.equal(GameState.gold, 0);
assert.equal(alchemist.objects.find((object) => object.type === 'rectangle' && object.x === 1810 && object.y === 467).tap, undefined);
tap(alchemist, 'SELL');
assert.ok(hasText(alchemist, 'x3'));
tap(alchemist, 'Sell: 30g');
assert.equal(GameState.gold, 30);
assert.equal(GameState.inventory.equipment.filter((item) => item.slot === 'potion').length, 1);
tap(alchemist, 'BUY');
assert.equal(alchemist.objects.find((object) => object.type === 'rectangle' && object.x === 1810 && object.y === 467).tap, undefined);
tap(alchemist, 'SELL');
tap(alchemist, 'Sell: 30g');
assert.equal(GameState.inventory.equipment.filter((item) => item.slot === 'potion').length, 0);

const inventory = new Items();
inventory.create();
const categoriesHeading = inventory.objects.find((object) => object.type === 'text' && object.value === 'CATEGORIES');
const armorButton = inventory.objects.find((object) => object.type === 'rectangle' && object.x === 315 && object.y === 340);
assert.ok(categoriesHeading && armorButton && armorButton.y - categoriesHeading.y >= 70);
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
const firstPack = equipment.grantPotionPack(POTION_ITEMS[0].id);
roster.openEquipment(GameState.roster.find((hero) => hero.id === roster.heroId), 'potion');
const equipmentClose = roster.objects.find((object) => !object.destroyed && object.type === 'text' && object.value === 'X');
const equipmentRow = roster.objects.find((object) => !object.destroyed && object.type === 'rectangle' && object.value === 1260 && object.y === 395);
const equipButton = roster.objects.find((object) => !object.destroyed && object.type === 'rectangle' && object.x === 1680 && object.y === 395);
assert.ok(equipmentClose && equipmentClose.x > 1800 && equipmentClose.y < 230);
assert.ok(equipmentRow && equipButton && equipButton.x + equipButton.value / 2 < equipmentRow.x + equipmentRow.value / 2);
equipment.grantPotionPack(POTION_ITEMS[0].id);
equipment.grantPotionPack(POTION_ITEMS[0].id);
assert.equal(equipment.equipItem(roster.heroId, firstPack.id).ok, true);
roster.openEquipment(GameState.roster.find((hero) => hero.id === roster.heroId), 'potion');
const visibleText = roster.objects.filter((object) => !object.destroyed && object.type === 'text');
assert.equal(visibleText.filter((object) => object.value === 'UNEQUIP CURRENT').length, 1);
assert.equal(visibleText.filter((object) => object.value === 'EQUIP' && object.x === 1680).length, 2);
assert.equal(roster.objects.filter((object) => !object.destroyed && object.type === 'rectangle' && object.value === 1260).length, 2);
console.log('Facility menus, empty shops, inventory, and four equipment slots passed.');
