// A confirmation is a temporary group of UI objects above the current screen. Its blocker
// catches input before the screen beneath it. Confirm and cancel both need to remove that
// whole group and restore the caller's appropriate state.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import HapticsService from '../services/HapticsService.js';
import { addWoodenPanel } from './WoodenPanel.js';
import { addRegionPanel } from './RegionMapTheme.js';
import { isGuildHall } from './GuildHallTheme.js';
import { showGuildConfirmation } from './GuildHallDialogs.js';
import { addStonePanel, addStoneButton, STONE } from './CarvedStone.js';

import { bindButtonPress } from './ButtonPress.js';

// Nothing is committed until a fresh press and release on CONFIRM. Reusing the modal lock
// also prevents held selections behind the dialog from firing.
export function showConfirmation(scene, { title, description, confirmLabel = 'CONFIRM', onConfirm, onCancel }) {
  if (isGuildHall(scene)) return showGuildConfirmation(scene, { title, description, confirmLabel, onConfirm, onCancel });

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  scene.selectionDetailsClose?.();

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { width, height } = scene.scale;
  const hall = true;
  const regionMap = scene.scene?.key === 'TitleScene';
  const stone = scene.scene?.key === 'BattleScene';
  const objects = [];
  const depth = 11000;

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound.
  const panelWidth = Math.min(1200, width - 120);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scene.events.off('shutdown', close);

    if (scene.selectionDetailsClose === close) scene.selectionDetailsClose = null;
    objects.forEach((object) => object.destroy());
  };

  scene.selectionDetailsClose = close;

  // once registers a callback that removes itself after the first matching event.
  scene.events.once('shutdown', close);
  const add = (object) => {
    objects.push(object);
    return object;
  };

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects. The condition before ? chooses the first value when true and the
  // value after : when false.
  const body = add(scene.add.text(width / 2 - panelWidth / 2 + 52, 0, description, {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body36'), color: stone ? STONE.text : hall ? '#f1dfca' : '#e2e8f0', wordWrap: { width: panelWidth - 104 },
    align: stone ? 'center' : 'left', fixedWidth: stone ? panelWidth - 104 : undefined
  }).setDepth(depth + 2));
  const panelHeight = Math.max(420, body.height + 240);
  const top = (height - panelHeight) / 2;
  body.setY(top + 110);

  const stop = (pointer, x, y, event) => event?.stopPropagation?.();
  for (const [index, [w, h, color, alpha]] of [[width, height, 0x000000, 0.75], [panelWidth, panelHeight, hall ? 0x21130d : 0x111827, 1]].entries()) {

    // This gives the display object an input hit area. Visible artwork alone does not make
    // an object respond to a tap.
    const box = add((index === 1 ? (stone ? addStonePanel : regionMap ? addRegionPanel : addWoodenPanel)(scene, width / 2, height / 2, w, h, depth + index)
      : scene.add.rectangle(width / 2, height / 2, w, h, color, alpha).setDepth(depth + index)).setInteractive());

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    box.on('pointerdown', stop);
    box.on('pointerup', stop);
  }

  // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center and
  // 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
  // corner.
  add(scene.add.text(width / 2, top + 52, title, {
    fontFamily: stone ? UI_FONT_FAMILIES.serif : UI_FONT_FAMILIES.sans, fontSize: fontPx('heading42'), fontStyle: UI_FONT_WEIGHTS.bold, color: stone ? STONE.text : hall ? '#fff1d2' : '#f8fafc',
    wordWrap: { width: panelWidth - 104 }, align: 'center'
  }).setOrigin(0.5).setDepth(depth + 2));

  const button = (x, label, color, accept) => {
    const y = top + panelHeight - 72;
    if (stone) {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const box = add(addStoneButton(scene, x, y, (panelWidth - 156) / 2, 96, depth + 2, accept ? 0x3f1d1d : 0x1f2937));

      // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
      // lower-depth objects. Origin is the anchor within the object: 0 is the left/top
      // edge, 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
      // necessarily the object's corner.
      const caption = add(scene.add.text(x, y, label, { fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('body34'), color: STONE.text })
        .setOrigin(0.5).setDepth(depth + 3));
      bindButtonPress(scene, box, [caption], () => {
        if (closed) return;
        close();
        HapticsService.tap();

        if (accept) onConfirm();
        else onCancel?.();
      });

      return;
    }

    // This gives the display object an input hit area. Visible artwork alone does not make
    // an object respond to a tap.
    const box = add((regionMap ? addRegionPanel : addWoodenPanel)(scene, x, y, (panelWidth - 156) / 2, 96, depth + 2,
      regionMap && accept ? 'danger' : 'normal').setInteractive({ useHandCursor: true }));
    add(scene.add.text(x, y, label, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body34'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#ffffff' })
      .setOrigin(0.5).setDepth(depth + 3));
    let press = null;

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    box.on('pointerdown', (pointer, localX, localY, event) => {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      event?.stopPropagation?.();
      press = { id: pointer.id, x: pointer.x, y: pointer.y };
    });
    const cancelPress = () => { press = null; };

    const move = (pointer) => {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined. Math.hypot calculates straight-line length from the x/y differences:
      // square each, add them, then take the square root.
      if (press?.id === pointer.id && Math.hypot(pointer.x - press.x, pointer.y - press.y) > 24) cancelPress();
    };

    box.on('pointerout', cancelPress);
    scene.input.on('pointermove', move);
    scene.input.on('gameout', cancelPress);
    scene.input.on('pointerup', cancelPress);

    // once registers a callback that removes itself after the first matching event.
    box.once('destroy', () => {
      scene.input.off('pointermove', move);
      scene.input.off('gameout', cancelPress);
      scene.input.off('pointerup', cancelPress);
    });
    box.on('pointerup', (pointer, localX, localY, event) => {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      event?.stopPropagation?.();
      if (closed || press?.id !== pointer.id) return;
      cancelPress();
      close();
      HapticsService.tap();

      if (accept) onConfirm();
      else onCancel?.();
    });
  };

  button(width / 2 - panelWidth / 4, 'CANCEL', hall ? 0x3a2418 : 0x334155, false);
  button(width / 2 + panelWidth / 4, confirmLabel, hall ? 0x6b4527 : 0x166534, true);
  return close;
}
