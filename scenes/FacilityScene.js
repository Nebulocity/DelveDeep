// This is the shared shop workspace. The selected facility supplies stock, theme and
// allowed actions. List scrolling changes row positions; clipping and input checks keep
// rows outside the visible window from receiving a tap.

import Phaser from 'phaser';
import { FACILITIES, renderFacilityMenu } from '../ui/FacilityMenu.js';
import GameState from '../game/GameState.js';
import { saveProfile } from '../game/GameStorage.js';
import { buyPotionPack, equipmentOwner, equipmentStatsText } from '../game/Equipment.js';
import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { POTION_ITEMS, CRAFTING_RECIPES } from '../data/items.js';

import { ACTIVE_ENCHANTMENTS, ENCHANTMENT_BY_ID } from '../data/enchantments.js';
import { bindSelectionDetails } from '../ui/SelectionDetails.js';
import { addCategoryIcon } from '../ui/FacilityChoiceArt.js';
import { addFacilityDetailsHint } from '../ui/FacilityChrome.js';
import { hallScroll } from '../ui/HallUI.js';
import HapticsService from '../services/HapticsService.js';
import { canCraft, craftItem, recipeIngredientText } from '../game/Crafting.js';

import { GEAR_STOCK, saleRows, sellOwnedItem, sellAllOwnedItem, buyGear, inscribeEnchantment, applyEnchantment, disenchantItem } from '../game/ShopServices.js';

const THEMES = {
  Blacksmith: { panel: 0x1b2023, face: 0x353535, edge: 0xd58b55, text: '#fff0d8' },
  Alchemist: { panel: 0x14271f, face: 0x294b36, edge: 0x9fbd78, text: '#eff9d7' },
  Enchanter: { panel: 0x201a31, face: 0x403152, edge: 0xb69ada, text: '#f3eaff' }
};

const CATEGORIES = {
  all: ['All items', 'satchel'], weapon: ['Weapons', 'sword'], armor: ['Armor', 'shield'],
  accessory: ['Accessories', 'rune'], potion: ['Potions', 'flask'], material: ['Materials', 'ingot'], scroll: ['Scrolls', 'scroll']
};

export default class FacilityScene extends Phaser.Scene {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods.
  constructor(key = 'FacilityScene') { super(key); }

