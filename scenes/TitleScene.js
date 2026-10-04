import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { formatDuration } from '../game/ExpeditionProgression.js';
import { saveProfile, clearSavedProfile } from '../game/GameStorage.js';
import { clearLeaderProgression, grantLeaderLevels } from '../game/LeaderProgression.js';
import { hideLoadingScreenAfterRender } from '../ui/LoadingScreen.js';
import { createScrollingWorldMap, updateScrollingWorldMap } from './ScrollingWorldMap.js';

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
    const button = this.add.rectangle(x, y, 300, 64, enabled ? 0x00f2fa : 0x08192e, 0.94)
      .setStrokeStyle(3, 0x00f2fa)
      .setInteractive({ useHandCursor: true })
      .setDepth(1000);
    this.add.text(x, y, enabled ? 'DEV MODE: ON' : 'DEV TOOLS', {
      fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', color: enabled ? '#08192e' : '#ffffff'
    }).setOrigin(0.5).setDepth(1001);
    button.on('pointerdown', () => {

      HapticsService.tap();
      this.showDevelopmentTools();
    });
  }

  // This function opens the development controls in labeled rows. Grants and
  // display preferences save immediately; progress reset asks for confirmation.
  showDevelopmentTools() {

    const { width, height } = this.scale;
    const depth = 4000;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setInteractive()
      .setDepth(depth);
    const panelWidth = Math.min(1280, width * 0.82);
    const panelHeight = Math.min(850, height * 0.84);
    const panelTop = (height - panelHeight) / 2;
    const panelLeft = (width - panelWidth) / 2;
    const rowY = (index) => panelTop + 180 + index * 105;
    const labelX = panelLeft + 100;
    const firstX = panelLeft + 720;
    const secondX = panelLeft + 995;
    const buttonWidth = 220;
    const objects = [shade];
    const panel = this.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x0b0f16, 0.99)
      .setStrokeStyle(5, 0x475569)
      .setDepth(depth + 1);
    objects.push(panel);
    objects.push(this.add.text(width / 2, panelTop + 72, 'DEV TOOLS', {
      fontFamily: 'Arial', fontSize: '48px', fontStyle: 'bold', color: '#f8fafc'
    }).setOrigin(0.5).setDepth(depth + 2));

    const addLabel = (index, label) => {
      objects.push(this.add.text(labelX, rowY(index), label, {
        fontFamily: 'Arial', fontSize: '36px', fontStyle: 'bold', color: '#e2e8f0'
      }).setOrigin(0, 0.5).setDepth(depth + 2));
    };
    const addButton = (x, y, label, color, stroke, action, textColor = '#ffffff') => {
      const button = this.add.rectangle(x, y, buttonWidth, 74, color)
        .setStrokeStyle(3, stroke).setInteractive({ useHandCursor: true }).setDepth(depth + 2);
      const caption = this.add.text(x, y, label, {
        fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: textColor
      }).setOrigin(0.5).setDepth(depth + 3);
      button.on('pointerdown', action);
      objects.push(button, caption);
      return { button, caption };
    };

    // This function removes all objects belonging to this development dialog.
    const destroy = () => objects.forEach((object) => object?.destroy());

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

    addLabel(1, 'Level up');
    for (const [amount, x] of [[1, firstX], [5, secondX]]) {
      addButton(x, rowY(1), `+${amount}`, 0x0e9c4b, 0x86efac, () => {
        HapticsService.confirm();
        const result = grantLeaderLevels(GameState.leader, amount);
        this.showToast(`Player level ${GameState.leader.level}  (+${result.tacticsPointsEarned} TP)`);
      });
    }

    addLabel(2, 'Gold');
    for (const [amount, x] of [[100, firstX], [500, secondX]]) {
      addButton(x, rowY(2), `+${amount}`, 0xb38c0c, 0xfde047, () => {
        HapticsService.confirm();
        GameState.gold += amount;
        saveProfile();
        this.currencyText.setText(`Gold: ${GameState.gold}`);
        this.showToast(`Added ${amount} Gold.`);
      });
    }

    addLabel(3, 'Grid lines');
    const gridVisible = GameState.development.showGridLines !== false;
    const gridToggle = addButton(firstX, rowY(3), gridVisible ? 'ON' : 'OFF',
      gridVisible ? 0xebed53 : 0x4e4f19, 0xebed53, () => {
        HapticsService.confirm();
        GameState.development.showGridLines = !GameState.development.showGridLines;
        saveProfile();
        gridToggle.caption.setText(GameState.development.showGridLines ? 'ON' : 'OFF');
        gridToggle.button.setFillStyle(GameState.development.showGridLines ? 0xebed53 : 0x4e4f19);
        gridToggle.caption.setColor(GameState.development.showGridLines ? '#1f2937' : '#ffffff');
      }, gridVisible ? '#1f2937' : '#ffffff');

    addLabel(4, 'Reset progress');
    addButton(firstX, rowY(4), 'RESET', 0x7f1d1d, 0xf87171, () => {
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
  showResetConfirmation() {

    const { width, height } = this.scale;
    const depth = 4100;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78).setInteractive().setDepth(depth);
    const panelWidth = Math.min(980, width * 0.58);
    const panel = this.add.rectangle(width / 2, height / 2, panelWidth, 430, 0x111827, 0.99)
      .setStrokeStyle(5, 0xef4444).setDepth(depth + 1);
    const title = this.add.text(width / 2, height * 0.41, 'RESET ALL PROGRESS?', {
      fontFamily: 'Arial', fontSize: '44px', fontStyle: 'bold', color: '#fecaca'
    }).setOrigin(0.5).setDepth(depth + 2);
    const body = this.add.text(width / 2, height * 0.48, 'This clears map progress, gold, adventurer progression, and Battle Tactics progression.', {
      fontFamily: 'Arial', fontSize: '29px', color: '#e5e7eb', align: 'center', wordWrap: { width: Math.min(760, panelWidth - 120), useAdvancedWrap: true }
    }).setOrigin(0.5).setDepth(depth + 2);

    const yes = this.add.rectangle(width / 2 - 190, height * 0.60, 320, 76, 0x991b1b)
      .setInteractive({ useHandCursor: true }).setDepth(depth + 2);
    const yesText = this.add.text(width / 2 - 190, height * 0.60, 'RESET', {
      fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setDepth(depth + 3);
    const no = this.add.rectangle(width / 2 + 190, height * 0.60, 320, 76, 0x334155)
      .setInteractive({ useHandCursor: true }).setDepth(depth + 2);
    const noText = this.add.text(width / 2 + 190, height * 0.60, 'CANCEL', {
      fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setDepth(depth + 3);

    const objects = [shade, panel, title, body, yes, yesText, no, noText];

    // This function removes all objects belonging to this development dialog.
    const destroy = () => objects.forEach((object) => object?.destroy());

    yes.on('pointerdown', () => {

      HapticsService.confirm();
      clearSavedProfile();
      clearLeaderProgression();
      destroy();
      this.scene.start('BootScene');
    });
    no.on('pointerdown', () => {

      HapticsService.tap();
      destroy();
      this.showDevelopmentTools();
    });
  }

  // This function gives brief feedback about an unavailable choice or
  // completed action.
  showToast(message) {

    const { width, height } = this.scale;
    this.activeToast?.tween?.stop();
    this.activeToast?.panel?.destroy();
    this.activeToast?.text?.destroy();
    const panel = this.add.rectangle(width / 2, height * 0.17, Math.min(1200, width * 0.65), 82, 0x0f172a, 0.96)
      .setStrokeStyle(3, 0x64748b).setDepth(4200);
    const text = this.add.text(width / 2, height * 0.17, message, { fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#f8fafc' })
      .setOrigin(0.5).setDepth(4201);
    const toast = { panel, text, tween: null };
    this.activeToast = toast;
    toast.tween = this.tweens.add({ targets: [panel, text], alpha: 0, delay: 1200, duration: 450, onComplete: () => {
      panel.destroy();
      text.destroy();
      if (this.activeToast === toast) this.activeToast = null;
    } });
  }

  // This function lets the player review a cleared delve best time and latest
  // loot.
  showClearedReview(delve) {

    const { width, height } = this.scale;
    const record = GameState.records[delve.id] ?? {};
    const loot = (record.lastRewards ?? []).map((reward) => reward.type === 'gold' ? `${reward.amount} Gold` : reward.label ?? reward.type).join(', ') || 'No recorded loot';
    const overlay = this.add.rectangle(width / 2, height / 2, width * 0.64, height * 0.48, 0x0b0f16, 0.97)
      .setStrokeStyle(5, 0x86efac).setDepth(3000);
    this.add.text(width / 2, height * 0.34, `${delve.name} - CLEARED`, { fontFamily: 'Arial', fontSize: '52px', fontStyle: 'bold', color: '#bef264' })
      .setOrigin(0.5).setDepth(3001);
    this.add.text(width / 2, height * 0.43, `Waves: ${record.waves ?? delve.rooms}   Best: ${formatDuration(record.bestTimeMs)}`, { fontFamily: 'Arial', fontSize: '32px', color: '#e2e8f0' })
      .setOrigin(0.5).setDepth(3001);
    this.add.text(width / 2, height * 0.51, `Last haul: ${loot}`, { fontFamily: 'Arial', fontSize: '32px', color: '#fbbf24', wordWrap: { width: width * 0.52 }, align: 'center' })
      .setOrigin(0.5).setDepth(3001);
    const close = this.add.rectangle(width / 2, height * 0.64, 360, 78, 0x334155).setInteractive({ useHandCursor: true }).setDepth(3001);
    this.add.text(width / 2, height * 0.64, 'CLOSE', { fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(3002);
    close.on('pointerdown', () => this.scene.restart());
  }
}
