// Present recorded results only. Rewards and checkpoints are committed by combat.
import Phaser from 'phaser';
import { Capacitor } from '@capacitor/core';
import GameState from '../game/GameState.js';
import { formatDuration } from '../game/ExpeditionProgression.js';
import { getDelveCheckpoint } from '../game/DelveCheckpoints.js';
import { loadLastCombatLog } from '../combat/CombatLog.js';
import { resultsFrame, resultsSection, resultsText, resultsButton } from '../ui/EncounterResults.js';

export default class EncounterSummaryScene extends Phaser.Scene {
  constructor() {
    super('EncounterSummaryScene');
  }

  create() {
    const summary = GameState.run.summary ?? { title: 'ENCOUNTER ENDED', message: '' };
    const fled = summary.result === 'fled';
    const defeated = summary.result === 'defeat';
    const checkpoint = getDelveCheckpoint();
    const title = fled ? 'PARTY FLED' : defeated ? 'PARTY DEFEATED' : summary.title ?? 'ENCOUNTER ENDED';
    const layout = resultsFrame(this, GameState.currentDelve, title, defeated ? 'defeat' : 'fled',
      `Time in encounter: ${formatDuration(summary.elapsedMs)}`);
    const { centerX, contentTop, contentHeight, columnWidth, leftX, rightX, actionY, utilityY } = layout;

    resultsSection(this, leftX, contentTop, columnWidth, contentHeight, 'REWARDS & CHECKPOINT');
    const banked = checkpoint?.nextWave > 0;
    const rewardTitle = banked ? 'Cleared wave rewards retained' : checkpoint ? 'No cleared wave rewards yet' : 'ENCOUNTER STATUS';
    resultsText(this, leftX, contentTop + 100, rewardTitle, 'body36', {
      color: '#ffdb86', wordWrap: { width: columnWidth - 84 }
    });

    // Ordinary rewards are already paid per wave. Portal outcomes keep their own rules.
    const details = checkpoint
      ? ['This encounter remains uncleared.',
        checkpoint.campUnlocked ? 'Camp available at your saved checkpoint.' : `Resume at Wave ${checkpoint.nextWave + 1}.`]
      : [summary.message ?? ''];
    resultsText(this, leftX, contentTop + 180, details.join('\n\n'), 'body34', {
      originY: 0, color: '#c6bdac', wordWrap: { width: columnWidth - 96 }
    });

    resultsSection(this, rightX, contentTop, columnWidth, contentHeight, 'COMBAT STATISTICS');
    const rows = [['Damage taken', 'partyDamageTaken'], ['Healing performed', 'partyHealing'], ['Falls', 'partyDeaths']];
    const values = rows.map(([label], index) => {
      const y = contentTop + 110 + index * 100;
      resultsText(this, rightX - columnWidth / 2 + 44, y, label, 'body34', { originX: 0 });
      return resultsText(this, rightX + columnWidth / 2 - 44, y, '…', 'heading46', { originX: 1, color: '#ffdb86' });
    });

    const returnToMap = () => {
      GameState.activeParty = [];
      GameState.currentRoom = 0;
      GameState.rewards = [];
      this.scene.start('TitleScene');
    };
    if ((fled || defeated) && GameState.currentDelve) {
      resultsButton(this, leftX, actionY, columnWidth, 92, 'Try Again', () => {
        GameState.run.entry = checkpoint?.campUnlocked ? 'camp' : 'progress';
        this.scene.start('DelveSelectScene');
      });
      resultsButton(this, rightX, actionY, columnWidth, 92, 'Return to World Map', returnToMap);
    } else {
      resultsButton(this, centerX, actionY, columnWidth, 92, 'Return to World Map', returnToMap);
    }

    // Build controls before storage resolves. A shutdown token prevents a late read from
    // drawing into a restarted instance of this scene.
    let closed = false;
    this.events.once('shutdown', () => { closed = true; });
    const logStatus = resultsText(this, centerX, utilityY, 'Loading combat log…', 'support28', { color: '#c6bdac' });
    const showLog = combatLog => {
      if (closed) return;
      rows.forEach(([, key], index) => values[index].setText(combatLog?.summary?.[key] == null ? '—' : String(combatLog.summary[key])));
      if (!Capacitor.isNativePlatform() && combatLog?.entries?.length) {
        logStatus.destroy();
        resultsButton(this, centerX, utilityY, 560, 68, 'Download Combat Log', () => {
          const blob = new Blob([JSON.stringify(combatLog, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `delve-combat-${Date.now()}.json`;
          anchor.click();
          URL.revokeObjectURL(url);
        }, { utility: true });
      } else {
        logStatus.setText(Capacitor.isNativePlatform() && combatLog?.entries?.length
          ? 'Combat log download is available in the browser version.' : 'Combat log unavailable.');
      }
    };
    loadLastCombatLog().then(showLog).catch(() => showLog(null));
  }
}
