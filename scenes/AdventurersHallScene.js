import { bindSelectionDetails, addDetailsHint } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import HapticsService from '../services/HapticsService.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class AdventurersHallScene extends Phaser.Scene {

  // This function registers AdventurersHallScene so the game can navigate to
  // this screen.
  constructor() {

    super('AdventurersHallScene');
  }

  // This function builds the Adventurers' Hall screen, including the town
  // return link and three destination cards. Battle Tactics opens the leader
  // loadout screen; Equipment and Items open roster gear and inventory.
  create() {

    // Read the screen dimensions and set the background for the hall.
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#111827');

    // Create the town return link near the top-left safe area. A tap gives
    // haptic feedback before switching back to TownScene.
    this.add.text(70, UI_SAFE_TOP + 15, '< TOWN', { fontFamily: 'Arial', fontSize: '38px', color: '#d6d3d1' }).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {

        HapticsService.tap(); this.scene.start('TownScene');
      });

    // Add the hall title and the short preparation message below it.
    this.add.text(width / 2, UI_SAFE_TOP + 22, "ADVENTURER'S HALL", { fontFamily: 'Arial', fontSize: '72px', fontStyle: 'bold', color: '#f8fafc' }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 79, 'Prepare your party before heading back to the Old Road.', { fontFamily: 'Arial', fontSize: '32px', color: '#94a3b8' }).setOrigin(0.5);

    addDetailsHint(this, height * 0.78);

    // Define the three preparation screens; each returns to the hall.
    const entries = [
      ['BATTLE TACTICS', 'Choose and equip tactics', () => this.scene.start('RaidLeaderScene')],
      ['EQUIPMENT', 'Weapons and armor management', () => this.scene.start('EquipmentScene')],
      ['ITEMS', 'Consumables, materials, and gear', () => this.scene.start('ItemsScene')]
    ];

    // Build the cards across the middle of the screen using the same size,
    // spacing, and text layout for each destination.
    entries.forEach(([label, subtitle, callback], index) => {

      const x = width * (0.25 + index * 0.25);
      const box = this.add.rectangle(x, height * 0.56, 500, 250, 0x1f2937).setStrokeStyle(4, 0x475569).setInteractive({ useHandCursor: true });
      this.add.text(x, height * 0.52, label, { fontFamily: 'Arial', fontSize: '42px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
      this.add.text(x, height * 0.61, subtitle, { fontFamily: 'Arial', fontSize: '28px', color: '#94a3b8', align: 'center', wordWrap: { width: 430 } }).setOrigin(0.5);

      // Connect the whole card to its destination callback and provide tap
      // feedback.
      box.on('pointerdown', () => {

        HapticsService.tap(); callback();
      });
      bindSelectionDetails(this, box, { title: label, description: subtitle + (label === 'BATTLE TACTICS' ? '. Spend TP to unlock tactics, then equip up to five for combat.' : label === 'EQUIPMENT' ? '. Browse by role and equip one class weapon and one armor per adventurer.' : '. View all owned supplies and see who is using each piece of equipment.') });
    });
  }
}
