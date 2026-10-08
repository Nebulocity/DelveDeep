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
import { GEAR_STOCK, saleRows, sellOwnedItem, buyGear, inscribeEnchantment, applyEnchantment, disenchantItem } from '../game/ShopServices.js';

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
  constructor(key = 'FacilityScene') { super(key); }

  init(data) {
    this.facility = FACILITIES[data?.title] ?? FACILITIES.Alchemist;
    this.returnScene = data?.returnScene ?? 'TownScene';
    this.selection = null;
    this.category = 'all';
    this.itemOffset = 0;
    this.message = '';
    this.selectedScroll = null;
  }

  create() { this.render(); }

  render() {
    renderFacilityMenu(this, this.facility, this.selection,
      selection => { this.selection = selection; this.category = 'all'; this.itemOffset = 0; this.message = ''; this.selectedScroll = null; this.render(); },
      () => this.scene.start(this.returnScene),
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
      run: () => inscribeEnchantment(definition.id, state, choice.id === 'buy')
    }));
    if (choice.id === 'disenchant') return state.inventory.equipment.filter(item => item.slot !== 'scroll' && ENCHANTMENT_BY_ID[item.enchantmentId]).map(item => ({
      id: item.id, category: item.slot, name: item.name, description: `${ENCHANTMENT_BY_ID[item.enchantmentId].name} | Keep gear; recover 2 random recipe materials.`, enabled: true, action: 'DISENCHANT', run: () => disenchantItem(item.id)
    }));
    if (choice.id === 'enchant') {
      const scroll = state.inventory.equipment.find(item => item.id === this.selectedScroll && item.slot === 'scroll');
      if (!scroll) return state.inventory.equipment.filter(item => item.slot === 'scroll').map(item => ({
        id: item.id, category: 'scroll', name: item.name, description: ENCHANTMENT_BY_ID[item.enchantmentId].description, enabled: true, action: 'SELECT',
        run: () => { this.selectedScroll = item.id; this.category = 'all'; this.itemOffset = 0; return { ok: false, message: 'Choose gear to enchant. The selected scroll will be consumed.' }; }
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

    this.add.rectangle(1200, 553, 2280, 690, theme.panel, 0.97).setStrokeStyle(4, theme.edge);
    const heading = this.add.text(255, 252, choice.id === 'sell' ? 'YOUR INVENTORY' : choice.label, { fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('heading42'), fontStyle: UI_FONT_WEIGHTS.bold, color: theme.text }).setOrigin(0.5);
    if (heading.width > 330) heading.setScale(330 / heading.width);
    addFacilityDetailsHint(this, this.facility.name, 252, { x: 1400 });
    this.add.rectangle(255, 578, 350, 570, theme.face, 0.45).setStrokeStyle(2, theme.edge, 0.45);
    categories.forEach((category, index) => {
      const y = 333 + index * 76;
      const [label, icon] = CATEGORIES[category];
      const active = category === this.category;
      const button = this.add.rectangle(255, y, 330, 68, theme.face, active ? 1 : 0.25).setStrokeStyle(active ? 3 : 1, theme.edge, active ? 1 : 0.25);
      addCategoryIcon(this, icon, 118, y, theme.edge);
      this.add.text(154, y, label, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('shopCategory'), color: theme.text }).setOrigin(0, 0.5);
      bindSelectionDetails(this, button, { title: label, description: `Browse ${label.toLowerCase()}.`, shopTheme: theme }, () => { HapticsService.tap(); this.category = category; this.itemOffset = 0; this.render(); });
    });
    if (!rows.length) this.add.text(1400, 520, choice.id === 'sell' ? 'No owned items in this category.' : choice.id === 'disenchant' ? 'No gear with known enchantments.' : choice.id === 'enchant' ? this.selectedScroll ? 'No compatible gear without an enchantment.\nChoose Enchant again to select another scroll.' : 'Buy or inscribe a scroll to begin.' : 'Nothing available.', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body34'), color: theme.text, align: 'center', wordWrap: { width: 1450 } }).setOrigin(0.5);
    const start = this.children.list.length;
    const stride = 264;
    rows.forEach((row, index) => {
      const x = 962 + index % 2 * 900;
      const y = 416 + Math.floor(index / 2) * stride;
      const card = this.add.rectangle(x, y, 872, 246, theme.face, 0.64).setStrokeStyle(2, theme.edge, 0.7).setName(`shop-item-${row.id}`);
      addCategoryIcon(this, CATEGORIES[row.category]?.[1] ?? 'satchel', x - 399, y - 81, theme.edge);
      this.add.text(x - 363, y - 106, row.name, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body34'), fontStyle: UI_FONT_WEIGHTS.bold, color: theme.text,
        wordWrap: { width: 770 }, maxLines: 2 }).setOrigin(0, 0);
      this.add.text(x - 409, y - 16, row.description, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('shopDescription'), color: '#ddd5c7', wordWrap: { width: 804 }, maxLines: 2 });
      const details = { title: row.name, description: row.detailsDescription ?? row.description, shopTheme: theme };
      bindSelectionDetails(this, card, details);
      const button = this.add.rectangle(x + 247, y + 82, 330, 68, theme.face).setStrokeStyle(3, theme.edge).setAlpha(row.enabled ? 1 : 0.45).setName(`shop-action-${row.id}`);
      this.add.text(x + 247, y + 82, row.action, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('shopCost'), fontStyle: UI_FONT_WEIGHTS.bold,
        color: row.enabled ? '#fff3c4' : '#d4c8b0' }).setOrigin(0.5);
      if (row.enabled) bindSelectionDetails(this, button, details, () => this.transact(row.run));
    });
    const surface = (scene, x, y, width, height, variant) => scene.add.rectangle(x, y, width, height,
      variant === 'thumb' ? theme.edge : theme.face, variant === 'thumb' ? 1 : 0.65).setStrokeStyle(2, theme.edge, 0.7);
    this.itemList = hallScroll(this, { x: 516, y: 291, width: 1794, height: 548 },
      this.children.list.slice(start), Math.ceil(rows.length / 2) * stride, this.itemOffset,
      value => { this.itemOffset = value; }, surface);
    this.add.text(1400, 868, this.message || `${rows.length} items · Drag or scroll to browse`, { fontFamily: UI_FONT_FAMILIES.sans,
      fontSize: fontPx('shopPager'), color: theme.text, align: 'center', wordWrap: { width: 1700 } }).setOrigin(0.5);
    return { x: 1200, y: 553, width: 2280, height: 690 };
  }
}
