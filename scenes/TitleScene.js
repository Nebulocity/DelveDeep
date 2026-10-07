import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { formatDuration } from '../game/ExpeditionProgression.js';
import { saveProfile, clearSavedProfile } from '../game/GameStorage.js';
import { clearLeaderProgression, grantLeaderLevels } from '../game/LeaderProgression.js';
import { grantAdventurerLevels } from '../game/AdventurerProgression.js';
import { hideLoadingScreenAfterRender } from '../ui/LoadingScreen.js';
import { createScrollingWorldMap, updateScrollingWorldMap } from './ScrollingWorldMap.js';
import { addRegionPanel, addRegionNotice, setRegionPanelState, regionMessageBounds } from '../ui/RegionMapTheme.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    createScrollingWorldMap(this);
    hideLoadingScreenAfterRender(this);
  }

  update(time, delta) {
    updateScrollingWorldMap(this, delta);
    for (const object of this.children.list) {
      if (object.depth >= 1000 && object.scrollFactorX !== 0) object.setScrollFactor(0);
    }
  }
  // This function exposes testing controls and shows whether testing mode is
  // active.
  createDevelopmentButton(width, height) {

    const enabled = GameState.development.unlockAll && GameState.development.replayCleared;
    const x = 190;
    const y = height - 52;
    const button = addRegionPanel(this, x, y, 300, 64, 1000, enabled ? 'selected' : 'normal')
      .setInteractive({ useHandCursor: true })
      .setDepth(1000);
    this.add.text(x, y, enabled ? 'DEV MODE: ON' : 'DEV TOOLS', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('support28'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2'
    }).setOrigin(0.5).setDepth(1001);
    button.on('pointerdown', () => {

      HapticsService.tap();
      this.showDevelopmentTools();
    });
  }

  // This function opens the development controls in labeled rows. Grants and
  // display preferences save immediately; progress reset asks for confirmation.
  showDevelopmentTools() {

    this.selectionDetailsClose?.();
    const { width, height } = this.scale;
    const depth = 4000;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setInteractive()
      .setDepth(depth);
    const panelWidth = Math.min(1280, width * 0.82);
    const panelHeight = Math.min(850, height * 0.84);
    const panelTop = (height - panelHeight) / 2;
    const panelLeft = (width - panelWidth) / 2;
    const rowY = (index) => panelTop + 180 + index * 90;
    const labelX = panelLeft + 100;
    const firstX = panelLeft + 720;
    const secondX = panelLeft + 995;
    const buttonWidth = 220;
    const objects = [shade];
    const panel = addRegionPanel(this, width / 2, height / 2, panelWidth, panelHeight, depth + 1);
    objects.push(panel);
    objects.push(this.add.text(width / 2, panelTop + 72, 'DEV TOOLS', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('heading48'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f8fafc'
    }).setOrigin(0.5).setDepth(depth + 2));

    const addLabel = (index, label) => {
      objects.push(this.add.text(labelX, rowY(index), label, {
        fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#e2e8f0'
      }).setOrigin(0, 0.5).setDepth(depth + 2));
    };
    const addButton = (x, y, label, color, stroke, action, textColor = '#ffffff') => {
      const button = addRegionPanel(this, x, y, buttonWidth, 74, depth + 2, label === 'RESET' ? 'danger' : label === 'ON' ? 'selected' : 'normal')
        .setInteractive({ useHandCursor: true });
      const caption = this.add.text(x, y, label, {
        fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2'
      }).setOrigin(0.5).setDepth(depth + 3);
      button.on('pointerdown', action);
      objects.push(button, caption);
      return { button, caption };
    };

    // This function removes all objects belonging to this development dialog.
    const destroy = () => {
      objects.forEach((object) => object?.destroy());
      if (this.selectionDetailsClose === destroy) this.selectionDetailsClose = null;
      this.events?.off('shutdown', destroy);
    };
    this.selectionDetailsClose = destroy;
    this.events?.once('shutdown', destroy);

    addLabel(0, 'Dev mode');
    const enabled = GameState.development.unlockAll && GameState.development.replayCleared;
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
        borderToggle.caption.setText(GameState.development.showArenaBorder ? 'ON' : 'OFF');
        setRegionPanelState(this, borderToggle.button, GameState.development.showArenaBorder ? 'selected' : 'normal');
        borderToggle.caption.setColor('#fff1d2');
      }, borderVisible ? '#1f2937' : '#ffffff');

    addLabel(5, 'Reset progress');
    addButton(firstX, rowY(5), 'RESET', 0x7f1d1d, 0xf87171, () => {
      HapticsService.tap();
      destroy();
      this.showResetConfirmation();
    });

    addButton(width / 2, panelTop + panelHeight - 52, 'CLOSE', 0x334155, 0x94a3b8, () => {
      HapticsService.tap();
      destroy();
    });
  }

  // This function asks the player to confirm before clearing saved
  // progression.
  showResetConfirmation(onCancel = () => this.showDevelopmentTools()) {

    return showConfirmation(this, {
      title: 'RESET ALL PROGRESS?',
      description: 'This clears map progress, gold, adventurer progression, and Battle Tactics progression.',
      confirmLabel: 'RESET', onCancel,
      onConfirm: () => {
        HapticsService.confirm();
        clearSavedProfile();
        clearLeaderProgression();
        this.scene.start('BootScene');
      }
    });
  }

  // This function gives brief feedback about an unavailable choice or
  // completed action.
  showToast(message, scope = 'ui') {

    const { width, height } = this.scale;
    const bounds = regionMessageBounds(this, scope);
    this.activeToast?.tween?.stop();
    this.activeToast?.panel?.destroy();
    this.activeToast?.text?.destroy();
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

  // This function lets the player review a cleared delve best time and latest
  // loot.
  showClearedReview(delve) {

    const { width, height } = this.scale;
    const { centerX, width: mapWidth } = regionMessageBounds(this, 'map');
    const record = GameState.records[delve.id] ?? {};
    const loot = (record.lastRewards ?? []).map((reward) => reward.type === 'gold' ? `${reward.amount} Gold` : reward.label ?? reward.type).join(', ') || 'No recorded loot';
    const overlay = addRegionPanel(this, centerX, height / 2, mapWidth * 0.8, height * 0.48, 3000);
    this.add.text(centerX, height * 0.34, `${delve.name} - CLEARED`, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('display52'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#bef264' })
      .setOrigin(0.5).setDepth(3001);
    this.add.text(centerX, height * 0.43, `Waves: ${record.waves ?? delve.rooms}   Best: ${formatDuration(record.bestTimeMs)}`, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'), color: '#e2e8f0' })
      .setOrigin(0.5).setDepth(3001);
    this.add.text(centerX, height * 0.51, `Last haul: ${loot}`, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'), color: '#fbbf24', wordWrap: { width: mapWidth * 0.68 }, align: 'center' })
      .setOrigin(0.5).setDepth(3001);
    const close = addRegionPanel(this, centerX, height * 0.64, 360, 78, 3001).setInteractive({ useHandCursor: true });
    this.add.text(centerX, height * 0.64, 'CLOSE', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#ffffff' }).setOrigin(0.5).setDepth(3002);
    close.on('pointerdown', () => this.scene.restart());
  }
}
