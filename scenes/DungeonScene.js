import { bindSelectionDetails, characterDetails } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { beginExpedition } from '../game/ExpeditionProgression.js';
import { leaderAbilities } from '../game/LeaderProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class DungeonScene extends Phaser.Scene {

  // This function registers DungeonScene so the game can navigate to this
  // screen.
  constructor() {

    super('DungeonScene');
  }

  // This function builds the final battle overview so the player can review
  // the selected adventurers and equipped leadership abilities. The start
  // button records the expedition starting resources and time before entering
  // combat.
  create() {

    const { width, height } = this.scale;
    this.tacticPopup = null;
    this.tacticPressTimer = null;
    this.events.once('shutdown', () => {

      this.cancelTacticPress();
      this.hideTacticDescription();
    });
    this.cameras.main.setBackgroundColor('#15120f');

    this.add.text(70, UI_SAFE_TOP + 14, '< PARTY SELECT', { fontFamily: 'Arial', fontSize: '34px', color: '#d6d3d1' })
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => {

        HapticsService.tap(); this.scene.start('PartySelectScene');
      });
    this.add.text(width - 70, UI_SAFE_TOP + 14, 'WORLD MAP', { fontFamily: 'Arial', fontSize: '34px', color: '#d6d3d1' }).setOrigin(1, 0)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => {

        HapticsService.tap(); this.scene.start('TitleScene');
      });

    this.add.text(width / 2, UI_SAFE_TOP + 18, 'BATTLE OVERVIEW', { fontFamily: 'Arial', fontSize: '68px', fontStyle: 'bold', color: '#f5f5f4' }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 75, GameState.currentDelve?.name ?? 'The Delve', { fontFamily: 'Arial', fontSize: '38px', color: '#a8a29e' }).setOrigin(0.5);

    this.add.text(width * 0.28, height * 0.30, 'PARTY', { fontFamily: 'Arial', fontSize: '38px', fontStyle: 'bold', color: '#94a3b8' }).setOrigin(0.5);

    this.add.text(width * 0.28, height * 0.345, 'Long-press or hold-click for character details.', { fontFamily: 'Arial', fontSize: '26px', color: '#cbd5e1' }).setOrigin(0.5);

    // List the chosen adventurers with their class, role, and current level.
    GameState.activeParty.forEach((adventurer, index) => {

      const y = height * 0.38 + index * 92;
      const card = this.add.rectangle(width * 0.28, y + 7, 700, 82, 0xffffff, 0);
      bindSelectionDetails(this, card, () => characterDetails(adventurer));
      this.add.circle(width * 0.15, y, 30, adventurer.color);
      this.add.text(width * 0.18, y - 18, adventurer.name, { fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#ffffff' });
      this.add.text(width * 0.18, y + 19, `${adventurer.className} • ${adventurer.role} • Lv ${adventurer.level}`, { fontFamily: 'Arial', fontSize: '26px', color: '#cbd5e1' });
    });

    // Resolve the equipped leadership IDs into names for the tactics review.
    const equipped = GameState.leader?.battleLoadout ?? [];
    this.add.text(width * 0.70, height * 0.30, `BATTLE TACTICS ${equipped.length}/5`, { fontFamily: 'Arial', fontSize: '38px', fontStyle: 'bold', color: '#94a3b8' }).setOrigin(0.5);
    this.add.text(width * 0.70, height * 0.345, 'Long-press / hold-click for details. Mouse: hover tactics.', {
      fontFamily: 'Arial', fontSize: '26px', color: '#cbd5e1'
    }).setOrigin(0.5);
    equipped.forEach((id, index) => {

      const ability = leaderAbilities.find((entry) => entry.id === id);
      const y = height * 0.39 + index * 88;
      const card = this.add.rectangle(width * 0.70, y, 700, 64, 0x292524).setStrokeStyle(2, 0x84cc16);
      this.add.text(width * 0.70, y, ability?.name ?? id, { fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#bef264' }).setOrigin(0.5);
      if (ability) this.bindTacticDescription(card, ability);
    });

    // Start the run only when the player confirms this overview.
    const button = this.add.rectangle(width / 2, height * 0.89, 760, 104, 0x7c2d12).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height * 0.89, 'DELVE DEEP!', { fontFamily: 'Arial', fontSize: '46px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    button.on('pointerdown', () => {

      HapticsService.confirm(); beginExpedition(); this.scene.start('BattleScene');
    });
  }

  // Touch-generated pointerover events must not bypass the long press.
  bindTacticDescription(card, ability) {

    bindSelectionDetails(this, card, { title: ability.name, description: ability.description }, undefined, () => {
      this.hideTacticDescription();
      this.showTacticDescription(ability, card, true);
    });
    card.on('pointerover', (pointer) => {
      if (!pointer.wasTouch && !this.tacticPopup?.modal) this.showTacticDescription(ability, card);
    });
    card.on('pointerout', () => {
      if (!this.tacticPopup?.modal) this.hideTacticDescription();
    });
  }

  cancelTacticPress() {

    this.tacticPressTimer?.remove(false);
    this.tacticPressTimer = null;
  }

  hideTacticDescription() {

    this.tacticPopup?.objects.forEach((object) => object.destroy());
    this.tacticPopup = null;
  }

  // Use the same configured description as the tactics selection screen.
  // Touch details stay open until dismissed, with a shade blocking navigation.
  showTacticDescription(ability, card, modal = false) {

    this.hideTacticDescription();
    const { width, height } = this.scale;
    const panelWidth = 760;
    const panelHeight = modal ? 340 : 240;
    const x = modal ? width / 2 : card.x;
    const y = modal ? height / 2 : Math.min(card.y + 42 + panelHeight / 2, height - panelHeight / 2 - 30);
    const objects = [];
    this.tacticPopup = { objects, modal };
    if (modal) {
      const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)
        .setDepth(100).setInteractive();
      shade.on('pointerdown', (pointer, localX, localY, event) => {

        event.stopPropagation();
        this.hideTacticDescription();
      });
      objects.push(shade);
    }
    const panel = this.add.rectangle(x, y, panelWidth, panelHeight, 0x111827)
      .setStrokeStyle(3, 0x84cc16).setDepth(101);
    if (modal) {
      panel.setInteractive().on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());
    }
    objects.push(panel);
    objects.push(this.add.text(x, y - panelHeight / 2 + 42, ability.name, {
      fontFamily: 'Arial', fontSize: '36px', fontStyle: 'bold', color: '#bef264'
    }).setOrigin(0.5).setDepth(102));
    objects.push(this.add.text(x - panelWidth / 2 + 32, y - panelHeight / 2 + 85, ability.description, {
      fontFamily: 'Arial', fontSize: '32px', color: '#f1f5f9', wordWrap: { width: panelWidth - 64 }
    }).setDepth(102));
    if (modal) {
      const close = this.add.rectangle(x, y + panelHeight / 2 - 52, 260, 72, 0x334155)
        .setDepth(102).setInteractive({ useHandCursor: true });
      close.on('pointerdown', (pointer, localX, localY, event) => {

        event.stopPropagation();
        HapticsService.tap();
        this.hideTacticDescription();
      });
      objects.push(close, this.add.text(x, close.y, 'CLOSE', {
        fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(0.5).setDepth(103));
    }
  }
}
