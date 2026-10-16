// This is the region map entry screen. It connects the illustrated world, destination
// controls, travel and player settings to the saved world state.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { saveProfile, clearSavedProfile } from '../game/GameStorage.js';
import { clearLeaderProgression, grantLeaderLevels } from '../game/LeaderProgression.js';
import { grantAdventurerLevels } from '../game/AdventurerProgression.js';
import { applyDevelopmentBoost, setDevelopmentExpeditionWave } from '../game/DevelopmentProgression.js';
import { everdeepRuns } from '../game/Everdeep.js';

import { hideLoadingScreenAfterRender } from '../ui/LoadingScreen.js';
import { createScrollingWorldMap, updateScrollingWorldMap } from './ScrollingWorldMap.js';
import { addRegionPanel, addRegionNotice, setRegionPanelState, regionMessageBounds } from '../ui/RegionMapTheme.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';

export default class TitleScene extends Phaser.Scene {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods.
  constructor() {
    super('TitleScene');
  }

  // We build this screen and connect its input after the queued assets are ready. Display
  // objects belong to this scene and are removed when the scene shuts down.
  create() {
    createScrollingWorldMap(this);
    hideLoadingScreenAfterRender(this);
  }

  // Phaser calls this while the screen is running. time is its clock timestamp and delta
  // is the elapsed frame time, both in milliseconds. Per-second movement needs delta /
  // 1000 so a faster display does not make the game run faster. time is a timestamp on the
  // gameplay clock in milliseconds, not a duration. delta is elapsed frame time in
  // milliseconds; divide by 1000 for movement in seconds.
  update(time, delta) {
    updateScrollingWorldMap(this, delta);
    for (const object of this.children.list) {
      if (object.depth >= 1000 && object.scrollFactorX !== 0) object.setScrollFactor(0);
    }
  }

  // Normal Settings keeps its existing controls. Seven taps on its heading open the
  // separate testing window in every build during the friends playtest.
  showDevelopmentTools(devSettings = false) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.selectionDetailsClose?.();

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    const depth = 4000;

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. This gives the display object an input hit area. Visible
    // artwork alone does not make an object respond to a tap.
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setInteractive()
      .setDepth(depth);

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    const panelWidth = Math.min(devSettings ? 1740 : 1280, width * 0.90);
    const panelHeight = Math.min(devSettings ? 920 : 850, height * 0.90);
    const panelTop = (height - panelHeight) / 2;
    const panelLeft = (width - panelWidth) / 2;
    const rowY = (index) => panelTop + (devSettings ? 160 : 180) + index * (devSettings ? 88 : 120);
    const labelX = panelLeft + 100;
    const firstX = panelLeft + (devSettings ? 650 : 720);

    const buttonWidth = 220;
    const objects = [shade];
    const panel = addRegionPanel(this, width / 2, height / 2, panelWidth, panelHeight, depth + 1);
    objects.push(panel);

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    const heading = this.add.text(width / 2, panelTop + 72, devSettings ? 'DEV SETTINGS' : 'SETTINGS', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('heading48'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f8fafc'
    }).setOrigin(0.5).setDepth(depth + 2);
    objects.push(heading);

    // The counter belongs only to this open window, so closing it locks access again.
    // Seven releases avoid opening this through an ordinary tap. There is no speed
    // requirement, so slower devices and deliberate touch input work the same way.
    if (!devSettings) {
      let taps = 0;
      heading.setInteractive().on('pointerup', () => {
        taps += 1;
        if (taps === 7) {
          HapticsService.confirm();
          this.showDevelopmentTools(true);
        }
      });
    }

    const addLabel = (index, label) => {

      // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
      // lower-depth objects. Origin is the anchor within the object: 0 is the left/top
      // edge, 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
      // necessarily the object's corner.
      objects.push(this.add.text(labelX, rowY(index), label, {
        fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#e2e8f0'
      }).setOrigin(0, 0.5).setDepth(depth + 2));
    };

