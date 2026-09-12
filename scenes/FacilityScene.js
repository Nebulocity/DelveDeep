import Phaser from 'phaser';
import HapticsService from '../services/HapticsService.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class FacilityScene extends Phaser.Scene {
  constructor() { super('FacilityScene'); }
  init(data) { this.title = data?.title ?? 'Town Facility'; }
  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#171717');
    this.add.text(70, UI_SAFE_TOP + 15, '< TOWN', { fontFamily: 'Arial', fontSize: '38px', color: '#d6d3d1' }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { HapticsService.tap(); this.scene.start('TownScene'); });
    this.add.text(width / 2, height * 0.38, this.title.toUpperCase(), { fontFamily: 'Arial', fontSize: '78px', fontStyle: 'bold', color: '#f5f5f4' }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.53, `${this.title} systems are coming in a later scaffold.`, { fontFamily: 'Arial', fontSize: '38px', color: '#a8a29e' }).setOrigin(0.5);
  }
}
