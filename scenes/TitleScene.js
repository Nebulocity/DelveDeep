// This is the region map entry screen. It connects the illustrated world, destination
// controls, travel and development tools to the saved world state.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { saveProfile, clearSavedProfile } from '../game/GameStorage.js';
import { clearLeaderProgression, grantLeaderLevels } from '../game/LeaderProgression.js';

import { grantAdventurerLevels } from '../game/AdventurerProgression.js';
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

  // This helper opens the development controls in labeled rows. Grants and display
  // preferences save immediately; progress reset asks for confirmation.
  showDevelopmentTools() {

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
    const panelWidth = Math.min(1280, width * 0.82);
    const panelHeight = Math.min(850, height * 0.84);
    const panelTop = (height - panelHeight) / 2;
    const panelLeft = (width - panelWidth) / 2;
    const rowY = (index) => panelTop + 180 + index * 84;
    const labelX = panelLeft + 100;
    const firstX = panelLeft + 720;

    const secondX = panelLeft + 995;
    const buttonWidth = 220;
    const objects = [shade];
    const panel = addRegionPanel(this, width / 2, height / 2, panelWidth, panelHeight, depth + 1);
    objects.push(panel);

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    objects.push(this.add.text(width / 2, panelTop + 72, 'DEV TOOLS', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('heading48'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f8fafc'
    }).setOrigin(0.5).setDepth(depth + 2));

    const addLabel = (index, label) => {

      // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
      // lower-depth objects. Origin is the anchor within the object: 0 is the left/top
      // edge, 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
      // necessarily the object's corner.
      objects.push(this.add.text(labelX, rowY(index), label, {
        fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#e2e8f0'
      }).setOrigin(0, 0.5).setDepth(depth + 2));
    };

    const addButton = (x, y, label, color, stroke, action, textColor = '#ffffff') => {

      // This gives the display object an input hit area. Visible artwork alone does not
      // make an object respond to a tap. The condition before ? chooses the first value
      // when true and the value after : when false.
      const button = addRegionPanel(this, x, y, buttonWidth, 74, depth + 2, label === 'RESET' ? 'danger' : label === 'ON' ? 'selected' : 'normal')
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

    addLabel(0, 'Dev mode');
    const enabled = GameState.development.unlockAll && GameState.development.replayCleared;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    addButton(firstX, rowY(0), enabled ? 'ON' : 'OFF', enabled ? 0x00f2fa : 0x08192e, 0x00f2fa, () => {
      HapticsService.confirm();
      const next = !enabled;
      GameState.development.unlockAll = next;
      GameState.development.replayCleared = next;
      saveProfile();
      destroy();
      this.scene.restart();
    }, enabled ? '#08192e' : '#ffffff');

    addLabel(1, 'Renown Level');
    for (const [amount, x] of [[1, firstX], [5, secondX]]) {
      addButton(x, rowY(1), `+${amount}`, 0x0e9c4b, 0x86efac, () => {
        HapticsService.confirm();
        const result = grantLeaderLevels(GameState.leader, amount);
        this.showToast(`Renown Level ${GameState.leader.level}  (+${result.tacticsPointsEarned} TP)`);
      });
    }

    addLabel(2, 'Character Level');
    for (const [amount, x] of [[1, firstX], [5, secondX]]) {
      addButton(x, rowY(2), `+${amount}`, 0x0e9c4b, 0x86efac, () => {
        HapticsService.confirm();
        GameState.roster.forEach(hero => grantAdventurerLevels(hero, amount));
        saveProfile();

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        this.showToast(`All characters gained ${amount} level${amount === 1 ? '' : 's'}.`);
      });
    }

    addLabel(3, 'Gold');
    for (const [amount, x] of [[100, firstX], [500, secondX]]) {
      addButton(x, rowY(3), `+${amount}`, 0xb38c0c, 0xfde047, () => {
        HapticsService.confirm();
        GameState.gold += amount;
        saveProfile();
        this.currencyText.setText(`Gold: ${GameState.gold}`);
        this.showToast(`Added ${amount} Gold.`);
      });
    }

    addLabel(4, 'Arena Border');
    const borderVisible = GameState.development.showArenaBorder !== false;
    const borderToggle = addButton(firstX, rowY(4), borderVisible ? 'ON' : 'OFF',
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

    addLabel(5, 'Music');
    const musicEnabled = GameState.development.musicEnabled === true;
    const musicToggle = addButton(firstX, rowY(5), musicEnabled ? 'ON' : 'OFF',
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

    addLabel(6, 'Reset progress');
    addButton(firstX, rowY(6), 'RESET', 0x7f1d1d, 0xf87171, () => {
      HapticsService.tap();
      destroy();
      this.showResetConfirmation();
    });

    addButton(width / 2, panelTop + panelHeight - 52, 'CLOSE', 0x334155, 0x94a3b8, () => {
      HapticsService.tap();
      destroy();
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