  // Read the data supplied when this scene starts before creating its screen contents.
  init(data) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.facility = FACILITIES[data?.title] ?? FACILITIES.Alchemist;
    this.returnScene = data?.returnScene ?? 'TownScene';
    this.selection = null;
    this.category = 'all';
    this.itemOffset = 0;
    this.message = '';
    this.selectedScroll = null;
  }

  // We build this screen and connect its input after the queued assets are ready. Display
  // objects belong to this scene and are removed when the scene shuts down.
  create() { this.render(); }

  // Build the visible workspace from the current selection, page and game state.
  render() {
    renderFacilityMenu(this, this.facility, this.selection,
      selection => {
        this.selection = selection;
        this.category = 'all';
        this.itemOffset = 0;
        this.message = '';
        this.selectedScroll = null;
        this.render();
      },
      () => this.scene.start(this.returnScene),
      choice => this.renderFacilityDetail(choice));
  }

  // Run the requested shop action through the shared rules, then refresh resources and
  // feedback.
  transact(action) {
    HapticsService.tap();
    const result = action();
    this.message = result.message;

    if (result.ok) {
      saveProfile();
      HapticsService.confirm();
    }
    this.render();
  }

  // Build the item rows for this facility's selected action and category.
  rowsFor(choice) {
    const state = GameState;
    if (choice.id === 'sell') return saleRows().map(row => ({
      ...row, action: `SELL: ${row.value}g`, run: () => sellOwnedItem(row.id),
      allAction: `SELL ALL: ${row.allValue}g`, runAll: () => sellAllOwnedItem(row.id)
    }));
    if (choice.id === 'craft' || choice.id === 'brew') return CRAFTING_RECIPES.filter(recipe => choice.id === 'brew'
      ? recipe.category === 'alchemy' : ['equipment', 'material'].includes(recipe.category)).map(recipe => ({
      id: recipe.id,
      category: recipe.output.type === 'potion' ? 'potion' : recipe.output.type === 'material' ? 'material'
        : recipe.output.type === 'scroll' ? 'scroll' : GEAR_STOCK.find(item => item.id === recipe.output.itemId)?.slot,
      name: recipe.name,
      description: `${recipeIngredientText(recipe)}${recipe.fee ? ` | ${recipe.fee} Gold fee` : ''}${recipe.knownAtStart ? '' : ' | Learn by buying the item or recipe'}`,
      enabled: canCraft(recipe.id).ok, action: choice.id === 'brew' ? 'BREW' : 'CRAFT', run: () => craftItem(recipe.id)
    }));

    if (choice.id === 'buy' && this.facility.name !== 'Enchanter') return (this.facility.name === 'Blacksmith' ? GEAR_STOCK : POTION_ITEMS).map(item => ({
      id: item.id, category: item.slot, name: item.name, description: `${item.description} ${item.uses ? '| 3 uses' : equipmentStatsText(item.stats)}`,
      enabled: state.gold >= item.price, action: `BUY ${item.price}g`, run: () => item.slot === 'potion' ? buyPotionPack(item.id) : buyGear(item.id)
    }));

    if (choice.id === 'buy' || choice.id === 'inscribe') return ACTIVE_ENCHANTMENTS.map(definition => ({
      id: definition.id, category: 'scroll', name: `${definition.name} Scroll`,
      description: `${definition.description} ${choice.id === 'inscribe' ? `${recipeIngredientText(definition)}${definition.craftingFee ? ` | ${definition.craftingFee} Gold fee` : ''}` : 'Consume at Enchant to improve gear.'}`,
      enabled: choice.id === 'buy' ? state.gold >= definition.price
        : state.inventory.knownRecipes?.includes(CRAFTING_RECIPES.find(recipe => recipe.output.itemId === definition.id)?.id)
          && state.gold >= definition.craftingFee
          && Object.entries(definition.ingredients).every(([id, count]) => (state.inventory.materials[id] ?? 0) >= count),
      action: choice.id === 'buy' ? `BUY ${definition.price}g`
        : state.inventory.knownRecipes?.includes(CRAFTING_RECIPES.find(recipe => recipe.output.itemId === definition.id)?.id) ? 'INSCRIBE' : 'LEARN',

      // Run the chosen action after the surrounding interaction accepts it.
      run: () => inscribeEnchantment(definition.id, state, choice.id === 'buy')
    }));

    if (choice.id === 'disenchant') return state.inventory.equipment.filter(item => item.slot !== 'scroll' && ENCHANTMENT_BY_ID[item.enchantmentId]).map(item => ({
      id: item.id, category: item.slot, name: item.name, description: `${ENCHANTMENT_BY_ID[item.enchantmentId].name} | Keep gear; recover 2 random recipe materials.`, enabled: true, action: 'DISENCHANT', run: () => disenchantItem(item.id)
    }));

    if (choice.id === 'enchant') {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const scroll = state.inventory.equipment.find(item => item.id === this.selectedScroll && item.slot === 'scroll');
      if (!scroll) return state.inventory.equipment.filter(item => item.slot === 'scroll').map(item => ({
        id: item.id, category: 'scroll', name: item.name, description: ENCHANTMENT_BY_ID[item.enchantmentId].description, enabled: true, action: 'SELECT',

        // Run the chosen action after the surrounding interaction accepts it.
        run: () => {
          this.selectedScroll = item.id;
          this.category = 'all';
          this.itemOffset = 0;
          return { ok: false, message: 'Choose gear to enchant. The selected scroll will be consumed.' };
        }
      }));

      const definition = ENCHANTMENT_BY_ID[scroll.enchantmentId];

      // map builds one output entry for each input entry, in the same order. The
      // callback's return value becomes that output entry. filter keeps entries whose
      // callback returns true. It builds a new list and leaves the original list in place.
      return state.inventory.equipment.filter(item => !item.enchantmentId && definition.slots.includes(item.slot)).map(item => {
        const owner = equipmentOwner(item.id, state);

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        const ownership = owner ? `Equipped by ${owner.name}` : 'Unequipped';
        return {
          id: item.id, category: item.slot, name: item.name,
          description: `${ownership} | ${definition.description}`,
          detailsDescription: `${ownership}\n\n${definition.description} Uses ${scroll.name}.`,
          enabled: true, action: 'ENCHANT',

          // Run the chosen action after the surrounding interaction accepts it.
          run: () => {
            const result = applyEnchantment(scroll.id, item.id);
            if (result.ok) this.selectedScroll = null;
            return result;
          }
        };
      });
    }

    return [];
  }

  // Display the selected facility item's details and available transaction controls.
  renderFacilityDetail(choice) {
    const theme = THEMES[this.facility.name];
    const allRows = this.rowsFor(choice);

    // ... expands these entries into the new list or call. It does not deep-copy the
    // objects inside. filter keeps entries whose callback returns true. It builds a new
    // list and leaves the original list in place.
    const categories = ['all', ...Object.keys(CATEGORIES).filter(key => key !== 'all' && allRows.some(row => row.category === key))];
    if (!categories.includes(this.category)) this.category = 'all';
    const rows = allRows.filter(row => this.category === 'all' || row.category === this.category);

    this.add.rectangle(1200, 553, 2280, 690, theme.panel, 0.97).setStrokeStyle(4, theme.edge);

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner. The condition before ? chooses the first value when true and the value after
    // : when false.
    const heading = this.add.text(255, 252, choice.id === 'sell' ? 'YOUR INVENTORY' : choice.label, { fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('heading42'), fontStyle: UI_FONT_WEIGHTS.bold, color: theme.text }).setOrigin(0.5);
    if (heading.width > 330) heading.setScale(330 / heading.width);
    addFacilityDetailsHint(this, this.facility.name, 252, { x: 1400 });
    this.add.rectangle(255, 578, 350, 570, theme.face, 0.45).setStrokeStyle(2, theme.edge, 0.45);
    categories.forEach((category, index) => {
      const y = 333 + index * 76;

      // The brackets unpack entries by position; their order matters.
      const [label, icon] = CATEGORIES[category];
      const active = category === this.category;

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const button = this.add.rectangle(255, y, 330, 68, theme.face, active ? 1 : 0.25).setStrokeStyle(active ? 3 : 1, theme.edge, active ? 1 : 0.25);
      addCategoryIcon(this, icon, 118, y, theme.edge);

      // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
      // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the
      // object's corner.
      this.add.text(154, y, label, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('shopCategory'), color: theme.text }).setOrigin(0, 0.5);
      bindSelectionDetails(this, button, { title: label, description: `Browse ${label.toLowerCase()}.`, shopTheme: theme }, () => {
        HapticsService.tap();
        this.category = category;
        this.itemOffset = 0;
        this.render();
      });
    });

    if (!rows.length) this.add.text(1400, 520, choice.id === 'sell' ? 'No owned items in this category.' : choice.id === 'disenchant' ? 'No gear with known enchantments.' : choice.id === 'enchant' ? this.selectedScroll ? 'No compatible gear without an enchantment.\nChoose Enchant again to select another scroll.' : 'Buy or inscribe a scroll to begin.' : 'Nothing available.', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body34'), color: theme.text, align: 'center', wordWrap: { width: 1450 } }).setOrigin(0.5);
    const start = this.children.list.length;
    const stride = 264;
    rows.forEach((row, index) => {

      // % gives the remainder. With a nonnegative index and positive list length, it wraps
      // the index back to the start of the list.
      const x = 962 + index % 2 * 900;

      // Math.floor rounds toward the smaller whole number, so 3.8 becomes 3.
      const y = 416 + Math.floor(index / 2) * stride;
      const card = this.add.rectangle(x, y, 872, 246, theme.face, 0.64).setStrokeStyle(2, theme.edge, 0.7).setName(`shop-item-${row.id}`);

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact. ?. only follows this link when the value exists; a missing optional value
      // gives undefined.
      addCategoryIcon(this, CATEGORIES[row.category]?.[1] ?? 'satchel', x - 399, y - 81, theme.edge);

      // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
      // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the
      // object's corner.
      this.add.text(x - 363, y - 106, row.name, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body34'), fontStyle: UI_FONT_WEIGHTS.bold, color: theme.text,
        wordWrap: { width: 770 }, maxLines: 2 }).setOrigin(0, 0);
      this.add.text(x - 409, y - 16, row.description, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('shopDescription'), color: '#ddd5c7', wordWrap: { width: 804 }, maxLines: 2 });
      const details = { title: row.name, description: row.detailsDescription ?? row.description, shopTheme: theme };
      bindSelectionDetails(this, card, details);

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const button = this.add.rectangle(x + 247, y + 82, 330, 68, theme.face).setStrokeStyle(3, theme.edge).setAlpha(row.enabled ? 1 : 0.45).setName(`shop-action-${row.id}`);
      this.add.text(x + 247, y + 82, row.action, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('shopCost'), fontStyle: UI_FONT_WEIGHTS.bold,
        color: row.enabled ? '#fff3c4' : '#d4c8b0' }).setOrigin(0.5);

      if (row.enabled) bindSelectionDetails(this, button, details, () => this.transact(row.run));

      // Keep the single-sale control on the right and place bulk selling on the left.
      // Both controls travel with the card inside the existing masked scroll region.
      if (row.runAll) {
        const allButton = this.add.rectangle(x - 224, y + 82, 376, 68, theme.face)
          .setStrokeStyle(3, theme.edge).setAlpha(row.enabled ? 1 : 0.45).setName(`shop-sell-all-${row.id}`);
        this.add.text(x - 224, y + 82, row.allAction, {
          fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('shopCost'), fontStyle: UI_FONT_WEIGHTS.bold,
          color: row.enabled ? '#fff3c4' : '#d4c8b0'
        }).setOrigin(0.5);

        if (row.enabled) bindSelectionDetails(this, allButton, details, () => this.transact(row.runAll));
      }
    });

    const surface = (scene, x, y, width, height, variant) => scene.add.rectangle(x, y, width, height,
      variant === 'thumb' ? theme.edge : theme.face, variant === 'thumb' ? 1 : 0.65).setStrokeStyle(2, theme.edge, 0.7);

    // Math.ceil rounds upward to the next integer, including when the value has a
    // fractional part.
    this.itemList = hallScroll(this, { x: 516, y: 291, width: 1794, height: 548 },
      this.children.list.slice(start), Math.ceil(rows.length / 2) * stride, this.itemOffset,
      value => { this.itemOffset = value; }, surface);
    this.add.text(1400, 868, this.message || `${rows.length} items · Drag or scroll to browse`, { fontFamily: UI_FONT_FAMILIES.sans,
      fontSize: fontPx('shopPager'), color: theme.text, align: 'center', wordWrap: { width: 1700 } }).setOrigin(0.5);

    return { x: 1200, y: 553, width: 2280, height: 690 };
  }
}
