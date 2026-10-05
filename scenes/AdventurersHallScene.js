import Phaser from 'phaser';
import { bindSelectionDetails, addDetailsHint } from '../ui/SelectionDetails.js';
import HapticsService from '../services/HapticsService.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';
import { addHallBackground } from '../ui/HallBackground.js';
import { addReturnButton } from '../ui/ReturnButton.js';
import { addFacilityChoiceCard } from '../ui/FacilityChoiceArt.js';

const DESTINATIONS = [
  { label: 'ADVENTURERS', icon: 'shield', subtitle: 'Meet your party', scene: 'RosterScene', description: 'Browse adventurers, their equipment, stats, and battle abilities.' },
  { label: 'ITEMS', icon: 'satchel', subtitle: 'Inventory', scene: 'ItemsScene', description: 'View equipment and other items when they become available.' },
  { label: 'TACTICS', icon: 'tactics', subtitle: 'Plan your next battle', scene: 'RaidLeaderScene', description: 'Spend TP to unlock tactics, then equip up to five for combat.' }
];

export default class AdventurersHallScene extends Phaser.Scene {
  constructor() {
    super('AdventurersHallScene');
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1b0e09');

    addHallBackground(this, 0.08);

    // Translucent timber-toned bands keep the room visible behind large labels.
    this.add.rectangle(width / 2, 0, width, UI_SAFE_TOP + 152, 0x180d09, 0.84).setOrigin(0.5, 0);
    this.add.rectangle(width / 2, height, width, 320, 0x180d09, 0.78).setOrigin(0.5, 1);

    addReturnButton(this, 'Town', () => this.scene.start('TownScene'), { y: UI_SAFE_TOP + 32 });

    this.add.text(width / 2, UI_SAFE_TOP + 24, "ADVENTURER'S HALL", {
      fontFamily: 'Arial', fontSize: '70px', fontStyle: 'bold', color: '#fff1d2',
      stroke: '#241008', strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 91, 'Gather your party and prepare for the road ahead.', {
      fontFamily: 'Arial', fontSize: '31px', color: '#f4d5ab'
    }).setOrigin(0.5);

    const cardWidth = Math.min(600, (width - 280) / DESTINATIONS.length);
    const gap = 28;
    const firstX = width / 2 - (cardWidth + gap) * (DESTINATIONS.length - 1) / 2;
    const cardY = height - 151;
    DESTINATIONS.forEach((entry, index) => {
      const x = firstX + index * (cardWidth + gap);
      const card = addFacilityChoiceCard(this, 'Hall', entry, x, cardY, cardWidth);
      card.on('pointerdown', () => {
        HapticsService.tap();
        this.scene.start(entry.scene);
      });
      bindSelectionDetails(this, card, { title: entry.label, description: entry.description });
    });

    addDetailsHint(this, height - 260);
  }
}
