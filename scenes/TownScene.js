import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class TownScene extends Phaser.Scene {
  constructor() {
    super('TownScene');
  }

  init(data) {
    this.townName = data?.townName ?? (GameState.world.currentLocation === 'duskfall' ? 'Duskfall' : 'Pineshire');
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1c1917');
    this.add.rectangle(width / 2, UI_SAFE_TOP + 18, width, 94, 0x292524);
    this.createBackButton();
    this.createHeader(width);

    this.add.text(width / 2, UI_SAFE_TOP + 98, this.townName.toUpperCase(), {
      fontFamily: 'Arial', fontSize: '72px', fontStyle: 'bold', color: '#f5f5f4'
    }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 151, 'Rest, prepare, and decide who is going underground next.', {
      fontFamily: 'Arial', fontSize: '32px', color: '#a8a29e'
    }).setOrigin(0.5);

    const labels = [
      ['TAVERN', 'Stories and rest', 'Tavern'],
      ["ADVENTURER'S HALL", 'Tactics, equipment, items', 'AdventurersHallScene'],
      ['ALCHEMIST', 'Potions and mixtures', 'Alchemist'],
      ['BLACKSMITH', 'Weapons and armor', 'Blacksmith'],
      ['ENCHANTER', 'Arcane improvements', 'Enchanter']
    ];
    const gap = 410;
    const startX = width / 2 - gap * 2;
    labels.forEach(([label, subtitle, target], index) => this.createButton(startX + gap * index, height * 0.58, label, subtitle, target));
  }

  createHeader(width) {
    this.add.text(width - 72, UI_SAFE_TOP + 18, `Gold: ${GameState.gold}   Keys: ${GameState.inventory.voidKeys ?? 0}`, {
      fontFamily: 'Arial', fontSize: '34px', color: '#fbbf24'
    }).setOrigin(1, 0.5);
  }

  createBackButton() {
    const y = UI_SAFE_TOP + 18;
    const button = this.add.rectangle(176, y, 276, 64, 0x44403c).setInteractive({ useHandCursor: true });
    this.add.text(176, y, '< WORLD MAP', { fontFamily: 'Arial', fontSize: '33px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    button.on('pointerdown', () => { HapticsService.tap(); this.scene.start('TitleScene'); });
  }

  createButton(x, y, label, subtitle, target) {
    const button = this.add.rectangle(x, y, 350, 210, 0x373330).setStrokeStyle(3, 0x57534e).setInteractive({ useHandCursor: true });
    this.add.text(x, y - 24, label, { fontFamily: 'Arial', fontSize: label.length > 12 ? '32px' : '40px', fontStyle: 'bold', color: '#ffffff', align: 'center', wordWrap: { width: 320 } }).setOrigin(0.5);
    this.add.text(x, y + 45, subtitle, { fontFamily: 'Arial', fontSize: '24px', color: '#a8a29e', align: 'center', wordWrap: { width: 300 } }).setOrigin(0.5);
    button.on('pointerdown', () => {
      HapticsService.tap();
      if (target === 'AdventurersHallScene') this.scene.start(target);
      else this.scene.start('FacilityScene', { title: target, townName: this.townName });
    });
  }
}
