import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { happinessLabel, xpRequired } from '../game/AdventurerProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class RosterScene extends Phaser.Scene {
  constructor() {
    super('RosterScene');
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#111827');
    this.createBackButton();

    this.add.text(width / 2, UI_SAFE_TOP + 20, 'ADVENTURERS', {
      fontFamily: 'Arial',
      fontSize: '46px',
      fontStyle: 'bold',
      color: '#f8fafc'
    }).setOrigin(0.5);

    this.add.text(width / 2, UI_SAFE_TOP + 72, 'Experience and happiness persist between delves.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#94a3b8'
    }).setOrigin(0.5);

    const cardWidth = width * 0.39;
    const xs = [width * 0.285, width * 0.715];
    const ys = [height * 0.43, height * 0.72];

    GameState.roster.forEach((adventurer, index) => {
      this.createCard(adventurer, xs[index % 2], ys[Math.floor(index / 2)], cardWidth);
    });
  }

  createBackButton() {
    const y = UI_SAFE_TOP + 18;
    const button = this.add.rectangle(172, y, 270, 64, 0x334155)
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

  createCard(adventurer, x, y, cardWidth) {
    const cardHeight = 230;
    this.add.rectangle(x, y, cardWidth, cardHeight, 0x1f2937)
      .setStrokeStyle(3, 0x374151);

    this.add.circle(x - cardWidth * 0.40, y - 42, 45, adventurer.color)
      .setStrokeStyle(3, 0xffffff, 0.2);

    this.add.text(x - cardWidth * 0.31, y - 85, adventurer.name, {
      fontFamily: 'Arial',
      fontSize: '29px',
      fontStyle: 'bold',
      color: '#ffffff'
    });

    this.add.text(x - cardWidth * 0.31, y - 45, `${adventurer.className} • ${adventurer.role}`, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#cbd5e1'
    });

    const needed = xpRequired(adventurer.level);
    const xp = adventurer.xp ?? 0;
    this.add.text(x - cardWidth * 0.31, y - 7, `Level ${adventurer.level} • XP ${xp}/${needed}`, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#94a3b8'
    });

    const barX = x - cardWidth * 0.31;
    const barY = y + 31;
    const barWidth = cardWidth * 0.55;
    this.add.rectangle(barX, barY, barWidth, 15, 0x0f172a).setOrigin(0, 0.5);
    this.add.rectangle(barX, barY, barWidth * Math.min(1, xp / needed), 15, 0x64748b).setOrigin(0, 0.5);

    const happy = adventurer.happiness ?? 70;
    this.add.text(x - cardWidth * 0.31, y + 62, `Happiness: ${happy}% • ${happinessLabel(happy)}`, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: happy >= 65 ? '#86efac' : '#fca5a5'
    });

    this.add.text(x - cardWidth * 0.31, y + 93, `Delves completed: ${adventurer.delvesCompleted ?? 0}`, {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#94a3b8'
    });
  }
}
