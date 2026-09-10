import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { formatDuration } from '../game/ExpeditionProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class RewardScene extends Phaser.Scene {
  constructor() {
    super('RewardScene');
  }

  create() {
    const { width, height } = this.scale;
    const goldReward = GameState.rewards.find((reward) => reward.type === 'gold');
    const gold = goldReward?.amount ?? 0;
    const summary = GameState.run.summary;

    this.cameras.main.setBackgroundColor('#15120f');

    this.add.text(width / 2, UI_SAFE_TOP + 18, 'VICTORY', {
      fontFamily: 'Arial',
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#bef264'
    }).setOrigin(0.5);

    this.add.text(width / 2, UI_SAFE_TOP + 72, GameState.currentDelve?.name ?? 'Delve cleared', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#e7e5e4'
    }).setOrigin(0.5);

    const leftX = width * 0.30;
    const rightX = width * 0.70;
    const panelY = height * 0.51;
    const panelWidth = width * 0.34;

    this.add.rectangle(leftX, panelY, panelWidth, 430, 0x292524).setStrokeStyle(4, 0x57534e);
    this.add.text(leftX, panelY - 165, 'EXPEDITION', {
      fontFamily: 'Arial',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#f5f5f4'
    }).setOrigin(0.5);

    this.add.text(leftX, panelY - 92, `+${gold} Gold`, {
      fontFamily: 'Arial',
      fontSize: '38px',
      fontStyle: 'bold',
      color: '#fbbf24'
    }).setOrigin(0.5);

    this.add.text(leftX, panelY - 35, `Total Gold: ${GameState.gold}`, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#a8a29e'
    }).setOrigin(0.5);

    this.add.text(leftX, panelY + 20, `Time: ${formatDuration(summary?.elapsedMs)}`, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);

    if (summary?.isNewBest) {
      this.add.text(leftX, panelY + 64, 'NEW BEST TIME', {
        fontFamily: 'Arial',
        fontSize: '21px',
        fontStyle: 'bold',
        color: '#bef264'
      }).setOrigin(0.5);
    }

    const leaderLine = summary?.leaderResult?.inspirationEarned > 0
      ? `Raid Leader: +${summary.leaderResult.inspirationEarned} Inspiration`
      : `Raid Leader Lv ${GameState.leader?.level ?? 1}`;

    this.add.text(leftX, panelY + 118, leaderLine, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#c4b5fd'
    }).setOrigin(0.5);

    this.add.rectangle(rightX, panelY, panelWidth, 430, 0x1f2937).setStrokeStyle(4, 0x374151);
    this.add.text(rightX, panelY - 165, 'PARTY PROGRESS', {
      fontFamily: 'Arial',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#f5f5f4'
    }).setOrigin(0.5);

    (summary?.adventurers ?? []).forEach((entry, index) => {
      const y = panelY - 98 + index * 70;
      const levelText = entry.levelsGained > 0 ? ` • LEVEL UP! → ${entry.level}` : ` • Lv ${entry.level}`;
      this.add.text(rightX - panelWidth * 0.41, y, `${entry.name}: +${entry.xpGained} XP${levelText}`, {
        fontFamily: 'Arial',
        fontSize: '19px',
        color: entry.levelsGained > 0 ? '#bef264' : '#ffffff'
      });
      this.add.text(rightX + panelWidth * 0.41, y, `♥ ${entry.happiness}%`, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#86efac'
      }).setOrigin(1, 0);
    });

    const returnButton = this.add.rectangle(width / 2, height * 0.86, Math.min(860, width * 0.38), 94, 0x44403c)
      .setInteractive({ useHandCursor: true });

    this.add.text(width / 2, height * 0.86, 'RETURN TO GUILD HALL', {
      fontFamily: 'Arial',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    returnButton.on('pointerdown', () => {
      HapticsService.confirm();
      GameState.currentDelve = null;
      GameState.activeParty = [];
      GameState.currentRoom = 0;
      GameState.rewards = [];
      this.scene.start('TownScene');
    });
  }
}
