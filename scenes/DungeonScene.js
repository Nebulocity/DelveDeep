// We review the selected party and Delve before starting combat. The environment artwork
// and stone theme come from the chosen encounter, while saved checkpoints determine
// whether the next entry is an ordinary wave or the camp.

import { fontPx, UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { bindSelectionDetails } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { equippedItem, equipmentStatsText, getEquippedAdventurer } from '../game/Equipment.js';
import HapticsService from '../services/HapticsService.js';
import { beginExpedition } from '../game/ExpeditionProgression.js';

import { leaderAbilities } from '../game/LeaderProgression.js';
import { showLoadingScreen } from '../ui/LoadingScreen.js';
import { preloadCarvedStone, addStonePanel, addStoneButton, stoneText, STONE } from '../ui/CarvedStone.js';
import { preparationFrame, preparationButton, preparationNotice } from '../ui/DelvePreparation.js';
import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import { preloadEnvironment } from '../combat/LayeredEnvironment.js';
import { bindButtonPress } from '../ui/ButtonPress.js';

import { abilitySummary, leaderAbilityDescription } from '../game/AbilityDescriptions.js';
import { rankedAbility } from '../game/AdventurerAbilities.js';

export default class DungeonScene extends Phaser.Scene {

  // This helper registers DungeonScene so the game can navigate to this screen.
  constructor() {

    super('DungeonScene');
  }

  // Read the data supplied when this scene starts before creating its screen contents.
  init() {
    this.enteringBattle = false;
  }

  // We queue the assets this screen needs. Phaser finishes this loading step before
  // calling create, so later code can look up the assets by their keys.
  preload() {
    preloadCarvedStone(this);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const environment = GameState.currentDelve?.visuals?.environment;
    if (environment) preloadEnvironment(this, environment);
    for (const definition of Object.values(CHARACTER_SPRITES)) {
      const frame = definition.clips.idle.south.frames[0];

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const texture = definition.textures.find(entry => entry.key === frame.key);
      if (texture && !this.textures.exists(texture.key)) this.load.spritesheet(texture.key, texture.url, { frameWidth: 256, frameHeight: 256 });
    }
  }

  // This helper builds the final battle overview so the player can review the selected
  // adventurers and equipped leadership abilities. The start button records the expedition
  // starting resources and time before entering combat.
  create() {

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    this.tacticPopup = null;
    this.tacticPressTimer = null;

    // once registers a callback that removes itself after the first matching event.
    this.events.once('shutdown', () => {

      this.cancelTacticPress();
      this.hideTacticDescription();
    });
    preparationFrame(this, GameState.currentDelve, 'BATTLE OVERVIEW', 'PARTY SELECT', () => this.scene.start('PartySelectScene'));
    preparationButton(this, width - 240, 64, 430, 94, 'WORLD MAP >', () => this.scene.start('TitleScene'), { size: UI_FONT_SIZES.body32 });

    addStonePanel(this, width * 0.28, 541, 1020, 726, 0);
    addStonePanel(this, width * 0.72, 541, 1020, 726, 0);
    stoneText(this, width * 0.28, 218, 'PARTY', UI_FONT_SIZES.heading38, 3);
    preparationNotice(this, width * 0.28, 275, 'Hold for character details.', { width: 900, depth: 3 });

    // List the chosen adventurers with their class, role, and current level.
    GameState.activeParty.forEach((adventurer, index) => {

      const y = 370 + index * 112;
      const card = addStoneButton(this, width * 0.28, y, 920, 104, 3);
      bindSelectionDetails(this, card, () => this.adventurerDetails(GameState.roster.find((hero) => hero.id === adventurer.id) ?? adventurer));

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      const frame = CHARACTER_SPRITES[adventurer.id]?.clips.idle.south.frames[0];
      const x = width * 0.28 - 390;
      if (frame && this.textures.exists(frame.key)) {

        // Depth is drawing order, not distance or size. Higher-depth objects draw on top
        // of lower-depth objects.
        this.add.image(x, y, frame.key, frame.frame).setDisplaySize(100, 100).setFlipX(frame.flipX === true).setDepth(4);
      } else stoneText(this, x, y, adventurer.name.slice(0, 1), UI_FONT_SIZES.heading48, 4);

      // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
      // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the
      // object's corner.
      stoneText(this, x + 80, y - 22, adventurer.name, UI_FONT_SIZES.overviewName, 4).setOrigin(0, 0.5);

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      stoneText(this, x + 80, y + 24, `${adventurer.shortName ?? adventurer.className} · ${adventurer.role} · Lv ${adventurer.level}`, UI_FONT_SIZES.overviewDetails, 4,
        { fontFamily: UI_FONT_FAMILIES.sans, color: STONE.muted }).setOrigin(0, 0.5);
    });

    // Resolve the equipped leadership IDs into names for the tactics review.
    const equipped = GameState.leader?.battleLoadout ?? [];
    stoneText(this, width * 0.72, 218, `BATTLE TACTICS ${equipped.length}/5`, UI_FONT_SIZES.heading38, 3);
    preparationNotice(this, width * 0.72, 275, 'Hold or hover for tactic details.', { width: 900, depth: 3 });

    if (!equipped.length) stoneText(this, width * 0.72, 480, 'No battle tactics equipped.', UI_FONT_SIZES.body32, 4, { color: STONE.muted });
    equipped.forEach((id, index) => {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const ability = leaderAbilities.find((entry) => entry.id === id);
      const y = 370 + index * 112;
      const card = addStoneButton(this, width * 0.72, y, 920, 104, 3);

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact. ?. only follows this link when the value exists; a missing optional value
      // gives undefined.
      stoneText(this, width * 0.72, y, ability?.name ?? id, UI_FONT_SIZES.overviewTactic, 4);
      if (ability) this.bindTacticDescription(card, ability);
    });

    // Start the run only when the player confirms this overview.
    preparationButton(this, width / 2, height - 74, 760, 104, 'DELVE DEEP!', () => {
      if (this.enteringBattle) return;
      this.enteringBattle = true;
      HapticsService.confirm();

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact. ?. only follows this link when the value exists; a missing optional value
      // gives undefined.
      showLoadingScreen('delve', GameState.currentDelve?.name ?? 'The Delve');

      // Give the overlay one painted frame before the loader starts decoding art.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        beginExpedition();
        this.scene.start('BattleScene');
      }));
    }, { primary: true, size: UI_FONT_SIZES.heading46 });
  }

  // Build the selected character's gear-adjusted overview and equipped skill details.
  adventurerDetails(hero) {
    const stats = getEquippedAdventurer(hero);

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry. filter keeps entries whose callback returns
    // true. It builds a new list and leaves the original list in place. ?? uses the
    // fallback only for null or undefined. A real zero or false stays intact.
    const skills = (hero.abilityLoadout ?? []).filter(key => hero.abilities?.[key] && (hero.abilityRanks?.[key] ?? 0) > 0)
      .map(key => abilitySummary(stats, rankedAbility(hero.abilities[key], hero.abilityRanks[key])));

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    return {
      title: hero.name, align: 'left',
      description: `${hero.className} | ${hero.role} | Level ${hero.level}\n\nHealth: ${Math.round(stats.maxHp)} | Mana: ${Math.round(stats.maxMana ?? 0)} | Armor: ${Math.round(stats.armor ?? 0)}\nAttack Power: ${Math.round(stats.attackPower)} | Spell Damage: ${Math.round(stats.spellDamage ?? 0)} | Spell Healing: ${Math.round(stats.spellHealing ?? 0)}\nSpeed: ${Math.round(stats.speed ?? 100)} | Dodge: ${Math.round((stats.dodge ?? 0) * 100)}% | Crit: ${Math.round((stats.critChance ?? 0) * 100)}%\n\nEquipped Skills\n${skills.length ? skills.join('\n\n') : 'No skills equipped.'}`,
      gear: ['weapon', 'armor', 'accessory', 'potion'].map(slot => {
        const item = equippedItem(hero, slot);

        // ?? uses the fallback only for null or undefined. A real zero or false stays
        // intact. ?. only follows this link when the value exists; a missing optional
        // value gives undefined. The condition before ? chooses the first value when true
        // and the value after : when false.
        return { slot, name: item?.name ?? 'Empty slot', summary: item ? slot === 'potion'
          ? `${item.charges}/3 potions` : equipmentStatsText(item.stats) : 'Unequipped' };
      })
    };
  }

  // Touch-generated pointerover events must not bypass the long press.
  bindTacticDescription(card, ability) {

    bindSelectionDetails(this, card, { title: ability.name, description: ability.description }, undefined, () => {
      this.hideTacticDescription();
      this.showTacticDescription(ability, card, true);
    });

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    card.on('pointerover', (pointer) => {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      if (!pointer.wasTouch && !this.tacticPopup?.modal) this.showTacticDescription(ability, card);
    });
    card.on('pointerout', () => {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      if (!this.tacticPopup?.modal) this.hideTacticDescription();
    });
  }

  // Cancel the pending hold gesture so it cannot later open or activate a tactic.
  cancelTacticPress() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.tacticPressTimer?.remove(false);
    this.tacticPressTimer = null;
  }

  // Remove the current tactic details display and clear its stored reference.
  hideTacticDescription() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.tacticPopup?.objects.forEach((object) => object.destroy());
    this.tacticPopup = null;
  }

  // Use the same configured description as the tactics selection screen. Touch details
  // stay open until dismissed, with a shade blocking navigation.
  showTacticDescription(ability, card, modal = false) {

    this.hideTacticDescription();

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    const panelWidth = 760;

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    const description = leaderAbilityDescription(ability, GameState.activeParty.map(hero => getEquippedAdventurer(hero)));

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. Origin is the anchor within the object: 0 is the left/top edge,
    // 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
    // necessarily the object's corner.
    const body = this.add.text(0, 0, description, {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'), color: STONE.text, align: 'center', wordWrap: { width: panelWidth - 64 }
    }).setOrigin(0.5, 0).setDepth(102);

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound. The condition before ? chooses the first
    // value when true and the value after : when false.
    const panelHeight = Math.min(height - 100, body.height + (modal ? 190 : 120));
    const x = modal ? width / 2 : card.x;
    const y = modal ? height / 2 : Math.min(card.y + 42 + panelHeight / 2, height - panelHeight / 2 - 30);
    const objects = [];
    this.tacticPopup = { objects, modal };

    if (modal) {

      // This gives the display object an input hit area. Visible artwork alone does not
      // make an object respond to a tap.
      const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)
        .setDepth(100).setInteractive();

      // on registers a callback for later events; it does not call that callback now.
      // Long-lived emitters need matching listener cleanup.
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
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold, color: STONE.text
    }).setOrigin(0.5).setDepth(102));

    objects.push(body.setPosition(x, y - panelHeight / 2 + 85));
    if (modal) {
      const close = addStoneButton(this, x, y + panelHeight / 2 - 52, 260, 72, 102)
        .setInteractive({ useHandCursor: true });
      const label = stoneText(this, x, close.y, 'CLOSE', UI_FONT_SIZES.body32, 103);
      bindButtonPress(this, close, [label], () => {
        HapticsService.tap();
        this.hideTacticDescription();
      });
      objects.push(close, label);
    }
  }
}
