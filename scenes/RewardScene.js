// This displays the completed run's rewards and return choices. Persistent reward
// application happens through the progression helpers, keeping scene redraws from becoming
// extra payouts.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { formatDuration } from '../game/ExpeditionProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';
import { addReturnButton } from '../ui/ReturnButton.js';

export default class RewardScene extends Phaser.Scene {

  // This helper registers RewardScene so the game can navigate to this screen.
  constructor() {

    super('RewardScene');
  }

  // This helper displays the saved victory summary in separate result and party-progress
  // panels. It shows gold, completion time, leader rewards, and adventurer gains, then
  // provides a button to return to the world map.
  create() {

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;

    // Read rewards already committed by the battle outcome; this screen only presents
    // them.
    const goldReward = GameState.rewards.find((reward) => reward.type === 'gold');

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const gold = goldReward?.amount ?? 0;
    const summary = GameState.run.summary;
    this.cameras.main.setBackgroundColor('#15120f');

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    this.add.text(width / 2, UI_SAFE_TOP + 18, 'DELVE CLEARED', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('display74'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#bef264' }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 73, GameState.currentDelve?.name ?? 'Delve cleared', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body36'), color: '#e7e5e4' }).setOrigin(0.5);

    // Build the left results panel for gold, elapsed time, and leader rewards.
    const leftX = width * 0.30, rightX = width * 0.70, panelY = height * 0.51, panelWidth = width * 0.34;
    this.add.rectangle(leftX, panelY, panelWidth, 430, 0x292524).setStrokeStyle(4, 0x57534e);
    this.add.text(leftX, panelY - 165, 'DELVE RESULTS', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f5f5f4' }).setOrigin(0.5);
    this.add.text(leftX, panelY - 92, `+${gold} Gold`, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('display57'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fbbf24' }).setOrigin(0.5);
    this.add.text(leftX, panelY - 35, `Total Gold: ${GameState.gold}`, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'), color: '#a8a29e' }).setOrigin(0.5);
    this.add.text(leftX, panelY + 20, `Time: ${formatDuration(summary?.elapsedMs)}`, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body36'), color: '#ffffff' }).setOrigin(0.5);

    if (summary?.isNewBest) this.add.text(leftX, panelY + 64, 'NEW BEST TIME', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#bef264' }).setOrigin(0.5);

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const tacticsReward = summary?.leaderResult?.tacticsPointsEarned > 0 ? `+${summary.leaderResult.tacticsPointsEarned} Tactics Points` : `Renown Level ${GameState.leader?.level ?? 1}`;
    this.add.text(leftX, panelY + 115, tacticsReward, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'), color: '#c4b5fd' }).setOrigin(0.5);

    // Build the right panel from the adventurer advancement entries in the run summary.
    this.add.rectangle(rightX, panelY, panelWidth, 430, 0x1f2937).setStrokeStyle(4, 0x374151);
    this.add.text(rightX, panelY - 165, 'PARTY PROGRESS', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f5f5f4' }).setOrigin(0.5);
    (summary?.adventurers ?? []).forEach((entry, index) => {

      const y = panelY - 98 + index * 66;

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const levelText = entry.levelsGained > 0 ? ` • LEVEL UP! -> ${entry.level}` : ` • Lv ${entry.level}`;
      this.add.text(rightX - panelWidth * 0.41, y, `${entry.name}: +${entry.xpGained} XP${levelText}`, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body30'), color: entry.levelsGained > 0 ? '#bef264' : '#ffffff' });

      // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
      // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the
      // object's corner.
      this.add.text(rightX + panelWidth * 0.41, y, `${entry.happiness}% happy`, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('support29'), color: '#86efac' }).setOrigin(1, 0);
    });

    // Clear temporary party and reward display state when returning to the map. Saved
    // progression remains available.
    addReturnButton(this, 'World Map', () => {
      GameState.activeParty = [];
      GameState.currentRoom = 0;
      GameState.rewards = [];
      this.scene.start('TitleScene');
    }, { x: width / 2, y: height * 0.87, feedback: 'confirm' });
  }
}
