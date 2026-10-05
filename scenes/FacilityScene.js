import Phaser from 'phaser';
import { FACILITIES, renderFacilityMenu } from '../ui/FacilityMenu.js';
import GameState from '../game/GameState.js';
import { saveProfile } from '../game/GameStorage.js';
import { buyPotionPack, sellPotionPack, sellMaterial } from '../game/Equipment.js';
import { POTION_ITEMS, getPotionDefinition } from '../data/items.js';
import { bindSelectionDetails } from '../ui/SelectionDetails.js';
import HapticsService from '../services/HapticsService.js';
import { CRAFTING_RECIPES, CRAFTING_MATERIALS } from '../data/items.js';
import { canCraft, craftItem, recipeIngredientText } from '../game/Crafting.js';
import { addWoodenNotice } from '../ui/WoodenPanel.js';

const ALCHEMIST_THEME = { plaque: 'town-sign-alchemist', panel: 0x182b22, face: 0x315b3e, edge: 0x9fbd78, button: 0x315b3e, text: '#eff9d7' };

export default class FacilityScene extends Phaser.Scene {
  constructor(key = 'FacilityScene') {
    super(key);
  }

  init(data) {
    this.facility = FACILITIES[data?.title] ?? FACILITIES.Alchemist;
    this.returnScene = data?.returnScene ?? 'TownScene';
    this.selection = null;
    this.page = 0;
    this.message = '';
  }

  create() {
    this.render();
  }

  render() {
    renderFacilityMenu(this, this.facility, this.selection,
      (selection) => { this.selection = selection; this.page = 0; this.message = ''; this.render(); },
      () => this.scene.start(this.returnScene),
      () => { this.selection = null; this.render(); },
      (choice) => this.renderFacilityDetail(choice));
  }

  renderFacilityDetail(choice) {
    if (this.facility === FACILITIES.Alchemist && (choice.id === 'buy' || choice.id === 'sell')) return this.renderAlchemistDetail(choice);
    if (this.facility === FACILITIES.Blacksmith && (choice.id === 'craft' || choice.id === 'sell')) return this.renderCraftingDetail(choice);
    if (this.facility === FACILITIES.Alchemist && choice.id === 'brew') return this.renderCraftingDetail(choice);
    return false;
  }

