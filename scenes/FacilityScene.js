import Phaser from 'phaser';
import { FACILITIES, renderFacilityMenu } from '../ui/FacilityMenu.js';
import GameState from '../game/GameState.js';
import { saveProfile } from '../game/GameStorage.js';
import { buyPotionPack, equipmentOwner, equipmentStatsText } from '../game/Equipment.js';
import { UI_FONT_SIZES } from '../config/uiTypography.js';
import { POTION_ITEMS, CRAFTING_RECIPES } from '../data/items.js';
import { ENCHANTMENTS, ENCHANTMENT_BY_ID } from '../data/enchantments.js';
import { bindSelectionDetails } from '../ui/SelectionDetails.js';
import { addCategoryIcon } from '../ui/FacilityChoiceArt.js';
import { addFacilityDetailsHint } from '../ui/FacilityChrome.js';
import HapticsService from '../services/HapticsService.js';
import { canCraft, craftItem, recipeIngredientText } from '../game/Crafting.js';
import { GEAR_STOCK, saleRows, sellOwnedItem, buyGear, inscribeEnchantment, applyEnchantment, disenchantItem } from '../game/ShopServices.js';

const THEMES = {
  Blacksmith: { panel: 0x1b2023, face: 0x353535, edge: 0xd58b55, text: '#fff0d8', plaque: 'town-sign-blacksmith' },
  Alchemist: { panel: 0x14271f, face: 0x294b36, edge: 0x9fbd78, text: '#eff9d7', plaque: 'town-sign-alchemist' },
  Enchanter: { panel: 0x201a31, face: 0x403152, edge: 0xb69ada, text: '#f3eaff', plaque: 'town-sign-enchanter' }
};
const CATEGORIES = {
  all: ['All items', 'satchel'], weapon: ['Weapons', 'sword'], armor: ['Armor', 'shield'],
  accessory: ['Accessories', 'rune'], potion: ['Potions', 'flask'], material: ['Materials', 'ingot'], scroll: ['Scrolls', 'scroll']
};

export default class FacilityScene extends Phaser.Scene {
  constructor(key = 'FacilityScene') { super(key); }

  init(data) {
    this.facility = FACILITIES[data?.title] ?? FACILITIES.Alchemist;
    this.returnScene = data?.returnScene ?? 'TownScene';
    this.selection = null;
    this.category = 'all';
    this.page = 0;
    this.message = '';
    this.selectedScroll = null;
  }

  create() { this.render(); }

  render() {
    renderFacilityMenu(this, this.facility, this.selection,
      selection => { this.selection = selection; this.category = 'all'; this.page = 0; this.message = ''; this.selectedScroll = null; this.render(); },
      () => this.scene.start(this.returnScene),
      () => { this.selection = null; this.render(); },
      choice => this.renderFacilityDetail(choice));
  }

  transact(action) {
    HapticsService.tap();
    const result = action();
    this.message = result.message;
    if (result.ok) { saveProfile(); HapticsService.confirm(); }
    this.render();
  }

