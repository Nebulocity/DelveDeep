// This presents the recorded encounter outcome and offers the real combat log. The summary
// reads collected totals; displaying it should not award resources again.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import Phaser from 'phaser';
import { Capacitor } from '@capacitor/core';
import HapticsService from '../services/HapticsService.js';
import { bindButtonPress } from '../ui/ButtonPress.js';
import GameState from '../game/GameState.js';
import { formatDuration } from '../game/ExpeditionProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';
import { addReturnButton } from '../ui/ReturnButton.js';
import { getDelveCheckpoint } from '../game/DelveCheckpoints.js';

import { loadLastCombatLog } from '../combat/CombatLog.js';

export default class EncounterSummaryScene extends Phaser.Scene {

  // This helper registers EncounterSummaryScene so the game can navigate to this screen.
  constructor() {

    super('EncounterSummaryScene');
  }

  // Explain the unsuccessful run and offer another attempt or a return to the map.
  create() {

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;

    // Read the recorded defeat or retreat outcome, with a fallback for a missing summary.
    const summary = GameState.run.summary ?? { title: 'ENCOUNTER ENDED', message: '' };
    const fled = summary.result === 'fled';
    this.cameras.main.setBackgroundColor('#15120f');

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner. ?? uses the fallback only for null or undefined. A real zero or false stays
    // intact. The condition before ? chooses the first value when true and the value after
    // : when false.
    this.add.text(width / 2, UI_SAFE_TOP + 40, summary.title ?? (fled ? 'PARTY FLED' : 'DEFEAT'), {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('display76'), fontStyle: UI_FONT_WEIGHTS.bold, color: fled ? '#fbbf24' : '#fca5a5'
    }).setOrigin(0.5);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.add.text(width / 2, height * 0.38, GameState.currentDelve?.name ?? 'The Delve', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('heading46'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#ffffff' }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.49, summary.message ?? '', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body34'), color: '#d6d3d1', align: 'center', wordWrap: { width: width * 0.7 } }).setOrigin(0.5);
    const checkpoint = getDelveCheckpoint();
    const combatLog = loadLastCombatLog();
    const combatStats = combatLog?.summary;
    this.add.text(width / 2, height * 0.57,
      `Time in encounter: ${formatDuration(summary.elapsedMs)}\n${checkpoint ? `Cleared rewards banked • ${checkpoint.campUnlocked ? 'Camp unlocked' : `Resume Wave ${checkpoint.nextWave + 1}`}` : 'Rewards kept: none'}${combatStats ? `\nDamage taken: ${combatStats.partyDamageTaken}  •  Healing: ${combatStats.partyHealing}  •  Falls: ${combatStats.partyDeaths}` : ''}`,
      { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body31'), color: '#a8a29e', align: 'center', lineSpacing: 12 }).setOrigin(0.5);

    // Capacitor detects the packaged native host, so Android browsers still get downloads.
    // The APK WebView cannot save this browser-only Blob download.
    if (!Capacitor.isNativePlatform() && combatLog?.entries?.length) {

      // This gives the display object an input hit area. Visible artwork alone does not
      // make an object respond to a tap.
      const logButton = this.add.rectangle(width / 2, height * 0.71, 520, 74, 0x292524).setStrokeStyle(3, 0x78716c)
        .setInteractive({ useHandCursor: true });
      this.add.text(width / 2, height * 0.71, 'DOWNLOAD COMBAT LOG', {
        fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('support28'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f5f5f4'
      }).setOrigin(0.5);

      // on registers a callback for later events; it does not call that callback now.
      // Long-lived emitters need matching listener cleanup.
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

    // Reopen preparation for this Delve without changing its banked checkpoint or rewards.
    // Party Select restores the previous selection and refreshes members from the roster.
    if ((fled || summary.result === 'defeat') && GameState.currentDelve) {
      const retryButton = this.add.rectangle(width / 2, height * 0.94, 520, 76, 0x382014, 0.94)
        .setStrokeStyle(3, 0xd4a15e)
        .setInteractive({ useHandCursor: true });
      const retryLabel = this.add.text(width / 2, height * 0.94, 'Try again!', {
        fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2'
      }).setOrigin(0.5);

      // Use the shared release-to-activate control and its normal haptic feedback.
      bindButtonPress(this, retryButton, [retryLabel], () => {
        HapticsService.confirm();

        // Match normal Delve entry: an unlocked camp offers farm/boss choices again.
        GameState.run.entry = checkpoint?.campUnlocked ? 'camp' : 'progress';
        this.scene.start('PartySelectScene');
      });
    }

    // Offer a return to the map and clear the temporary encounter display state.
    addReturnButton(this, 'World Map', () => {
      GameState.activeParty = [];
      GameState.currentRoom = 0;
      GameState.rewards = [];
      this.scene.start('TitleScene');
    }, { x: width / 2, y: height * 0.84, feedback: 'confirm' });
  }
}
