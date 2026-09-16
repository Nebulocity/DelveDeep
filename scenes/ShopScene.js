import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { saveProfile } from '../game/GameStorage.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class ShopScene extends Phaser.Scene {
  // I register ShopScene so the game can navigate to this screen.
  constructor() {

    super('ShopScene');
    this.goldText = null;
    this.stockText = null;
    this.messageText = null;
  }

  // I present tonic supplies, their price, and the purchase controls.
  create() {

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1b1713');
    this.createBackButton();

    this.add.text(width / 2, UI_SAFE_TOP + 20, 'QUARTERMASTER', {
      fontFamily: 'Arial',
      fontSize: '69px',
      fontStyle: 'bold',
      color: '#f5f5f4'
    }).setOrigin(0.5);

    this.goldText = this.add.text(width - 72, UI_SAFE_TOP + 20, '', {
      fontFamily: 'Arial',
      fontSize: '36px',
      color: '#fbbf24'
    }).setOrigin(1, 0.5);

    const cardX = width / 2;
    const cardY = height * 0.53;
    const cardWidth = Math.min(1000, width * 0.48);

    this.add.rectangle(cardX, cardY, cardWidth, 360, 0x292524).setStrokeStyle(4, 0x57534e);
    this.add.circle(cardX - cardWidth * 0.39, cardY - 60, 52, 0xdc2626);
    this.add.text(cardX - cardWidth * 0.39, cardY - 60, '+', {
      fontFamily: 'Arial',
      fontSize: '72px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.add.text(cardX - cardWidth * 0.29, cardY - 112, 'HEALING TONIC', {
      fontFamily: 'Arial',
      fontSize: '46px',
      fontStyle: 'bold',
      color: '#ffffff'
    });

    this.add.text(cardX - cardWidth * 0.29, cardY - 62,
      'Automatically consumed when an adventurer falls below 35% HP. Restores 35% max HP.', {
        fontFamily: 'Arial',
        fontSize: '28px',
        color: '#d6d3d1',
        wordWrap: { width: cardWidth * 0.58 }
      });

    this.stockText = this.add.text(cardX - cardWidth * 0.29, cardY + 34, '', {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#a8a29e'
    });

    const buy = this.add.rectangle(cardX + cardWidth * 0.22, cardY + 105, 330, 76, 0x7c2d12)
      .setInteractive({ useHandCursor: true });
    this.add.text(cardX + cardWidth * 0.22, cardY + 105, 'BUY • 25 GOLD', {
      fontFamily: 'Arial',
      fontSize: '33px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.messageText = this.add.text(width / 2, height * 0.82, '', {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#fbbf24'
    }).setOrigin(0.5);

    buy.on('pointerdown', () => this.buyTonic());
    this.refresh();
  }

  // I provide a return to town with touch feedback.
  createBackButton() {

    const y = UI_SAFE_TOP + 18;
    const button = this.add.rectangle(172, y, 270, 64, 0x44403c)
      .setInteractive({ useHandCursor: true });
    this.add.text(172, y, '< TOWN', {
      fontFamily: 'Arial',
      fontSize: '33px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);
    button.on('pointerdown', () => {

      HapticsService.tap();
      this.scene.start('TownScene');
    });
  }

  // I exchange enough gold for one tonic and save the updated supplies.
  buyTonic() {

    if (GameState.gold < 25) {
      HapticsService.tap();
      this.messageText.setText('Not enough gold.');
      return;
    }

    GameState.gold -= 25;
    GameState.inventory.healingTonic += 1;
    saveProfile();
    HapticsService.confirm();
    this.messageText.setText('Healing Tonic added to expedition supplies.');
    this.refresh();
  }

  // I keep shop gold and owned stock in sync after a purchase.
  refresh() {

    this.goldText.setText(`Gold: ${GameState.gold}`);
    this.stockText.setText(`Owned: ${GameState.inventory.healingTonic}`);
  }
}
