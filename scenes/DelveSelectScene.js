import { bindSelectionDetails, addDetailsHint, delveDetails } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class DelveSelectScene extends Phaser.Scene {

  // This function registers DelveSelectScene so the game can navigate to this
  // screen.
  constructor() {

    super('DelveSelectScene');
  }

  // This function presents the chosen delve before the player selects a
  // party.
  create() {

    const { width, height } = this.scale;
    const delve = GameState.currentDelve;

    // Return to the map if this screen was opened without a selected delve.
    if (!delve) {
      this.scene.start('TitleScene');
      return;
    }

    this.cameras.main.setBackgroundColor(delve.type === 'void' ? '#160b24' : '#171717');
    this.createWorldMapButton();

    this.add.text(width / 2, UI_SAFE_TOP + 24, delve.type === 'void' ? 'VOID PORTAL' : 'DELVE OVERVIEW', {
      fontFamily: 'Arial', fontSize: '56px', fontStyle: 'bold', color: delve.type === 'void' ? '#d8b4fe' : '#f5f5f4'
    }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 86, delve.name, {
      fontFamily: 'Arial', fontSize: '72px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 145, delve.subtitle, {
      fontFamily: 'Arial', fontSize: '32px', color: '#a8a29e', align: 'center', wordWrap: { width: width * 0.72 }
    }).setOrigin(0.5);

    // Display the difficulty, recommended level, expected waves, and possible
    // rewards before party selection.
    const panelY = height * 0.54;
    const detailsPanel = this.add.rectangle(width / 2, panelY, width * 0.64, 390, 0x292524).setStrokeStyle(4, delve.type === 'void' ? 0xa855f7 : 0x57534e);
    bindSelectionDetails(this, detailsPanel, () => delveDetails(delve));
    addDetailsHint(this, height * 0.77);
    this.add.text(width * 0.28, panelY - 120, 'DIFFICULTY', { fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#94a3b8' }).setOrigin(0.5);
    this.add.text(width * 0.28, panelY - 68, delve.difficulty, { fontFamily: 'Arial', fontSize: '48px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(width * 0.28, panelY + 10, `Recommended Level ${delve.recommendedLevel}`, { fontFamily: 'Arial', fontSize: '30px', color: '#d6d3d1' }).setOrigin(0.5);
    this.add.text(width * 0.28, panelY + 60, `${delve.rooms} waves expected`, { fontFamily: 'Arial', fontSize: '30px', color: '#d6d3d1' }).setOrigin(0.5);

    this.add.text(width * 0.66, panelY - 120, 'POSSIBLE DROPS', { fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#94a3b8' }).setOrigin(0.5);
    this.add.text(width * 0.66, panelY - 45, (delve.possibleDrops ?? ['Gold', 'Adventurer XP']).map((drop) => `• ${drop}`).join('\n'), {
      fontFamily: 'Arial', fontSize: '32px', color: '#fbbf24', lineSpacing: 14
    }).setOrigin(0.5, 0);

    // Continue to party selection without starting the expedition yet.
    const continueButton = this.add.rectangle(width / 2, height * 0.88, 650, 96, delve.type === 'void' ? 0x6b21a8 : 0x7c2d12)
      .setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height * 0.88, 'CONTINUE', { fontFamily: 'Arial', fontSize: '42px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    continueButton.on('pointerdown', () => {

      HapticsService.confirm(); this.scene.start('PartySelectScene');
    });
  }

  // This function gives the player a way back to the world map.
  createWorldMapButton() {

    const y = UI_SAFE_TOP + 18;
    const button = this.add.rectangle(180, y, 300, 64, 0x3f3f46).setInteractive({ useHandCursor: true });
    this.add.text(180, y, '< WORLD MAP', { fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    button.on('pointerdown', () => {

      HapticsService.tap(); this.scene.start('TitleScene');
    });
  }
}