  renderCraftingDetail(choice) {
    const crafting = choice.id === 'craft' || choice.id === 'brew';
    const recipes = crafting ? CRAFTING_RECIPES.filter((recipe) => this.facility === FACILITIES.Blacksmith
      ? recipe.category === 'equipment' : recipe.category === 'alchemy') : [];
    const materials = Object.values(CRAFTING_MATERIALS).filter((material) => (GameState.inventory.materials?.[material.id] ?? 0) > 0);
    const rows = crafting ? recipes : materials;
    const pageSize = 3;
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    this.page = Math.max(0, Math.min(this.page, pages - 1));
    const theme = this.facility === FACILITIES.Blacksmith
      ? { panel: 0x292321, edge: 0xd58b55, face: 0x593728, text: '#fff0d8' }
      : ALCHEMIST_THEME;
    this.add.rectangle(1200, 550, 1700, 520, theme.panel, 0.96).setStrokeStyle(4, theme.edge);
    this.add.text(1200, 338, crafting ? 'AVAILABLE RECIPES' : 'MATERIALS', {
      fontFamily: 'Georgia', fontSize: '46px', fontStyle: 'bold', color: theme.text, stroke: '#102018', strokeThickness: 3
    }).setOrigin(0.5);
    if (!rows.length) addWoodenNotice(this, 1200, 555, crafting ? 'No recipes are available.' : 'You have no materials to sell.', { width: 1300, fontSize: 36, depth: 0 });
    rows.slice(this.page * pageSize, this.page * pageSize + pageSize).forEach((row, index) => {
      const y = 435 + index * 123;
      const recipe = crafting ? row : null;
      const stock = !crafting ? GameState.inventory.materials[row.id] : null;
      const readiness = recipe && canCraft(recipe.id);
      const summary = recipe ? `${recipe.category === 'alchemy' ? `3 ${getPotionDefinition(recipe.output.itemId).name}s • ` : ''}${recipeIngredientText(recipe)}` : row.description;
      const action = recipe ? `Craft • ${summary}` : `${row.name} x${stock} • Sell for ${stock * 5} Gold`;
      const card = this.add.rectangle(1200, y, 1580, 106, 0x294034, 0.97).setStrokeStyle(3, theme.edge).setInteractive({ useHandCursor: true });
      this.add.text(470, y - 17, recipe ? recipe.name : row.name, { fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#fff1d2' }).setOrigin(0, 0.5);
      this.add.text(470, y + 23, recipe ? summary : `Owned: ${stock}. ${row.description}`, { fontFamily: 'Arial', fontSize: '30px', color: '#d8e8c5', wordWrap: { width: 1050 } }).setOrigin(0, 0.5);
      bindSelectionDetails(this, card, { title: recipe ? recipe.name : row.name, description: `${recipe?.description ?? row.description} ${action}`, shopTheme: theme });
      const enabled = recipe ? readiness.ok : true;
      const label = recipe ? (enabled ? 'CRAFT' : 'NEED MATERIALS') : `SELL ${stock}`;
      const button = this.add.rectangle(1830, y, 265, 86, enabled ? theme.face : 0x3f4a40).setStrokeStyle(3, theme.edge).setAlpha(enabled ? 1 : 0.55);
      this.add.text(1830, y, label, { fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', color: enabled ? theme.text : '#b0a69b' }).setOrigin(0.5);
      if (enabled) bindSelectionDetails(this, button, { title: recipe?.name ?? row.name, description: action, shopTheme: theme }, () => {
        HapticsService.tap();
        const result = recipe ? craftItem(recipe.id) : sellMaterial(row.id, stock);
        this.message = result.message;
        if (result.ok) { saveProfile(); HapticsService.confirm(); }
        this.render();
      });
    });
    const pageButton = (x, label, page, enabled) => {
      const button = this.add.rectangle(x, 759, 195, 62, 0x6b4527, enabled ? 1 : 0.45).setStrokeStyle(2, theme.edge);
      this.add.text(x, 759, label, { fontFamily: 'Arial', fontSize: '28px', color: theme.text }).setOrigin(0.5);
      if (enabled) bindSelectionDetails(this, button, { title: label, description: 'Browse recipes and materials.' }, () => {
        HapticsService.tap(); this.page = page; this.render();
      });
    };
    pageButton(600, '< PREV', this.page - 1, this.page > 0);
    if (this.message) addWoodenNotice(this, 1200, 759, this.message, { width: 850, fontSize: 28, depth: 0 });
    else this.add.text(1200, 759, `${this.page + 1} / ${pages}`, { fontFamily: 'Arial', fontSize: '28px', color: '#fde68a' }).setOrigin(0.5);
    pageButton(1800, 'NEXT >', this.page + 1, this.page < pages - 1);
    return { x: 1200, y: 550, width: 1700, height: 520 };
  }

  renderAlchemistDetail(choice) {
    if (choice.id !== 'buy' && choice.id !== 'sell') return false;
    const rows = choice.id === 'buy' ? POTION_ITEMS
      : GameState.inventory.equipment.filter((item) => item.slot === 'potion' && getPotionDefinition(item.itemId));
    const pages = Math.max(1, Math.ceil(rows.length / 2));
    this.page = Math.max(0, Math.min(this.page, pages - 1));
    this.add.rectangle(1200, 550, 1700, 520, 0x182b22, 0.95).setStrokeStyle(4, 0x9fbd78);
    this.add.text(1200, 338, choice.id === 'buy' ? 'POTION PACKS' : 'YOUR POTION PACKS', {
      fontFamily: 'Georgia', fontSize: '46px', fontStyle: 'bold', color: '#eff9d7', stroke: '#102018', strokeThickness: 3
    }).setOrigin(0.5);
    if (!rows.length) addWoodenNotice(this, 1200, 555, 'No potion packs to sell.', { width: 1300, fontSize: 36, depth: 0 });
    rows.slice(this.page * 2, this.page * 2 + 2).forEach((item, index) => {
      const definition = choice.id === 'buy' ? item : getPotionDefinition(item.itemId);
      const y = 467 + index * 169;
      const value = choice.id === 'buy' ? definition.price
        : Math.floor(definition.price * 0.5 * item.charges / definition.uses);
      const description = `${definition.description} ${choice.id === 'buy' ? definition.uses : item.charges}/${definition.uses} uses. ${choice.id === 'buy' ? 'Buy' : 'Sell'} for ${value} Gold.`;
      const row = this.add.rectangle(1200, y, 1570, 144, 0x294034, 0.97).setStrokeStyle(3, 0x708d5d).setInteractive({ useHandCursor: true });
      const labelBottom = y + 9;
      const nameText = this.add.text(490, labelBottom, definition.name, {
        fontFamily: 'Arial', fontSize: '37px', fontStyle: 'bold', color: '#fff1d2'
      }).setOrigin(0, 1);
      const countX = 490 + Math.min(nameText.width, definition.name.length * 22) + 18;
      this.add.rectangle(countX, labelBottom, 64, 42, 0x315b3e)
        .setStrokeStyle(2, 0xb7d494).setOrigin(0, 1);
      this.add.text(countX + 32, labelBottom - 21,
        `x${choice.id === 'buy' ? definition.uses : item.charges}`, {
          fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', color: '#dcfce7'
        }).setOrigin(0.5);
      this.add.text(490, y + 18, choice.id === 'buy' ? definition.description : `${item.charges}/${definition.uses} uses remaining`, {
        fontFamily: 'Arial', fontSize: '30px', color: '#d8e8c5', wordWrap: { width: 1060 }
      });
      bindSelectionDetails(this, row, { title: definition.name, description, shopTheme: ALCHEMIST_THEME });
      const affordable = choice.id !== 'buy' || GameState.gold >= value;
      const button = this.add.rectangle(1810, y, 255, 86, affordable ? 0x315b3e : 0x3f4a40)
        .setStrokeStyle(4, affordable ? 0xb7d494 : 0x74806f);
      this.add.text(1810, y, `${choice.id === 'buy' ? 'Buy' : 'Sell'}: ${value}g`, {
        fontFamily: 'Georgia', fontSize: '29px', fontStyle: 'bold', color: affordable ? '#eff9d7' : '#b0a69b'
      }).setOrigin(0.5);
      if (affordable) bindSelectionDetails(this, button, { title: definition.name, description, shopTheme: ALCHEMIST_THEME }, () => {
        HapticsService.tap();
        const result = choice.id === 'buy' ? buyPotionPack(definition.id) : sellPotionPack(item.id);
        this.message = result.message;
        if (result.ok) { saveProfile(); HapticsService.confirm(); }
        this.render();
      });
    });
    const pageButton = (x, label, page, enabled) => {
      const button = this.add.rectangle(x, 759, 195, 62, 0x6b4527, enabled ? 1 : 0.45).setStrokeStyle(2, 0xd9a662);
      this.add.text(x, 759, label, { fontFamily: 'Arial', fontSize: '28px', color: '#fff1d2' }).setOrigin(0.5);
      if (enabled) bindSelectionDetails(this, button, { title: label, description: 'Browse potion packs.' }, () => {
        HapticsService.tap(); this.page = page; this.render();
      });
    };
    pageButton(600, '< PREV', this.page - 1, this.page > 0);
    if (this.message) addWoodenNotice(this, 1200, 759, this.message, { width: 850, fontSize: 28, depth: 0 });
    else this.add.text(1200, 759, `${this.page + 1} / ${pages}`, { fontFamily: 'Arial', fontSize: '29px', color: '#fde68a' }).setOrigin(0.5);
    pageButton(1800, 'NEXT >', this.page + 1, this.page < pages - 1);
    return { x: 1200, y: 550, width: 1700, height: 520 };
  }
}
