import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { happinessLabel, xpRequired } from '../game/AdventurerProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class RosterScene extends Phaser.Scene {
  // I register RosterScene so the game can navigate to this screen.
  constructor() {

    super('RosterScene');
  }

  // I lay out the roster so the player can compare adventurers.
  create() {

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#111827');
    this.createBackButton();

    this.add.text(width / 2, UI_SAFE_TOP + 20, 'ADVENTURERS', {
      fontFamily: 'Arial',
      fontSize: '69px',
      fontStyle: 'bold',
      color: '#f8fafc'
    }).setOrigin(0.5);

    this.add.text(width / 2, UI_SAFE_TOP + 72, 'Experience and happiness persist between delves.', {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#94a3b8'
    }).setOrigin(0.5);

    const cardWidth = Math.min(520, width * 0.205);
    const maxColumns = 4;
    const rowGap = 205;
    const firstY = height * 0.29;
    const horizontalGap = Math.min(cardWidth + 42, width * 0.235);

    GameState.roster.forEach((adventurer, index) => {

      const row = Math.floor(index / maxColumns);
      const rowStart = row * maxColumns;
      const remaining = GameState.roster.length - rowStart;
      const itemsInRow = Math.min(maxColumns, remaining);
      const indexInRow = index - rowStart;
      const rowWidth = (itemsInRow - 1) * horizontalGap;
      const x = (width / 2) - (rowWidth / 2) + (indexInRow * horizontalGap);
      const y = firstY + row * rowGap;
      this.createCard(adventurer, x, y, cardWidth);
    });
  }

  // I provide a return to town with touch feedback.
  createBackButton() {

    const y = UI_SAFE_TOP + 18;
    const button = this.add.rectangle(172, y, 270, 64, 0x334155)
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

  // I present an adventurer identity and stats for roster browsing.
  createCard(adventurer, x, y, cardWidth) {

    const cardHeight = 178;
    this.add.rectangle(x, y, cardWidth, cardHeight, 0x1f2937)
      .setStrokeStyle(3, 0x374151);

    this.add.circle(x - cardWidth * 0.40, y - 30, 35, adventurer.color)
      .setStrokeStyle(3, 0xffffff, 0.2);

    this.add.text(x - cardWidth * 0.31, y - 70, adventurer.name, {
      fontFamily: 'Arial',
      fontSize: '34px',
      fontStyle: 'bold',
      color: '#ffffff'
    });

    this.add.text(x - cardWidth * 0.31, y - 35, `${adventurer.className} • ${adventurer.role}`, {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: '#cbd5e1'
    });

    const needed = xpRequired(adventurer.level);
    const xp = adventurer.xp ?? 0;
    this.add.text(x - cardWidth * 0.31, y - 4, `Level ${adventurer.level} • XP ${xp}/${needed}`, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#94a3b8'
    });

    const barX = x - cardWidth * 0.31;
    const barY = y + 26;
    const barWidth = cardWidth * 0.55;
    this.add.rectangle(barX, barY, barWidth, 15, 0x0f172a).setOrigin(0, 0.5);
    this.add.rectangle(barX, barY, barWidth * Math.min(1, xp / needed), 15, 0x64748b).setOrigin(0, 0.5);

    const happy = adventurer.happiness ?? 70;
    this.add.text(x - cardWidth * 0.31, y + 48, `Happiness: ${happy}% • ${happinessLabel(happy)}`, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: happy >= 65 ? '#86efac' : '#fca5a5'
    });

    this.add.text(x - cardWidth * 0.31, y + 73, `Delves completed: ${adventurer.delvesCompleted ?? 0}`, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#94a3b8'
    });
  }
}
