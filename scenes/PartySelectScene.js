import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { happinessLabel } from '../game/AdventurerProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class PartySelectScene extends Phaser.Scene {
  constructor() {
    super('PartySelectScene');
    this.selectedIds = new Set();
    this.partyCountText = null;
    this.beginButton = null;
    this.beginButtonText = null;
    this.cards = new Map();
  }

  init() {
    const existingParty = GameState.activeParty.length > 0
      ? GameState.activeParty
      : GameState.roster.slice(0, 4);

    this.selectedIds = new Set(existingParty.map((adventurer) => adventurer.id));
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#111827');

    this.createBackButton();

    this.add.text(width / 2, UI_SAFE_TOP + 16, 'BUILD YOUR PARTY', {
      fontFamily: 'Arial',
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#f8fafc'
    }).setOrigin(0.5);

    this.add.text(width / 2, UI_SAFE_TOP + 66, GameState.currentDelve?.name ?? 'Unknown Delve', {
      fontFamily: 'Arial',
      fontSize: '25px',
      color: '#cbd5e1'
    }).setOrigin(0.5);

    this.partyCountText = this.add.text(width / 2, UI_SAFE_TOP + 108, '', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#94a3b8'
    }).setOrigin(0.5);

    const cardWidth = Math.min(900, width * 0.38);
    const leftX = width * 0.28;
    const rightX = width * 0.72;
    const firstY = height * 0.43;
    const rowGap = 245;

    GameState.roster.forEach((adventurer, index) => {
      const x = index % 2 === 0 ? leftX : rightX;
      const y = firstY + Math.floor(index / 2) * rowGap;
      this.createAdventurerCard(adventurer, x, y, cardWidth);
    });

    this.createBeginButton(width / 2, height * 0.89);
    this.refreshSelectionUi();
  }

  createBackButton() {
    const y = UI_SAFE_TOP + 18;
    const button = this.add.rectangle(145, y, 220, 64, 0x334155)
      .setInteractive({ useHandCursor: true });

    this.add.text(145, y, '< DELVES', {
      fontFamily: 'Arial',
      fontSize: '23px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    button.on('pointerdown', () => {
      HapticsService.tap();
      this.scene.start('DelveSelectScene');
    });
  }

  createAdventurerCard(adventurer, x, y, cardWidth) {
    const card = this.add.rectangle(x, y, cardWidth, 190, 0x1f2937)
      .setStrokeStyle(4, 0x374151)
      .setInteractive({ useHandCursor: true });

    const portrait = this.add.circle(x - cardWidth * 0.39, y, 50, adventurer.color);
    portrait.setStrokeStyle(4, 0xffffff, 0.18);

    this.add.text(x - cardWidth * 0.30, y - 52, adventurer.name, {
      fontFamily: 'Arial',
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#ffffff'
    });

    this.add.text(x - cardWidth * 0.30, y - 7, `${adventurer.className}  •  ${adventurer.role}`, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#cbd5e1'
    });

    this.add.text(x - cardWidth * 0.30, y + 34, `Level ${adventurer.level}`, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#94a3b8'
    });
    this.add.text(x - cardWidth * 0.30, y + 62, `${happinessLabel(adventurer.happiness ?? 70)} • ${adventurer.happiness ?? 70}%`, {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#86efac'
    });

    const selectedLabel = this.add.text(x + cardWidth * 0.39, y, '', {
      fontFamily: 'Arial',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#86efac'
    }).setOrigin(1, 0.5);

    this.cards.set(adventurer.id, { card, selectedLabel });
    card.on('pointerdown', () => this.toggleAdventurer(adventurer.id));
  }

  toggleAdventurer(id) {
    HapticsService.tap();

    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else if (this.selectedIds.size < 4) {
      this.selectedIds.add(id);
    }

    this.refreshSelectionUi();
  }

  createBeginButton(x, y) {
    const { width } = this.scale;

    this.beginButton = this.add.rectangle(x, y, Math.min(760, width * 0.34), 105, 0x334155)
      .setInteractive({ useHandCursor: true });

    this.beginButtonText = this.add.text(x, y, 'BEGIN DELVE', {
      fontFamily: 'Arial',
      fontSize: '31px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.beginButton.on('pointerdown', () => {
      if (this.selectedIds.size !== 4) {
        return;
      }

      HapticsService.confirm();

      GameState.activeParty = GameState.roster
        .filter((adventurer) => this.selectedIds.has(adventurer.id))
        .map((adventurer) => ({ ...adventurer }));

      this.scene.start('DungeonScene');
    });
  }

  refreshSelectionUi() {
    this.partyCountText.setText(`${this.selectedIds.size} / 4 adventurers selected`);

    this.cards.forEach(({ card, selectedLabel }, id) => {
      const selected = this.selectedIds.has(id);
      card.setFillStyle(selected ? 0x263447 : 0x1f2937);
      card.setStrokeStyle(4, selected ? 0x94a3b8 : 0x374151);
      selectedLabel.setText(selected ? 'READY' : '');
    });

    const ready = this.selectedIds.size === 4;
    this.beginButton.setFillStyle(ready ? 0x475569 : 0x1f2937);
    this.beginButtonText.setColor(ready ? '#ffffff' : '#64748b');
  }
}
