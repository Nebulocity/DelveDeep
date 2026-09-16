import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { saveProfile } from '../game/GameStorage.js';
import { bindSelectionDetails } from './SelectionDetails.js';

// Shared large controls for the three inventory screens. Pages keep every
// row reachable without small scrollbars or off-screen mobile touch targets.
export default class InventoryScene extends Phaser.Scene {
  text(x, y, value, size = 34, color = '#e2e8f0', width = 0) {
    return this.add.text(x, y, value, {
      fontFamily: 'Arial', fontSize: `${size}px`, color,
      ...(width ? { wordWrap: { width } } : {})
    }).setOrigin(0, 0.5);
  }

  button(x, y, width, label, callback, { selected = false, enabled = true, details } = {}) {
    const box = this.add.rectangle(x, y, width, 78, selected ? 0x36536b : 0x273449)
      .setStrokeStyle(2, selected ? 0x93c5fd : 0x475569).setAlpha(enabled ? 1 : 0.5);
    this.text(x, y, label, 32, enabled ? '#ffffff' : '#94a3b8').setOrigin(0.5);
    if (enabled) {
      const tap = () => { HapticsService.tap(); callback(); };
      if (details) bindSelectionDetails(this, box, details, tap);
      else {
        // Use the same release/drag cancellation behavior as inspectable rows.
        bindSelectionDetails(this, box, { title: label, description: label }, tap, () => {});
      }
    }
    return box;
  }

  frame(title, returnScene, returnLabel) {
    this.selectionDetailsClose?.();
    this.children.removeAll(true);
    this.cameras.main.setBackgroundColor('#101827');
    const { width, height } = this.scale;
    // Flush with the usable game area; CSS owns device safe-area insets.
    this.add.rectangle(width / 2, 52, width, 104, 0x1e293b);
    this.button(222, 52, 330, `< ${returnLabel}`, () => this.scene.start(returnScene));
    this.text(width / 2, 52, title, 52, '#f8fafc').setOrigin(0.5);
    this.text(width - 68, 52, `${GameState.gold} GOLD`, 36, '#fbbf24').setOrigin(1, 0.5);
    if (this.message) this.text(width / 2, height - 93, this.message, 30, '#fde68a', width - 140).setOrigin(0.5);
    this.text(width / 2, height - 59, 'Long-press or hold-click a selection for details.', 26, '#94a3b8').setOrigin(0.5);
  }

  tabs(labels, current, y, onChange, left = 70, width = this.scale.width - 140) {
    const gap = 20;
    const tabWidth = (width - gap * (labels.length - 1)) / labels.length;
    labels.forEach(([id, label], index) => this.button(left + tabWidth / 2 + index * (tabWidth + gap), y, tabWidth,
      label, () => onChange(id), { selected: id === current }));
  }

  pager(total, count, field, x, y, width = 620) {
    const pages = Math.max(1, Math.ceil(total / count));
    this[field] = Math.max(0, Math.min(this[field] ?? 0, pages - 1));
    this.button(x - width / 2 + 100, y, 190, '< PREV', () => { this[field]--; this.render(); }, { enabled: this[field] > 0 });
    this.text(x, y, `${this[field] + 1} / ${pages}`, 30).setOrigin(0.5);
    this.button(x + width / 2 - 100, y, 190, 'NEXT >', () => { this[field]++; this.render(); }, { enabled: this[field] < pages - 1 });
    return this[field] * count;
  }

  commit(result) {
    this.message = result.message;
    if (result.ok) { saveProfile(); HapticsService.confirm(); }
    this.render();
  }
}
