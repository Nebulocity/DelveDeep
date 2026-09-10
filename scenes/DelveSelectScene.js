import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import delves from '../data/delves.js';
import HapticsService from '../services/HapticsService.js';
import { formatDuration } from '../game/ExpeditionProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class DelveSelectScene extends Phaser.Scene {
  constructor() {
    super('DelveSelectScene');
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#171717');
    this.createBackButton();

    this.add.text(width / 2, UI_SAFE_TOP + 20, 'CHOOSE A DELVE', {
      fontFamily: 'Arial',
      fontSize: '46px',
      fontStyle: 'bold',
      color: '#f5f5f4'
    }).setOrigin(0.5);

    this.add.text(width / 2, UI_SAFE_TOP + 70, 'Every expedition begins with a bad idea.', {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#a8a29e'
    }).setOrigin(0.5);

    const columns = Math.min(3, Math.max(1, delves.length));
    const cardWidth = Math.min(720, (width - 300) / columns - 50);
    const startX = width / 2 - ((columns - 1) * (cardWidth + 55)) / 2;

    delves.forEach((delve, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      this.createDelveCard(delve, startX + column * (cardWidth + 55), height * 0.56 + row * 360, cardWidth);
    });
  }

  createBackButton() {
    const y = UI_SAFE_TOP + 18;
    const button = this.add.rectangle(172, y, 270, 64, 0x3f3f46)
      .setInteractive({ useHandCursor: true });
    this.add.text(172, y, '< GUILD HALL', {
      fontFamily: 'Arial',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);
    button.on('pointerdown', () => {
      HapticsService.tap();
      this.scene.start('TownScene');
    });
  }

  createDelveCard(delve, x, y, cardWidth) {
    const record = GameState.records[delve.id] ?? { clears: 0, bestTimeMs: null };
    const card = this.add.rectangle(x, y, cardWidth, 365, 0x292524)
      .setStrokeStyle(4, delve.unlocked ? 0x57534e : 0x3f3f46);

    const left = x - cardWidth * 0.42;
    this.add.text(left, y - 135, delve.name, {
      fontFamily: 'Arial',
      fontSize: '34px',
      fontStyle: 'bold',
      color: delve.unlocked ? '#ffffff' : '#71717a'
    });

    this.add.text(left, y - 84, delve.subtitle, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#a8a29e',
      wordWrap: { width: cardWidth * 0.84 }
    });

    this.add.text(left, y + 22, `Difficulty: ${delve.difficulty} • Depth: ${delve.depth ?? 1}`, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#d6d3d1'
    });

    this.add.text(left, y + 59, `Rooms: ${delve.rooms} • Recommended: Lv ${delve.recommendedLevel}`, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#d6d3d1'
    });

    this.add.text(left, y + 102, `Clears: ${record.clears} • Best: ${formatDuration(record.bestTimeMs)}`, {
      fontFamily: 'Arial',
      fontSize: '19px',
      fontStyle: 'bold',
      color: record.clears > 0 ? '#bef264' : '#78716c'
    });

    this.add.text(left, y + 139, 'Reward: Gold + Adventurer XP + Happiness', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#fbbf24'
    });

    if (!delve.unlocked) return;

    card.setInteractive({ useHandCursor: true });
    card.on('pointerover', () => card.setFillStyle(0x3f3a37));
    card.on('pointerout', () => card.setFillStyle(0x292524));
    card.on('pointerdown', () => {
      HapticsService.tap();
      GameState.currentDelve = { ...delve };
      GameState.currentRoom = 0;
      this.scene.start('PartySelectScene');
    });
  }
}