  rowsFor(choice) {
    const state = GameState;
    if (choice.id === 'sell') return saleRows().map(row => ({ ...row, action: `SELL ${row.value}g`, run: () => sellOwnedItem(row.id) }));
    if (choice.id === 'craft' || choice.id === 'brew') return CRAFTING_RECIPES.filter(recipe => recipe.category === (choice.id === 'brew' ? 'alchemy' : 'equipment')).map(recipe => ({
      id: recipe.id, category: choice.id === 'brew' ? 'potion' : GEAR_STOCK.find(item => item.id === recipe.output.itemId)?.slot,
      name: recipe.name, description: `${choice.id === 'brew' ? '3 potions | ' : ''}${recipeIngredientText(recipe)}`,
      enabled: canCraft(recipe.id).ok, action: choice.id === 'brew' ? 'BREW' : 'CRAFT', run: () => craftItem(recipe.id)
    }));
    if (choice.id === 'buy' && this.facility.name !== 'Enchanter') return (this.facility.name === 'Blacksmith' ? GEAR_STOCK : POTION_ITEMS).map(item => ({
      id: item.id, category: item.slot, name: item.name, description: `${item.description} ${item.uses ? '| 3 uses' : equipmentStatsText(item.stats)}`,
      enabled: state.gold >= item.price, action: `BUY ${item.price}g`, run: () => item.slot === 'potion' ? buyPotionPack(item.id) : buyGear(item.id)
    }));
    if (choice.id === 'buy' || choice.id === 'inscribe') return ENCHANTMENTS.map(definition => ({
      id: definition.id, category: 'scroll', name: `${definition.name} Scroll`,
      description: `${definition.description} ${choice.id === 'inscribe' ? recipeIngredientText(definition) : 'Consume at Enchant to improve gear.'}`,
      enabled: choice.id === 'buy' ? state.gold >= definition.price : Object.entries(definition.ingredients).every(([id, count]) => (state.inventory.materials[id] ?? 0) >= count),
      action: choice.id === 'buy' ? `BUY ${definition.price}g` : 'INSCRIBE', run: () => inscribeEnchantment(definition.id, state, choice.id === 'buy')
    }));
    if (choice.id === 'disenchant') return state.inventory.equipment.filter(item => item.slot !== 'scroll' && ENCHANTMENT_BY_ID[item.enchantmentId]).map(item => ({
      id: item.id, category: item.slot, name: item.name, description: `${ENCHANTMENT_BY_ID[item.enchantmentId].name} | Keep gear; recover 2 random recipe materials.`, enabled: true, action: 'DISENCHANT', run: () => disenchantItem(item.id)
    }));
    if (choice.id === 'enchant') {
      const scroll = state.inventory.equipment.find(item => item.id === this.selectedScroll && item.slot === 'scroll');
      if (!scroll) return state.inventory.equipment.filter(item => item.slot === 'scroll').map(item => ({
        id: item.id, category: 'scroll', name: item.name, description: ENCHANTMENT_BY_ID[item.enchantmentId].description, enabled: true, action: 'SELECT',
        run: () => { this.selectedScroll = item.id; this.category = 'all'; this.page = 0; return { ok: false, message: 'Choose gear to enchant. The selected scroll will be consumed.' }; }
      }));
      const definition = ENCHANTMENT_BY_ID[scroll.enchantmentId];
      return state.inventory.equipment.filter(item => !item.enchantmentId && definition.slots.includes(item.slot)).map(item => {
        const owner = equipmentOwner(item.id, state);
        const ownership = owner ? `Equipped by ${owner.name}` : 'Unequipped';
        return {
          id: item.id, category: item.slot, name: item.name,
          description: `${ownership} | ${definition.description}`,
          detailsDescription: `${ownership}\n\n${definition.description} Uses ${scroll.name}.`,
          enabled: true, action: 'ENCHANT',
          run: () => { const result = applyEnchantment(scroll.id, item.id); if (result.ok) this.selectedScroll = null; return result; }
        };
      });
    }
    return [];
  }