    const addButton = (x, y, label, color, stroke, action, textColor = '#ffffff', controlWidth = buttonWidth) => {

      // This gives the display object an input hit area. Visible artwork alone does not
      // make an object respond to a tap. The condition before ? chooses the first value
      // when true and the value after : when false.
      const button = addRegionPanel(this, x, y, controlWidth, 74, depth + 2, label === 'RESET' ? 'danger' : label === 'ON' ? 'selected' : 'normal')
        .setInteractive({ useHandCursor: true });

      // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
      // lower-depth objects. Origin is the anchor within the object: 0 is the left/top
      // edge, 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
      // necessarily the object's corner.
      const caption = this.add.text(x, y, label, {
        fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2'
      }).setOrigin(0.5).setDepth(depth + 3);

      // on registers a callback for later events; it does not call that callback now.
      // Long-lived emitters need matching listener cleanup.
      button.on('pointerdown', action);
      objects.push(button, caption);
      return { button, caption };
    };

    // This helper removes all objects belonging to this development dialog.
    const destroy = () => {
      objects.forEach((object) => object?.destroy());
      if (this.selectionDetailsClose === destroy) this.selectionDetailsClose = null;

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      this.events?.off('shutdown', destroy);
    };

    this.selectionDetailsClose = destroy;

    // once registers a callback that removes itself after the first matching event.
    this.events?.once('shutdown', destroy);

    if (devSettings) {

      // These grants use the same caps and rewards as normal progression. No unlock
      // is saved for the window itself; only changes deliberately made here persist.
      addLabel(0, 'Map testing');
      const mapToggle = addButton(firstX, rowY(0), GameState.development.mapTestingEnabled ? 'ON' : 'OFF', 0x08192e, 0x00f2fa, () => {
        HapticsService.confirm();
        const enabled = GameState.development.mapTestingEnabled !== true;
        GameState.development.mapTestingEnabled = enabled;
        GameState.development.unlockAll = enabled;
        GameState.development.replayCleared = enabled;
        saveProfile();
        mapToggle.caption.setText(enabled ? 'ON' : 'OFF');
        setRegionPanelState(this, mapToggle.button, enabled ? 'selected' : 'normal');

        // Redraw destination access after Settings closes, keeping this dialog open.
        this.mapAccessDirty = true;
      });

      addLabel(2, 'Renown Level');
      addLabel(3, 'Character Levels (all)');
      addLabel(4, 'Gold');

      // Two compact columns leave room for readable labels on the existing panel.
      const secondX = firstX + 250;
      for (const [amount, x] of [[1, firstX], [5, secondX]]) {
        addButton(x, rowY(2), `+${amount}`, 0x0e9c4b, 0x86efac, () => {
          HapticsService.confirm();
          const result = grantLeaderLevels(GameState.leader, amount);
          this.showToast(`Renown Level ${GameState.leader.level} (+${result.renownPointsEarned} RP)`);
        });
        addButton(x, rowY(3), `+${amount}`, 0x0e9c4b, 0x86efac, () => {
          HapticsService.confirm();
          GameState.roster.forEach(hero => grantAdventurerLevels(hero, amount));
          saveProfile();
          this.showToast(`Granted up to ${amount} levels per character, within the level cap.`);
        });
      }
      for (const [amount, x] of [[1000, firstX], [5000, secondX]]) {
        addButton(x, rowY(4), `+${amount.toLocaleString('en-US')}`, 0xb38c0c, 0xfde047, () => {
          HapticsService.confirm();
          GameState.gold += amount;
          saveProfile();
          this.currencyText.setText(`Gold: ${GameState.gold}`);
          this.showToast(`Added ${amount} Gold.`);
        });
      }

      addLabel(1, 'Arena Border');
      const borderVisible = GameState.development.showArenaBorder !== false;
      const borderToggle = addButton(firstX, rowY(1), borderVisible ? 'ON' : 'OFF',
        borderVisible ? 0xebed53 : 0x4e4f19, 0xebed53, () => {
          HapticsService.confirm();
          GameState.development.showArenaBorder = !GameState.development.showArenaBorder;
          saveProfile();

          // The condition before ? chooses the first value when true and the value after :
          // when false.
          borderToggle.caption.setText(GameState.development.showArenaBorder ? 'ON' : 'OFF');
          setRegionPanelState(this, borderToggle.button, GameState.development.showArenaBorder ? 'selected' : 'normal');
          borderToggle.caption.setColor('#fff1d2');
        }, borderVisible ? '#1f2937' : '#ffffff');


      addLabel(5, 'Boost');
      for (const [index, level] of [5, 10, 15, 20, 25, 30].entries()) {
        addButton(firstX + index * 150, rowY(5), String(level), 0, 0, () => {
          HapticsService.confirm();
          const result = applyDevelopmentBoost(level);
          this.currencyText.setText(`Gold: ${GameState.gold}`);
          this.mapAccessDirty = true;
          this.showToast(result.message);
        }, '#ffffff', 130);
      }

      addLabel(6, 'Expeditions');
      const runs = everdeepRuns();
      const choices = [null, ...runs.map(run => run.id)];
      let choice = 0;
      const selector = addButton(firstX + 300, rowY(6), 'ALL EXPEDITIONS', 0, 0, () => {
        HapticsService.tap();
        choice = (choice + 1) % choices.length;
        const run = runs.find(entry => entry.id === choices[choice]);
        const hero = GameState.roster.find(entry => entry.id === run?.party[0]?.id);
        selector.caption.setText(choice ? `#${choice} - ${hero?.name ?? 'Party'} - Wave ${run.resolvedWave}` : 'ALL EXPEDITIONS');
      }, '#ffffff', 820);
      for (const [index, wave] of [10, 20, 30, 40, 50, 60, 'Complete'].entries()) {
        addButton(panelLeft + 150 + index * 235, rowY(7), String(wave), 0, 0, () => {
          HapticsService.confirm();
          const count = setDevelopmentExpeditionWave(wave, choices[choice]);
          this.showToast(count ? `${count} expedition(s): ${wave === 'Complete' ? 'complete; claim earned chests in Everdeep.' : `wave ${wave}.`}` : 'No expeditions to update.');
        }, '#ffffff', 210);
      }

      addButton(width / 2, panelTop + panelHeight - 52, 'CLOSE', 0x334155, 0x94a3b8, () => {
        HapticsService.tap();
        this.showDevelopmentTools();
      });
      return;
    }

