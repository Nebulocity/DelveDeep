import { bindSelectionDetails, characterDetails } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { getEquippedAdventurer } from '../game/Equipment.js';
import HapticsService from '../services/HapticsService.js';
import { beginExpedition } from '../game/ExpeditionProgression.js';
import { leaderAbilities } from '../game/LeaderProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';
import { showLoadingScreen } from '../ui/LoadingScreen.js';
import { addReturnButton } from '../ui/ReturnButton.js';
import { addWoodenPanel, addWoodenNotice } from '../ui/WoodenPanel.js';

export default class DungeonScene extends Phaser.Scene {

  // This function registers DungeonScene so the game can navigate to this
  // screen.
  constructor() {

    super('DungeonScene');
  }

  init() {
    this.enteringBattle = false;
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

    addReturnButton(this, 'Party Select', () => this.scene.start('PartySelectScene'), { y: UI_SAFE_TOP + 32 });
    addReturnButton(this, 'World Map', () => this.scene.start('TitleScene'), { x: width - 312, y: UI_SAFE_TOP + 32 });

    this.add.text(width / 2, UI_SAFE_TOP + 18, 'BATTLE OVERVIEW', { fontFamily: 'Arial', fontSize: '68px', fontStyle: 'bold', color: '#f5f5f4' }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 75, GameState.currentDelve?.name ?? 'The Delve', { fontFamily: 'Arial', fontSize: '38px', color: '#a8a29e' }).setOrigin(0.5);

    this.add.text(width * 0.28, height * 0.30, 'PARTY', { fontFamily: 'Arial', fontSize: '38px', fontStyle: 'bold', color: '#94a3b8' }).setOrigin(0.5);

    addWoodenNotice(this, width * 0.28, height * 0.345, 'Hold for character details.', { width: 720, fontSize: 28, depth: 0 });

    // List the chosen adventurers with their class, role, and current level.
    GameState.activeParty.forEach((adventurer, index) => {

      const y = height * 0.40 + index * 92;
      const card = this.add.rectangle(width * 0.28, y + 7, 700, 82, 0xffffff, 0);
      bindSelectionDetails(this, card, () => characterDetails(getEquippedAdventurer(GameState.roster.find((hero) => hero.id === adventurer.id) ?? adventurer)));
      this.add.circle(width * 0.15, y, 30, adventurer.color);
      this.add.text(width * 0.18, y - 18, adventurer.name, { fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#ffffff' });
      this.add.text(width * 0.18, y + 19, `${adventurer.shortName ?? adventurer.className} • ${adventurer.role} • Lv ${adventurer.level}`, { fontFamily: 'Arial', fontSize: '28px', color: '#cbd5e1' });
    });

    // Resolve the equipped leadership IDs into names for the tactics review.
    const equipped = GameState.leader?.battleLoadout ?? [];
    this.add.text(width * 0.70, height * 0.30, `BATTLE TACTICS ${equipped.length}/5`, { fontFamily: 'Arial', fontSize: '38px', fontStyle: 'bold', color: '#94a3b8' }).setOrigin(0.5);
    addWoodenNotice(this, width * 0.70, height * 0.345, 'Hold or hover for tactic details.', { width: 780, fontSize: 28, depth: 0 });
    equipped.forEach((id, index) => {

      const ability = leaderAbilities.find((entry) => entry.id === id);
      const y = height * 0.41 + index * 88;
      const card = this.add.rectangle(width * 0.70, y, 700, 64, 0x292524).setStrokeStyle(2, 0x84cc16);
      this.add.text(width * 0.70, y, ability?.name ?? id, { fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#bef264' }).setOrigin(0.5);
      if (ability) this.bindTacticDescription(card, ability);
    });

    // Start the run only when the player confirms this overview.
    const button = this.add.rectangle(width / 2, height * 0.89, 760, 104, 0x7c2d12).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height * 0.89, 'DELVE DEEP!', { fontFamily: 'Arial', fontSize: '46px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    button.on('pointerdown', () => {
      if (this.enteringBattle) return;
      this.enteringBattle = true;
      HapticsService.confirm();
      showLoadingScreen('delve', GameState.currentDelve?.name ?? 'The Delve');
      // Give the overlay one painted frame before the loader starts decoding art.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        beginExpedition();
        this.scene.start('BattleScene');
      }));
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
    const panel = addWoodenPanel(this, x, y, panelWidth, panelHeight, 101);
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
      const close = addWoodenPanel(this, x, y + panelHeight / 2 - 52, 260, 72, 102)
        .setInteractive({ useHandCursor: true });
      close.on('pointerdown', (pointer, localX, localY, event) => {

        event.stopPropagation();
        HapticsService.tap();
        this.hideTacticDescription();
      });
      objects.push(close, this.add.text(x, close.y, 'CLOSE', {
        fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(0.5).setDepth(103));
    }
  }
}
