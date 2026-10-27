// Rewards have already been committed. This scene only presents the saved victory.
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { formatDuration } from '../game/ExpeditionProgression.js';
import { resultsFrame, resultsSection, resultsText, resultsButton } from '../ui/EncounterResults.js';
import { RESOURCE_GAIN_COLOR, rewardItemColor } from '../ui/RewardDisplay.js';
import { getCatalogItemDefinition, ITEM_RARITIES } from '../data/items.js';

export default class RewardScene extends Phaser.Scene {
  constructor() {
    super('RewardScene');
  }

  create() {
    const summary = GameState.run.summary;
    const gold = GameState.rewards.find(reward => reward.type === 'gold')?.amount ?? 0;
    const layout = resultsFrame(this, GameState.currentDelve, 'DELVE COMPLETED', 'victory',
      `Time in encounter: ${formatDuration(summary?.elapsedMs)}`);
    const { centerX, leftX, rightX, columnWidth, contentTop, contentHeight, actionY } = layout;
    resultsSection(this, leftX, contentTop, columnWidth, contentHeight, 'DELVE REWARDS');
    resultsText(this, leftX, contentTop + 112, `+${gold} Gold`, 'display57', { color: RESOURCE_GAIN_COLOR });
    resultsText(this, leftX, contentTop + 170, `Total Gold: ${GameState.gold}`, 'body32', { color: '#c6bdac' });
    resultsText(this, leftX, contentTop + 228,
      summary?.leaderResult?.renownPointsEarned > 0
        ? `+${summary.leaderResult.renownPointsEarned} Renown Points`
        : `Renown Level ${GameState.leader?.level ?? 1}`, 'body32', { color: '#d8c6f0' });
    if (summary?.isNewBest) {
      resultsText(this, leftX, contentTop + 278, 'NEW BEST TIME', 'body32', { color: '#ffdb86' });
    }
    const gearReward = GameState.rewards.find(reward => reward.type === 'equipment');
    if (gearReward) {
      const definition = getCatalogItemDefinition(gearReward.itemId ?? gearReward.id);
      const rarity = ITEM_RARITIES[definition?.rarity ?? gearReward.rarity] ?? ITEM_RARITIES.common;
      resultsText(this, leftX, contentTop + 318, `Found: ${definition?.name ?? gearReward.name} (${rarity.label})`, 'body30', {
        originY: 0, color: rewardItemColor(gearReward),
        wordWrap: { width: columnWidth - 72 }
      }).setName('victory-equipment-reward');
    }

    resultsSection(this, rightX, contentTop, columnWidth, contentHeight, 'PARTY PROGRESS');
    (summary?.adventurers ?? []).forEach((entry, index) => {
      const y = contentTop + 80 + index * 66;
      resultsText(this, rightX - columnWidth / 2 + 30, y, `${entry.name}: +${entry.xpGained} XP`, 'body30', {
        originX: 0, originY: 0, align: 'left', color: RESOURCE_GAIN_COLOR
      });
      resultsText(this, rightX - columnWidth / 2 + 30, y + 34,
        `${entry.levelsGained > 0 ? 'LEVEL UP! ' : ''}Lv ${entry.level}  •  ${Math.round(entry.happiness)}% happy`, 'support29', {
          originX: 0, originY: 0, color: RESOURCE_GAIN_COLOR
        });
    });

    resultsButton(this, centerX, actionY, columnWidth, 92, 'Return to World Map', () => {
      GameState.activeParty = [];
      GameState.currentRoom = 0;
      GameState.rewards = [];
      this.scene.start('TitleScene');
    }, { primary: true }).setName('reward-world-map');
  }
}
