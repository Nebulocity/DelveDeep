import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class TownScene extends Phaser.Scene {
  constructor() {
    super('TownScene');
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1c1917');

    this.add.rectangle(width / 2, UI_SAFE_TOP + 18, width, 94, 0x292524);
    this.createBackButton();
    this.createHeader(width);
    this.createTownTitle(width);
    this.createMenu(width, height);
  }

  createHeader(width) {
    this.add.text(width - 72, UI_SAFE_TOP + 18, `Gold: ${GameState.gold}`, {
      fontFamily: 'Arial',
      fontSize: '25px',
      color: '#fbbf24'
    }).setOrigin(1, 0.5);

    this.add.text(width - 72, UI_SAFE_TOP + 51, `Tonics: ${GameState.inventory.healingTonic}`, {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#a8a29e'
    }).setOrigin(1, 0.5);
  }

  createBackButton() {
    const y = UI_SAFE_TOP + 18;
    const button = this.add.rectangle(176, y, 276, 64, 0x44403c)
      .setInteractive({ useHandCursor: true });

    this.add.text(176, y, '< WORLD MAP', {
      fontFamily: 'Arial',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    button.on('pointerdown', () => {
      HapticsService.tap();
      this.scene.start('TitleScene');
    });
  }

  createTownTitle(width) {
    this.add.text(width / 2, UI_SAFE_TOP + 94, 'GUILD HALL', {
      fontFamily: 'Arial',
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#f5f5f4'
    }).setOrigin(0.5);

    this.add.text(width / 2, UI_SAFE_TOP + 144, 'Your adventurers await.', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#a8a29e'
    }).setOrigin(0.5);
  }

  createMenu(width, height) {
    const y = height * 0.59;
    const gap = Math.min(520, width * 0.225);

    this.createButton(width / 2 - gap * 1.5, y, 'ADVENTURERS', 'Roster & morale', () => {
      this.scene.start('RosterScene');
    });

    this.createButton(width / 2 - gap * 0.5, y, 'RAID LEADER', 'Inspirations', () => {
      this.scene.start('RaidLeaderScene');
    });

    this.createButton(width / 2 + gap * 0.5, y, 'DELVE', 'Choose expedition', () => {
      this.scene.start('DelveSelectScene');
    });

    this.createButton(width / 2 + gap * 1.5, y, 'SHOP', 'Supplies', () => {
      this.scene.start('ShopScene');
    });
  }

  createButton(x, y, label, subtitle, callback) {
    const { width } = this.scale;
    const buttonWidth = Math.min(430, width * 0.185);
    const button = this.add.rectangle(x, y, buttonWidth, 190, 0x373330)
      .setStrokeStyle(3, 0x57534e)
      .setInteractive({ useHandCursor: true });

    this.add.text(x, y - 16, label, {
      fontFamily: 'Arial',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.add.text(x, y + 34, subtitle, {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#a8a29e'
    }).setOrigin(0.5);

    button.on('pointerdown', () => {
      HapticsService.tap();
      callback();
    });
    button.on('pointerover', () => button.setFillStyle(0x4a4541));
    button.on('pointerout', () => button.setFillStyle(0x373330));
  }
}
