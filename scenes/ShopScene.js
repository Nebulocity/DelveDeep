import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';
import { addReturnButton } from '../ui/ReturnButton.js';

export default class ShopScene extends Phaser.Scene {
  constructor() { super('ShopScene'); }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1b1713');
    addReturnButton(this, 'Town', () => this.scene.start('TownScene'), { y: UI_SAFE_TOP + 32 });
    this.add.text(width / 2, UI_SAFE_TOP + 20, 'QUARTERMASTER', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('display69'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f5f5f4'
    }).setOrigin(0.5);
    this.add.text(width - 72, UI_SAFE_TOP + 20, `Gold: ${GameState.gold}`, {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body36'), color: '#fbbf24'
    }).setOrigin(1, 0.5);
    this.add.text(width / 2, height * 0.53, 'No supplies are stocked yet.', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('heading42'), color: '#d6d3d1'
    }).setOrigin(0.5);
  }
}
