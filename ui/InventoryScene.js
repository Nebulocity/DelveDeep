// This shared inventory screen joins owned items to their catalog definitions. Filtering
// and paging choose the visible rows; equipping and ownership rules still belong to the
// game helpers.

import { UI_FONT_SIZES, UI_FONT_FAMILIES } from '../config/uiTypography.js';
import { addWoodenPanel } from './WoodenPanel.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { saveProfile } from '../game/GameStorage.js';
import { bindSelectionDetails } from './SelectionDetails.js';

import { addHallBackground } from './HallBackground.js';
import { addReturnButton } from './ReturnButton.js';

// Shared large controls for the three inventory screens. Pages keep every row reachable
// without small scrollbars or off-screen mobile touch targets.
export default class InventoryScene extends Phaser.Scene {

  // Build styled text at the requested position using this screen's shared text defaults.
  text(x, y, value, size = UI_FONT_SIZES.body34, color = '#e2e8f0', width = 0) {
    if (this.scene.key === 'ItemsScene' && color === '#e2e8f0') color = '#f1dfca';

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner. ... copies the source's own fields into this object; fields listed later
    // replace earlier ones. This is a shallow copy, so nested objects are still shared.
    // The condition before ? chooses the first value when true and the value after : when
    // false.
    return this.add.text(x, y, value, {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: `${size}px`, color,
      ...(width ? { wordWrap: { width } } : {})
    }).setOrigin(0, 0.5);
  }

  // Build a themed control and attach the supplied action to its valid press.
  button(x, y, width, label, callback, { selected = false, enabled = true, details } = {}) {
    const hall = this.scene.key === 'ItemsScene';

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const box = this.add.rectangle(x, y, width, 78, hall ? (selected ? 0x6b4527 : 0x3a2418) : (selected ? 0x36536b : 0x273449))
      .setStrokeStyle(hall ? 3 : 2, hall ? (selected ? 0xffd58e : 0xb9874d) : (selected ? 0x93c5fd : 0x475569)).setAlpha(enabled ? 1 : 0.5);

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    this.text(x, y, label, UI_FONT_SIZES.body32, enabled ? (hall ? '#fff1d2' : '#ffffff') : '#ad9981').setOrigin(0.5);
    if (enabled) {
      const tap = () => {
        HapticsService.tap();
        callback();
      };
      if (details) bindSelectionDetails(this, box, details, tap);
      else {

        // Use the same release/drag cancellation behavior as inspectable rows.
        bindSelectionDetails(this, box, { title: label, description: label }, tap, () => {});
      }
    }

    return box;
  }

  // Build the inventory workspace framing and navigation.
  frame(title, returnScene, returnLabel) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.selectionDetailsClose?.();
    this.children.removeAll(true);
    const hall = this.scene.key === 'ItemsScene';

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.cameras.main.setBackgroundColor(hall ? '#1b0e09' : '#101827');

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    if (returnScene === 'AdventurersHallScene') addHallBackground(this, 0.62);

    // Flush with the usable game area; CSS owns device safe-area insets.
    this.add.rectangle(width / 2, 52, width, 104, hall ? 0x180d09 : 0x1e293b, hall ? 0.86 : 1);
    addReturnButton(this, returnLabel, () => this.scene.start(returnScene), { y: 52 });

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    this.text(width / 2, 52, title, UI_FONT_SIZES.display52, hall ? '#fff1d2' : '#f8fafc').setOrigin(0.5);
    this.text(width - 68, 52, `${GameState.gold} GOLD`, UI_FONT_SIZES.body36, '#fbbf24').setOrigin(1, 0.5);
    if (this.message) addWoodenPanel(this, width / 2, height - 93, width - 160, 64);
    addWoodenPanel(this, width / 2, height - 51, 1080, 56);

    if (this.message) this.text(width / 2, height - 93, this.message, UI_FONT_SIZES.body32, '#fde68a', width - 140).setOrigin(0.5);
    this.text(width / 2, height - 59, 'Long-press or hold-click a selection for details.', UI_FONT_SIZES.helperMessage,
      returnScene === 'AdventurersHallScene' ? '#f4d5ab' : '#94a3b8').setOrigin(0.5);
  }

  // Build the shared inventory category navigation at the supplied available width.
  tabs(labels, current, y, onChange, left = 70, width = this.scale.width - 140) {
    const gap = 20;
    const tabWidth = (width - gap * (labels.length - 1)) / labels.length;
    labels.forEach(([id, label], index) => this.button(left + tabWidth / 2 + index * (tabWidth + gap), y, tabWidth,
      label, () => onChange(id), { selected: id === current }));
  }

  // Display the current page controls and connect valid previous/next choices.
  pager(total, count, field, x, y, width = 620) {

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound. Math.ceil rounds upward to the next integer,
    // including when the value has a fractional part.
    const pages = Math.max(1, Math.ceil(total / count));

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    this[field] = Math.max(0, Math.min(this[field] ?? 0, pages - 1));
    this.button(x - width / 2 + 100, y, 190, 'PREV', () => {
      this[field]--;
      this.render();
    }, { enabled: this[field] > 0 });

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    this.text(x, y, `${this[field] + 1} / ${pages}`, UI_FONT_SIZES.body32).setOrigin(0.5);
    this.button(x + width / 2 - 100, y, 190, 'NEXT >', () => {
      this[field]++;
      this.render();
    }, { enabled: this[field] < pages - 1 });
    return this[field] * count;
  }

  // Save the completed inventory or character change and refresh the visible workspace.
  commit(result) {
    this.message = result.message;
    if (result.ok) {
      saveProfile();
      HapticsService.confirm();
    }
    this.render();
  }
}
