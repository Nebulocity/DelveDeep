import Phaser from 'phaser';
import HapticsService from '../services/HapticsService.js';
import GameState from '../game/GameState.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#111827');

    this.add.text(width / 2, UI_SAFE_TOP + 28, 'DELVE DEEP', {
      fontFamily: 'Arial',
      fontSize: '58px',
      fontStyle: 'bold',
      color: '#f8fafc'
    }).setOrigin(0.5);

    this.add.text(width / 2, UI_SAFE_TOP + 84, 'WORLD MAP', {
      fontFamily: 'Arial',
      fontSize: '25px',
      fontStyle: 'bold',
      color: '#64748b'
    }).setOrigin(0.5);

    this.add.text(width - 72, UI_SAFE_TOP + 24, `Gold: ${GameState.gold}`, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#fbbf24'
    }).setOrigin(1, 0.5);

    const path = this.add.graphics();
    path.lineStyle(8, 0x334155, 1);
    path.beginPath();
    path.moveTo(width * 0.28, height * 0.60);
    path.lineTo(width * 0.50, height * 0.43);
    path.lineTo(width * 0.72, height * 0.59);
    path.strokePath();

    this.createLocation(width * 0.28, height * 0.60, 'GUILD HALL', 'Home base', 0x475569, true, () => {
      this.scene.start('TownScene');
    });

    this.createLocation(width * 0.50, height * 0.43, 'FORGOTTEN CAVERN', 'Delve', 0x7c2d12, true, () => {
      this.scene.start('DelveSelectScene');
    });

    this.createLocation(width * 0.72, height * 0.59, 'MISTWOOD', 'Coming soon', 0x1f2937, false);
    this.createLocation(width * 0.54, height * 0.77, 'OLD ROAD', 'Locked', 0x1f2937, false);
  }

  createLocation(x, y, title, subtitle, color, enabled, callback = null) {
    const node = this.add.circle(x, y, enabled ? 74 : 62, color)
      .setStrokeStyle(5, enabled ? 0x94a3b8 : 0x374151);

    this.add.text(x, y - 2, enabled ? '◆' : '×', {
      fontFamily: 'Arial',
      fontSize: enabled ? '42px' : '36px',
      color: enabled ? '#ffffff' : '#64748b'
    }).setOrigin(0.5);

    this.add.text(x, y + 102, title, {
      fontFamily: 'Arial',
      fontSize: '24px',
      fontStyle: 'bold',
      color: enabled ? '#f8fafc' : '#64748b'
    }).setOrigin(0.5);

    this.add.text(x, y + 136, subtitle, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: enabled ? '#94a3b8' : '#475569'
    }).setOrigin(0.5);

    if (!enabled) return;

    node.setInteractive({ useHandCursor: true });
    node.on('pointerdown', () => {
      HapticsService.tap();
      callback?.();
    });
    node.on('pointerover', () => node.setScale(1.08));
    node.on('pointerout', () => node.setScale(1));
  }
}
