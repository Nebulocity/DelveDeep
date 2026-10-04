import Phaser from 'phaser';
import { FACILITIES, renderFacilityMenu } from '../ui/FacilityMenu.js';
import GameState from '../game/GameState.js';
import { saveProfile } from '../game/GameStorage.js';
import { buyPotionPack, sellPotionPack } from '../game/Equipment.js';
import { POTION_ITEMS, getPotionDefinition } from '../data/items.js';
import { bindSelectionDetails } from '../ui/SelectionDetails.js';
import HapticsService from '../services/HapticsService.js';

export default class FacilityScene extends Phaser.Scene {
  constructor() {
    super('FacilityScene');
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
      (choice) => this.facility === FACILITIES.Alchemist && this.renderAlchemistDetail(choice));
  }

  renderAlchemistDetail(choice) {
    if (choice.id !== 'buy' && choice.id !== 'sell') return false;
    const rows = choice.id === 'buy' ? POTION_ITEMS
      : GameState.inventory.equipment.filter((item) => item.slot === 'potion' && getPotionDefinition(item.itemId));
    const pages = Math.max(1, Math.ceil(rows.length / 2));
    this.page = Math.max(0, Math.min(this.page, pages - 1));
    this.add.rectangle(1200, 550, 1700, 520, 0x21130d, 0.95).setStrokeStyle(4, 0xd9a662);
    this.add.text(1200, 338, choice.id === 'buy' ? 'POTION PACKS' : 'YOUR POTION PACKS', {
      fontFamily: 'Arial', fontSize: '46px', fontStyle: 'bold', color: '#fff1d2'
    }).setOrigin(0.5);
    if (!rows.length) this.add.text(1200, 555, 'No potion packs to sell.', {
      fontFamily: 'Arial', fontSize: '36px', color: '#e8c89f'
    }).setOrigin(0.5);
    rows.slice(this.page * 2, this.page * 2 + 2).forEach((item, index) => {
      const definition = choice.id === 'buy' ? item : getPotionDefinition(item.itemId);
      const y = 467 + index * 169;
      const value = choice.id === 'buy' ? definition.price
        : Math.floor(definition.price * 0.5 * item.charges / definition.uses);
      const description = `${definition.description} ${choice.id === 'buy' ? definition.uses : item.charges}/${definition.uses} uses. ${choice.id === 'buy' ? 'Buy' : 'Sell'} for ${value} Gold.`;
      this.add.rectangle(1200, y, 1570, 144, 0x382315, 0.96).setStrokeStyle(2, 0x9b6b3b);
      const labelBottom = y + 9;
      const nameText = this.add.text(490, labelBottom, definition.name, {
        fontFamily: 'Arial', fontSize: '37px', fontStyle: 'bold', color: '#fff1d2'
      }).setOrigin(0, 1);
      const countX = 490 + Math.min(nameText.width, definition.name.length * 22) + 18;
      this.add.rectangle(countX, labelBottom, 64, 42, 0x14532d)
        .setStrokeStyle(2, 0x86efac).setOrigin(0, 1);
      this.add.text(countX + 32, labelBottom - 21,
        `x${choice.id === 'buy' ? definition.uses : item.charges}`, {
          fontFamily: 'Arial', fontSize: '26px', fontStyle: 'bold', color: '#dcfce7'
        }).setOrigin(0.5);
      this.add.text(490, y + 18, choice.id === 'buy' ? definition.description : `${item.charges}/${definition.uses} uses remaining`, {
        fontFamily: 'Arial', fontSize: '28px', color: '#e8c89f', wordWrap: { width: 1060 }
      });
      const affordable = choice.id !== 'buy' || GameState.gold >= value;
      const button = this.add.rectangle(1810, y, 225, 78, affordable ? 0x6b4527 : 0x3f3a34)
        .setStrokeStyle(3, affordable ? 0xd9a662 : 0x746b61);
      this.add.text(1810, y, `${choice.id === 'buy' ? 'Buy' : 'Sell'}: ${value}g`, {
        fontFamily: 'Arial', fontSize: '25px', fontStyle: 'bold', color: affordable ? '#fff1d2' : '#b0a69b'
      }).setOrigin(0.5);
      if (affordable) bindSelectionDetails(this, button, { title: definition.name, description }, () => {
        HapticsService.tap();
        const result = choice.id === 'buy' ? buyPotionPack(definition.id) : sellPotionPack(item.id);
        this.message = result.message;
        if (result.ok) { saveProfile(); HapticsService.confirm(); }
        this.render();
      });
    });
    const pageButton = (x, label, page, enabled) => {
      const button = this.add.rectangle(x, 759, 195, 62, 0x6b4527, enabled ? 1 : 0.45).setStrokeStyle(2, 0xd9a662);
      this.add.text(x, 759, label, { fontFamily: 'Arial', fontSize: '26px', color: '#fff1d2' }).setOrigin(0.5);
      if (enabled) bindSelectionDetails(this, button, { title: label, description: 'Browse potion packs.' }, () => {
        HapticsService.tap(); this.page = page; this.render();
      });
    };
    pageButton(600, '< PREV', this.page - 1, this.page > 0);
    this.add.text(1200, 759, this.message || `${this.page + 1} / ${pages}`, {
      fontFamily: 'Arial', fontSize: '27px', color: '#fde68a', align: 'center', wordWrap: { width: 820 }
    }).setOrigin(0.5);
    pageButton(1800, 'NEXT >', this.page + 1, this.page < pages - 1);
    return { x: 1200, y: 550, width: 1700, height: 520 };
  }
}
