import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { delveDropNames } from '../game/DelveDrops.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { getDelveCheckpoint } from '../game/DelveCheckpoints.js';
import { bindSelectionDetails, addDetailsHint, delveDetails } from '../ui/SelectionDetails.js';
import { preloadCarvedStone, addStonePanel, addStoneOrnaments, stoneText, STONE } from '../ui/CarvedStone.js';
import { preparationFrame, preparationButton } from '../ui/DelvePreparation.js';
import { hallScroll } from '../ui/HallUI.js';

export default class DelveSelectScene extends Phaser.Scene {
  constructor() {
    super('DelveSelectScene');
  }

  preload() {
    preloadCarvedStone(this);
  }

  create() {
    const { width, height } = this.scale;
    const delve = GameState.currentDelve;
    if (!delve) return this.scene.start('TitleScene');
    const checkpoint = getDelveCheckpoint(delve);
    preparationFrame(this, delve, delve.type === 'void' ? 'VOID PORTAL' : 'DELVE OVERVIEW', 'WORLD MAP', () => this.scene.start('TitleScene'));
    stoneText(this, width / 2, 181, delve.subtitle, UI_FONT_SIZES.delveDescription, 3, {
      fontFamily: UI_FONT_FAMILIES.sans, fontStyle: UI_FONT_WEIGHTS.normal, color: STONE.muted, align: 'center', wordWrap: { width: width - 180 }
    });

    const left = width * 0.27;
    const right = width * 0.755;
    const panelY = height * 0.51;
    const panelHeight = height * 0.49;
    addStonePanel(this, left, panelY, width * 0.49, panelHeight, 0);
    const preview = delve.visuals?.environment?.layers[0]?.key;
    if (preview && this.textures.exists(preview)) {
      const art = this.add.image(left, panelY - 22, preview).setDepth(1);
      art.setScale(Math.min((width * 0.49 - 60) / art.width, (panelHeight - 110) / art.height));
    }
    const imageHit = this.add.rectangle(left, panelY, width * 0.49, panelHeight, 0, 0).setDepth(3);
    bindSelectionDetails(this, imageHit, () => delveDetails(delve));

    const detailsPanel = addStonePanel(this, right, panelY, width * 0.43, panelHeight, 0);
    bindSelectionDetails(this, detailsPanel, () => delveDetails(delve));
    addStoneOrnaments(this, right, panelY - panelHeight / 2 + 48, width * 0.41, this.stoneTheme, 2);
    stoneText(this, right, panelY - 205, 'DELVE INFO', UI_FONT_SIZES.delveInfoHeading, 3);
    const difficultyX = right - width * 0.105;
    const dropsX = right + width * 0.10;
    stoneText(this, difficultyX, panelY - 120, 'DIFFICULTY', UI_FONT_SIZES.delveInfoLabel, 3, { color: STONE.muted });
    stoneText(this, difficultyX, panelY - 65, delve.difficulty, UI_FONT_SIZES.delveInfoDifficulty, 3);
    stoneText(this, difficultyX, panelY + 8, `Recommended Level ${delve.recommendedLevel}`, UI_FONT_SIZES.delveInfoBody, 3, { fontFamily: UI_FONT_FAMILIES.sans });
    stoneText(this, difficultyX, panelY + 58, `${delve.rooms} waves expected`, UI_FONT_SIZES.delveInfoBody, 3, { fontFamily: UI_FONT_FAMILIES.sans });
    stoneText(this, dropsX, panelY - 120, 'POSSIBLE DROPS', UI_FONT_SIZES.delveInfoLabel, 3, { color: STONE.muted });
    const dropText = stoneText(this, dropsX - width * 0.082, panelY - 75, delveDropNames(delve).map(name => `• ${name}`).join('\n'), UI_FONT_SIZES.delveInfoBody, 3, {
      fontFamily: UI_FONT_FAMILIES.sans, color: '#e8b75c', lineSpacing: 12, align: 'left', wordWrap: { width: width * 0.185 }
    }).setOrigin(0, 0);
    const dropsScroll = hallScroll(this, { x: dropText.x, y: dropText.y, width: width * 0.185, height: 220 },
      [dropText], dropText.height, 0, () => {},
      (scene, x, y, w, h) => addStonePanel(scene, x, y, w, h, 4));
    dropsScroll.container.setDepth(3);
    if (checkpoint) {
      stoneText(this, right, panelY + 175, checkpoint.campUnlocked ? 'Camp unlocked' : `Next: Wave ${checkpoint.nextWave + 1}`, UI_FONT_SIZES.delveInfoNext, 3, {
        color: `#${this.stoneTheme.accent.toString(16).padStart(6, '0')}`
      });
    }
    addDetailsHint(this, height * 0.80, undefined, { fontSize: UI_FONT_SIZES.delveHint });
    preparationButton(this, width / 2, height * 0.91, 740, 110,
      'PARTY SELECT', () => {
        HapticsService.confirm();
        GameState.run.entry = checkpoint?.campUnlocked ? 'camp' : 'progress';
        this.scene.start('PartySelectScene');
      }, { primary: true, size: UI_FONT_SIZES.heading40 });
  }
}