    addLabel(0, 'BGM');
    const musicEnabled = GameState.development.musicEnabled === true;
    const musicToggle = addButton(firstX, rowY(0), musicEnabled ? 'ON' : 'OFF',
      0x08192e, 0x00f2fa, () => {
        HapticsService.confirm();
        this.game.music.setEnabled(GameState.development.musicEnabled !== true);
        saveProfile();
        const enabled = GameState.development.musicEnabled;

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        musicToggle.caption.setText(enabled ? 'ON' : 'OFF');
        setRegionPanelState(this, musicToggle.button, enabled ? 'selected' : 'normal');
      });

    addLabel(1, 'Reset progress');
    addButton(firstX, rowY(1), 'RESET', 0x7f1d1d, 0xf87171, () => {
      HapticsService.tap();
      destroy();
      this.showResetConfirmation();
    });

    addButton(width / 2, panelTop + panelHeight - 52, 'CLOSE', 0x334155, 0x94a3b8, () => {
      HapticsService.tap();
      destroy();
      if (this.mapAccessDirty) {
        this.mapAccessDirty = false;
        this.scene.restart();
      }
    });
  }

  // This helper asks the player to confirm before clearing saved progression.
  showResetConfirmation(onCancel = () => this.showDevelopmentTools()) {

    return showConfirmation(this, {
      title: 'RESET ALL PROGRESS?',
      description: 'This clears map progress, gold, adventurer progression, and Battle Tactics progression.',
      confirmLabel: 'RESET', onCancel,

      // Run the committed action after the player confirms this decision.
      onConfirm: () => {
        HapticsService.confirm();
        clearSavedProfile();
        clearLeaderProgression();
        this.scene.start('BootScene');
      }
    });
  }

  // This helper gives brief feedback about an unavailable choice or completed action.
  showToast(message, scope = 'ui') {

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    const bounds = regionMessageBounds(this, scope);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.activeToast?.tween?.stop();
    this.activeToast?.panel?.destroy();
    this.activeToast?.text?.destroy();

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    const { panel, text } = addRegionNotice(this, bounds.centerX, height * 0.17, message,
      { width: Math.min(1400, bounds.width - 80), depth: 5200, fixed: true });
    const toast = { panel, text, tween: null };
    this.activeToast = toast;
    toast.tween = this.tweens.add({ targets: [panel.regionMapArt, text], alpha: 0, delay: 1200, duration: 450, onComplete: () => {
      panel.destroy();
      text.destroy();
      if (this.activeToast === toast) this.activeToast = null;
    } });
  }
}