  renderFacilityDetail(choice) {
    const theme = THEMES[this.facility.name];
    const allRows = this.rowsFor(choice);
    const categories = ['all', ...Object.keys(CATEGORIES).filter(key => key !== 'all' && allRows.some(row => row.category === key))];
    if (!categories.includes(this.category)) this.category = 'all';
    const rows = allRows.filter(row => this.category === 'all' || row.category === this.category);
    const pages = Math.max(1, Math.ceil(rows.length / 3));
    this.page = Math.max(0, Math.min(this.page, pages - 1));
    this.add.rectangle(1200, 555, 2080, 490, theme.panel, 0.97).setStrokeStyle(4, theme.edge);
    const heading = this.add.text(395, 342, choice.id === 'sell' ? 'YOUR INVENTORY' : choice.label, { fontFamily: 'Georgia', fontSize: '42px', fontStyle: 'bold', color: theme.text }).setOrigin(0.5);
    if (heading.width > 380) heading.setScale(380 / heading.width);
    addFacilityDetailsHint(this, this.facility.name, 342, { x: 1400 });
    this.add.rectangle(395, 575, 390, 384, theme.face, 0.45).setStrokeStyle(2, theme.edge, 0.45);
    categories.forEach((category, index) => {
      const y = 405 + index * 52;
      const [label, icon] = CATEGORIES[category];
      const active = category === this.category;
      const button = this.add.rectangle(395, y, 360, 48, theme.face, active ? 1 : 0.25).setStrokeStyle(active ? 3 : 1, theme.edge, active ? 1 : 0.25);
      addCategoryIcon(this, icon, 251, y, theme.edge);
      this.add.text(288, y, label, { fontFamily: 'Arial', fontSize: '30px', color: theme.text }).setOrigin(0, 0.5);
      bindSelectionDetails(this, button, { title: label, description: `Browse ${label.toLowerCase()}.`, shopTheme: theme }, () => { HapticsService.tap(); this.category = category; this.page = 0; this.render(); });
    });
    if (!rows.length) this.add.text(1400, 520, choice.id === 'sell' ? 'No owned items in this category.' : choice.id === 'disenchant' ? 'No gear with known enchantments.' : choice.id === 'enchant' ? this.selectedScroll ? 'No compatible gear without an enchantment.\nChoose Enchant again to select another scroll.' : 'Buy or inscribe a scroll to begin.' : 'Nothing available.', { fontFamily: 'Arial', fontSize: '34px', color: theme.text, align: 'center', wordWrap: { width: 1450 } }).setOrigin(0.5);
    rows.slice(this.page * 3, this.page * 3 + 3).forEach((row, index) => {
      const y = 430 + index * 118;
      const card = this.add.rectangle(1400, y, 1520, 112, theme.face, 0.64).setStrokeStyle(2, theme.edge, 0.7);
      addCategoryIcon(this, CATEGORIES[row.category]?.[1] ?? 'satchel', 686, y, theme.edge);
      this.add.text(728, y - 25, row.name, { fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: theme.text }).setOrigin(0, 0.5);
      this.add.text(728, y + 0, row.description, { fontFamily: 'Arial', fontSize: `${UI_FONT_SIZES.itemDescription}px`, color: '#ddd5c7', wordWrap: { width: 1080 } });
      const details = { title: row.name, description: row.detailsDescription ?? row.description, shopTheme: theme };
      bindSelectionDetails(this, card, details);
      const button = this.add.rectangle(1990, y, 285, 86, theme.face).setStrokeStyle(3, theme.edge).setAlpha(row.enabled ? 1 : 0.45);
      this.add.text(1990, y, row.action, { fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', color: theme.text }).setOrigin(0.5).setAlpha(row.enabled ? 1 : 0.55);
      if (row.enabled) bindSelectionDetails(this, button, details, () => this.transact(row.run));
    });
    this.add.text(1400, 759, this.message || `${this.page + 1} / ${pages}`, { fontFamily: 'Arial', fontSize: '27px', color: theme.text, align: 'center', wordWrap: { width: 1000 } }).setOrigin(0.5);
    for (const [x, label, delta] of [[760, 'PREV', -1], [2040, 'NEXT >', 1]]) {
      const enabled = this.page + delta >= 0 && this.page + delta < pages;
      const button = this.add.rectangle(x, 765, 195, 62, theme.face).setStrokeStyle(2, theme.edge).setAlpha(enabled ? 1 : 0.4);
      this.add.text(x, 765, label, { fontFamily: 'Arial', fontSize: '28px', color: theme.text }).setOrigin(0.5);
      if (enabled) bindSelectionDetails(this, button, { title: label, description: 'Browse more items.', shopTheme: theme }, () => { HapticsService.tap(); this.page += delta; this.render(); });
    }
    return { x: 1200, y: 555, width: 2080, height: 490 };
  }
}
