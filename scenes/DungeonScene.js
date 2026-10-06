import { bindSelectionDetails, characterDetails } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { getEquippedAdventurer } from '../game/Equipment.js';
import HapticsService from '../services/HapticsService.js';
import { beginExpedition } from '../game/ExpeditionProgression.js';
import { leaderAbilities } from '../game/LeaderProgression.js';
import { showLoadingScreen } from '../ui/LoadingScreen.js';
import { preloadCarvedStone, addStonePanel, addStoneButton, stoneText, STONE } from '../ui/CarvedStone.js';
import { preparationFrame, preparationButton, preparationNotice } from '../ui/DelvePreparation.js';
import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import { preloadEnvironment } from '../combat/LayeredEnvironment.js';
import { bindButtonPress } from '../ui/ButtonPress.js';

export default class DungeonScene extends Phaser.Scene {

  // This function registers DungeonScene so the game can navigate to this
  // screen.
  constructor() {

    super('DungeonScene');
  }

  init() {
    this.enteringBattle = false;
  }

  preload() {
    preloadCarvedStone(this);
    const environment = GameState.currentDelve?.visuals?.environment;
    if (environment) preloadEnvironment(this, environment);
    for (const definition of Object.values(CHARACTER_SPRITES)) {
      const frame = definition.clips.idle.south.frames[0];
      const texture = definition.textures.find(entry => entry.key === frame.key);
      if (texture && !this.textures.exists(texture.key)) this.load.spritesheet(texture.key, texture.url, { frameWidth: 256, frameHeight: 256 });
    }
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
    preparationFrame(this, GameState.currentDelve, 'BATTLE OVERVIEW', 'PARTY SELECT', () => this.scene.start('PartySelectScene'));
    preparationButton(this, width - 240, 64, 430, 94, 'WORLD MAP >', () => this.scene.start('TitleScene'), { size: 32 });
    addStonePanel(this, width * 0.28, 541, 1020, 726, 0);
    addStonePanel(this, width * 0.72, 541, 1020, 726, 0);
    stoneText(this, width * 0.28, 218, 'PARTY', 38, 3);
    preparationNotice(this, width * 0.28, 275, 'Hold for character details.', { width: 900, depth: 3 });

    // List the chosen adventurers with their class, role, and current level.
    GameState.activeParty.forEach((adventurer, index) => {

      const y = 370 + index * 112;
      const card = addStoneButton(this, width * 0.28, y, 920, 104, 3);
      bindSelectionDetails(this, card, () => characterDetails(getEquippedAdventurer(GameState.roster.find((hero) => hero.id === adventurer.id) ?? adventurer)));
      const frame = CHARACTER_SPRITES[adventurer.id]?.clips.idle.south.frames[0];
      const x = width * 0.28 - 390;
      if (frame && this.textures.exists(frame.key)) {
        this.add.image(x, y, frame.key, frame.frame).setDisplaySize(100, 100).setFlipX(frame.flipX === true).setDepth(4);
      } else stoneText(this, x, y, adventurer.name.slice(0, 1), 48, 4);
      stoneText(this, x + 80, y - 22, adventurer.name, 36, 4).setOrigin(0, 0.5);
      stoneText(this, x + 80, y + 24, `${adventurer.shortName ?? adventurer.className} · ${adventurer.role} · Lv ${adventurer.level}`, 27, 4,
        { fontFamily: 'Arial', color: STONE.muted }).setOrigin(0, 0.5);
    });

    // Resolve the equipped leadership IDs into names for the tactics review.
    const equipped = GameState.leader?.battleLoadout ?? [];
    stoneText(this, width * 0.72, 218, `BATTLE TACTICS ${equipped.length}/5`, 38, 3);
    preparationNotice(this, width * 0.72, 275, 'Hold or hover for tactic details.', { width: 900, depth: 3 });
    if (!equipped.length) stoneText(this, width * 0.72, 480, 'No battle tactics equipped.', 32, 4, { color: STONE.muted });
    equipped.forEach((id, index) => {

      const ability = leaderAbilities.find((entry) => entry.id === id);
      const y = 370 + index * 112;
      const card = addStoneButton(this, width * 0.72, y, 920, 104, 3);
      stoneText(this, width * 0.72, y, ability?.name ?? id, 34, 4);
      if (ability) this.bindTacticDescription(card, ability);
    });

    // Start the run only when the player confirms this overview.
    preparationButton(this, width / 2, height - 74, 760, 104, 'DELVE DEEP!', () => {
      if (this.enteringBattle) return;
      this.enteringBattle = true;
      HapticsService.confirm();
      showLoadingScreen('delve', GameState.currentDelve?.name ?? 'The Delve');

      // Give the overlay one painted frame before the loader starts decoding art.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        beginExpedition();
        this.scene.start('BattleScene');
      }));
    }, { primary: true, size: 46 });
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
    const panel = addStonePanel(this, x, y, panelWidth, panelHeight, 101);
    if (modal) {
      panel.setInteractive().on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());
    }
    objects.push(panel);
    objects.push(this.add.text(x, y - panelHeight / 2 + 42, ability.name, {
      fontFamily: 'Georgia', fontSize: '36px', fontStyle: 'bold', color: STONE.text
    }).setOrigin(0.5).setDepth(102));
    objects.push(this.add.text(x, y - panelHeight / 2 + 85, ability.description, {
      fontFamily: 'Arial', fontSize: '32px', color: STONE.text, align: 'center', wordWrap: { width: panelWidth - 64 }
    }).setOrigin(0.5, 0).setDepth(102));
    if (modal) {
      const close = addStoneButton(this, x, y + panelHeight / 2 - 52, 260, 72, 102)
        .setInteractive({ useHandCursor: true });
      const label = stoneText(this, x, close.y, 'CLOSE', 32, 103);
      bindButtonPress(this, close, [label], () => { HapticsService.tap(); this.hideTacticDescription(); });
      objects.push(close, label);
    }
  }
}
