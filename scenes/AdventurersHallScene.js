import Phaser from 'phaser';
import HapticsService from '../services/HapticsService.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class AdventurersHallScene extends Phaser.Scene {
  constructor() { super('AdventurersHallScene'); }
  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#111827');
    this.add.text(70, UI_SAFE_TOP + 15, '< TOWN', { fontFamily: 'Arial', fontSize: '38px', color: '#d6d3d1' }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { HapticsService.tap(); this.scene.start('TownScene'); });
    this.add.text(width / 2, UI_SAFE_TOP + 22, "ADVENTURER'S HALL", { fontFamily: 'Arial', fontSize: '72px', fontStyle: 'bold', color: '#f8fafc' }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 79, 'Prepare your party before heading back to the Old Road.', { fontFamily: 'Arial', fontSize: '32px', color: '#94a3b8' }).setOrigin(0.5);

    const entries = [
      ['BATTLE TACTICS', 'Choose and equip tactics', () => this.scene.start('RaidLeaderScene')],
      ['EQUIPMENT', 'Weapons and armor management', () => this.scene.start('FacilityScene', { title: 'Equipment', returnScene: 'AdventurersHallScene', returnLabel: "ADVENTURER'S HALL" })],
      ['ITEMS', 'Consumables and carried items', () => this.scene.start('FacilityScene', { title: 'Items', returnScene: 'AdventurersHallScene', returnLabel: "ADVENTURER'S HALL" })]
    ];
    entries.forEach(([label, subtitle, callback], index) => {
      const x = width * (0.25 + index * 0.25);
      const box = this.add.rectangle(x, height * 0.56, 500, 250, 0x1f2937).setStrokeStyle(4, 0x475569).setInteractive({ useHandCursor: true });
      this.add.text(x, height * 0.52, label, { fontFamily: 'Arial', fontSize: '42px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
      this.add.text(x, height * 0.61, subtitle, { fontFamily: 'Arial', fontSize: '28px', color: '#94a3b8', align: 'center', wordWrap: { width: 430 } }).setOrigin(0.5);
      box.on('pointerdown', () => { HapticsService.tap(); callback(); });
    });
  }
}
