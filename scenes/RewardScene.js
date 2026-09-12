import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { formatDuration } from '../game/ExpeditionProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class RewardScene extends Phaser.Scene {
  constructor() { super('RewardScene'); }
  create() {
    const { width, height } = this.scale;
    const goldReward = GameState.rewards.find((reward) => reward.type === 'gold');
    const gold = goldReward?.amount ?? 0;
    const summary = GameState.run.summary;
    this.cameras.main.setBackgroundColor('#15120f');

    this.add.text(width / 2, UI_SAFE_TOP + 18, 'DELVE CLEARED', { fontFamily: 'Arial', fontSize: '74px', fontStyle: 'bold', color: '#bef264' }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 73, GameState.currentDelve?.name ?? 'Delve cleared', { fontFamily: 'Arial', fontSize: '36px', color: '#e7e5e4' }).setOrigin(0.5);

    const leftX = width * 0.30, rightX = width * 0.70, panelY = height * 0.51, panelWidth = width * 0.34;
    this.add.rectangle(leftX, panelY, panelWidth, 430, 0x292524).setStrokeStyle(4, 0x57534e);
    this.add.text(leftX, panelY - 165, 'DELVE RESULTS', { fontFamily: 'Arial', fontSize: '36px', fontStyle: 'bold', color: '#f5f5f4' }).setOrigin(0.5);
    this.add.text(leftX, panelY - 92, `+${gold} Gold`, { fontFamily: 'Arial', fontSize: '57px', fontStyle: 'bold', color: '#fbbf24' }).setOrigin(0.5);
    this.add.text(leftX, panelY - 35, `Total Gold: ${GameState.gold}`, { fontFamily: 'Arial', fontSize: '30px', color: '#a8a29e' }).setOrigin(0.5);
    this.add.text(leftX, panelY + 20, `Time: ${formatDuration(summary?.elapsedMs)}`, { fontFamily: 'Arial', fontSize: '36px', color: '#ffffff' }).setOrigin(0.5);
    if (summary?.isNewBest) this.add.text(leftX, panelY + 64, 'NEW BEST TIME', { fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#bef264' }).setOrigin(0.5);
    const inspiration = summary?.leaderResult?.inspirationEarned > 0 ? `+${summary.leaderResult.inspirationEarned} Inspiration` : `Tactics Rank ${GameState.leader?.level ?? 1}`;
    this.add.text(leftX, panelY + 115, inspiration, { fontFamily: 'Arial', fontSize: '30px', color: '#c4b5fd' }).setOrigin(0.5);
    if ((summary?.voidKeysAwarded ?? 0) > 0) this.add.text(leftX, panelY + 156, '+1 VOID KEY', { fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#d8b4fe' }).setOrigin(0.5);

    this.add.rectangle(rightX, panelY, panelWidth, 430, 0x1f2937).setStrokeStyle(4, 0x374151);
    this.add.text(rightX, panelY - 165, 'PARTY PROGRESS', { fontFamily: 'Arial', fontSize: '36px', fontStyle: 'bold', color: '#f5f5f4' }).setOrigin(0.5);
    (summary?.adventurers ?? []).forEach((entry, index) => {
      const y = panelY - 98 + index * 70;
      const levelText = entry.levelsGained > 0 ? ` • LEVEL UP! -> ${entry.level}` : ` • Lv ${entry.level}`;
      this.add.text(rightX - panelWidth * 0.41, y, `${entry.name}: +${entry.xpGained} XP${levelText}`, { fontFamily: 'Arial', fontSize: '28px', color: entry.levelsGained > 0 ? '#bef264' : '#ffffff' });
      this.add.text(rightX + panelWidth * 0.41, y, `${entry.happiness}% happy`, { fontFamily: 'Arial', fontSize: '27px', color: '#86efac' }).setOrigin(1, 0);
    });

    const returnButton = this.add.rectangle(width / 2, height * 0.87, 760, 94, 0x44403c).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height * 0.87, 'RETURN TO WORLD MAP', { fontFamily: 'Arial', fontSize: '39px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    returnButton.on('pointerdown', () => {
      HapticsService.confirm();
      GameState.activeParty = [];
      GameState.currentRoom = 0;
      GameState.rewards = [];
      this.scene.start('TitleScene');
    });
  }
}
