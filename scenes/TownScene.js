import { bindSelectionDetails, addDetailsHint } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';
import { addReturnButton } from '../ui/ReturnButton.js';

export default class TownScene extends Phaser.Scene {

  // This function registers TownScene so the game can navigate to this
  // screen.
  constructor() {

    super('TownScene');
  }

  // This function remembers which town the player is visiting.
  init(data) {

    this.townName = data?.townName ?? (GameState.world.currentLocation === 'duskfall' ? 'Duskfall' : 'Pineshire');
  }

  // This function builds the current town screen with its name, currencies,
  // and four facility cards.
  create() {

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1c1917');

    // Fill the game area with the town artwork and darken it behind the menu.
    const background = this.add.image(width / 2, height / 2, 'town');
    background.setScale(Math.max(width / background.width, height / background.height));
    this.add.rectangle(width / 2, height / 2, width, height, 0x100e0c, 0.28);

    // Build the top currency banner and the return link to the world map.
    this.headerY = UI_SAFE_TOP + 48;
    this.add.rectangle(width / 2, this.headerY, width, 94, 0x292524);
    this.createBackButton();
    this.createHeader(width);

    this.add.rectangle(width / 2, UI_SAFE_TOP + 183, 1800, 162, 0x17120f, 0.72);
    this.add.text(width / 2, UI_SAFE_TOP + 154, this.townName.toUpperCase(), {
      fontFamily: 'Arial', fontSize: '72px', fontStyle: 'bold', color: '#f5f5f4'
    }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 211, 'Rest, prepare, and decide who is going underground next.', {
      fontFamily: 'Arial', fontSize: '32px', color: '#a8a29e'
    }).setOrigin(0.5);

    addDetailsHint(this, height * 0.78);

    // List each facility with its card label, subtitle, and destination.
    const labels = [
      ["ADVENTURER'S HALL", 'Adventurers, gear, items, tactics', 'AdventurersHallScene'],
      ['ALCHEMIST', 'Potions and mixtures', 'Alchemist'],
      ['BLACKSMITH', 'Equipment shop', 'BlacksmithScene'],
      ['ENCHANTER', 'Arcane improvements', 'Enchanter']
    ];

    // Arrange the four facility cards across a centered horizontal row.
    const gap = 410;
    const startX = width / 2 - gap * (labels.length - 1) / 2;
    labels.forEach(([label, subtitle, target], index) => this.createButton(startX + gap * index, height * 0.58, label, subtitle, target));
  }

  // This function shows the gold available during this town visit.
  createHeader(width) {

    this.add.text(width - 72, this.headerY, `Gold: ${GameState.gold}`, {
      fontFamily: 'Arial', fontSize: '34px', color: '#fbbf24'
    }).setOrigin(1, 0.5);
  }

  // This function provides a return to the world map with touch feedback.
  createBackButton() {

    addReturnButton(this, 'World Map', () => this.scene.start('TitleScene'), { y: this.headerY });
  }

  // This function connects a town destination card to its scene with touch
  // feedback.
  createButton(x, y, label, subtitle, target) {

    const button = this.add.rectangle(x, y, 350, 210, 0x373330).setStrokeStyle(3, 0x57534e).setInteractive({ useHandCursor: true });
    this.add.text(x, y - 24, label, { fontFamily: 'Arial', fontSize: label.length > 12 ? '32px' : '40px', fontStyle: 'bold', color: '#ffffff', align: 'center', wordWrap: { width: 320 } }).setOrigin(0.5);
    this.add.text(x, y + 45, subtitle, { fontFamily: 'Arial', fontSize: '24px', color: '#a8a29e', align: 'center', wordWrap: { width: 300 } }).setOrigin(0.5);
    button.on('pointerdown', () => {

      HapticsService.tap();
      if (['AdventurersHallScene', 'BlacksmithScene'].includes(target)) this.scene.start(target);
      else this.scene.start('FacilityScene', { title: target, townName: this.townName });
    });
    bindSelectionDetails(this, button, { title: label, description: subtitle + (target === 'AdventurersHallScene' ? '. Browse adventurers, inspect equipment slots and abilities, and choose tactics.' : target === 'BlacksmithScene' ? '. Browse the buy, sell, and craft counters.' : target === 'Alchemist' ? '. Browse potions, supplies, and brewing.' : '. Browse enchantments and arcane wares.') });
  }
}
