import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { formatDuration } from '../game/ExpeditionProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

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
      fontFamily: 'Arial', fontSize: '76px', fontStyle: 'bold', color: fled ? '#fbbf24' : '#fca5a5'
    }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.38, GameState.currentDelve?.name ?? 'The Delve', { fontFamily: 'Arial', fontSize: '46px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.49, summary.message ?? '', { fontFamily: 'Arial', fontSize: '34px', color: '#d6d3d1', align: 'center', wordWrap: { width: width * 0.7 } }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.60, `Time in encounter: ${formatDuration(summary.elapsedMs)}\nRewards kept: none`, { fontFamily: 'Arial', fontSize: '31px', color: '#a8a29e', align: 'center', lineSpacing: 12 }).setOrigin(0.5);

    // Offer a return to the map and clear the temporary encounter display
    // state.
    const button = this.add.rectangle(width / 2, height * 0.80, 650, 94, 0x334155).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height * 0.80, 'RETURN TO WORLD MAP', { fontFamily: 'Arial', fontSize: '37px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    button.on('pointerdown', () => {

      HapticsService.confirm();
      GameState.activeParty = [];
      GameState.currentRoom = 0;
      GameState.rewards = [];
      this.scene.start('TitleScene');
    });
  }
}
