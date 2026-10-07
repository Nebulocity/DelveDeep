import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { formatDuration } from '../game/ExpeditionProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';
import { addReturnButton } from '../ui/ReturnButton.js';
import { getDelveCheckpoint } from '../game/DelveCheckpoints.js';
import { loadLastCombatLog } from '../combat/CombatLog.js';

export default class EncounterSummaryScene extends Phaser.Scene {

  // This function registers EncounterSummaryScene so the game can navigate to
  // this screen.
  constructor() {

    super('EncounterSummaryScene');
  }

  // This function explains the unsuccessful run and offers a return to the
  // map.
  create() {

    const { width, height } = this.scale;

    // Read the recorded defeat or retreat outcome, with a fallback for a
    // missing summary.
    const summary = GameState.run.summary ?? { title: 'ENCOUNTER ENDED', message: '' };
    const fled = summary.result === 'fled';
    this.cameras.main.setBackgroundColor('#15120f');
    this.add.text(width / 2, UI_SAFE_TOP + 40, summary.title ?? (fled ? 'PARTY FLED' : 'DEFEAT'), {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('display76'), fontStyle: UI_FONT_WEIGHTS.bold, color: fled ? '#fbbf24' : '#fca5a5'
    }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.38, GameState.currentDelve?.name ?? 'The Delve', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('heading46'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#ffffff' }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.49, summary.message ?? '', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body34'), color: '#d6d3d1', align: 'center', wordWrap: { width: width * 0.7 } }).setOrigin(0.5);
    const checkpoint = getDelveCheckpoint();
    const combatLog = loadLastCombatLog();
    const combatStats = combatLog?.summary;
    this.add.text(width / 2, height * 0.57,
      `Time in encounter: ${formatDuration(summary.elapsedMs)}\n${checkpoint ? `Cleared rewards banked • ${checkpoint.campUnlocked ? 'Camp unlocked' : `Resume Wave ${checkpoint.nextWave + 1}`}` : 'Rewards kept: none'}${combatStats ? `\nDamage taken: ${combatStats.partyDamageTaken}  •  Healing: ${combatStats.partyHealing}  •  Falls: ${combatStats.partyDeaths}` : ''}`,
      { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body31'), color: '#a8a29e', align: 'center', lineSpacing: 12 }).setOrigin(0.5);

    if (combatLog?.entries?.length) {
      const logButton = this.add.rectangle(width / 2, height * 0.71, 520, 74, 0x292524).setStrokeStyle(3, 0x78716c)
        .setInteractive({ useHandCursor: true });
      this.add.text(width / 2, height * 0.71, 'DOWNLOAD COMBAT LOG', {
        fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('support28'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f5f5f4'
      }).setOrigin(0.5);
      logButton.on('pointerdown', () => {
        const blob = new Blob([JSON.stringify(combatLog, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `delve-combat-${Date.now()}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
      });
    }

    // Offer a return to the map and clear the temporary encounter display
    // state.
    addReturnButton(this, 'World Map', () => {
      GameState.activeParty = [];
      GameState.currentRoom = 0;
      GameState.rewards = [];
      this.scene.start('TitleScene');
    }, { x: width / 2, y: height * 0.84, feedback: 'confirm' });
  }
}
