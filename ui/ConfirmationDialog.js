import HapticsService from '../services/HapticsService.js';
import { addWoodenPanel } from './WoodenPanel.js';
import { addRegionPanel } from './RegionMapTheme.js';
import { isGuildHall } from './GuildHallTheme.js';
import { showGuildConfirmation } from './GuildHallDialogs.js';
import { addStonePanel, addStoneButton, STONE } from './CarvedStone.js';
import { bindButtonPress } from './ButtonPress.js';

// Nothing is committed until a fresh press and release on CONFIRM. Reusing
// the modal lock also prevents held selections behind the dialog from firing.
export function showConfirmation(scene, { title, description, confirmLabel = 'CONFIRM', onConfirm, onCancel }) {
  if (isGuildHall(scene)) return showGuildConfirmation(scene, { title, description, confirmLabel, onConfirm, onCancel });
  scene.selectionDetailsClose?.();
  const { width, height } = scene.scale;
  const hall = true;
  const regionMap = scene.scene?.key === 'TitleScene';
  const stone = scene.scene?.key === 'BattleScene';
  const objects = [];
  const depth = 11000;
  const panelWidth = Math.min(1200, width - 120);
  let closed = false;
  const wasPaused = scene.combatPaused;
  const clockPaused = scene.time?.paused;
  if (typeof wasPaused === 'boolean') {
    scene.combatPaused = true;
    scene.time.paused = true;
  }
  const close = () => {
    if (closed) return;
    closed = true;
    scene.events.off('shutdown', close);
    if (scene.selectionDetailsClose === close) scene.selectionDetailsClose = null;
    if (typeof wasPaused === 'boolean') {
      scene.combatPaused = wasPaused;
      scene.time.paused = clockPaused;
    }
    objects.forEach((object) => object.destroy());
  };
  scene.selectionDetailsClose = close;
  scene.events.once('shutdown', close);
  const add = (object) => { objects.push(object); return object; };
  const body = add(scene.add.text(width / 2 - panelWidth / 2 + 52, 0, description, {
    fontFamily: 'Arial', fontSize: '36px', color: stone ? STONE.text : hall ? '#f1dfca' : '#e2e8f0', wordWrap: { width: panelWidth - 104 },
    align: stone ? 'center' : 'left', fixedWidth: stone ? panelWidth - 104 : undefined
  }).setDepth(depth + 2));
  const panelHeight = Math.max(420, body.height + 240);
  const top = (height - panelHeight) / 2;
  body.setY(top + 110);
  const stop = (pointer, x, y, event) => event?.stopPropagation?.();
  for (const [index, [w, h, color, alpha]] of [[width, height, 0x000000, 0.75], [panelWidth, panelHeight, hall ? 0x21130d : 0x111827, 1]].entries()) {
    const box = add((index === 1 ? (stone ? addStonePanel : regionMap ? addRegionPanel : addWoodenPanel)(scene, width / 2, height / 2, w, h, depth + index)
      : scene.add.rectangle(width / 2, height / 2, w, h, color, alpha).setDepth(depth + index)).setInteractive());
    box.on('pointerdown', stop);
    box.on('pointerup', stop);
  }
  add(scene.add.text(width / 2, top + 52, title, {
    fontFamily: stone ? 'Georgia' : 'Arial', fontSize: '42px', fontStyle: 'bold', color: stone ? STONE.text : hall ? '#fff1d2' : '#f8fafc',
    wordWrap: { width: panelWidth - 104 }, align: 'center'
  }).setOrigin(0.5).setDepth(depth + 2));

  const button = (x, label, color, accept) => {
    const y = top + panelHeight - 72;
    if (stone) {
      const box = add(addStoneButton(scene, x, y, (panelWidth - 156) / 2, 96, depth + 2, accept ? 0x3f1d1d : 0x1f2937));
      const caption = add(scene.add.text(x, y, label, { fontFamily: 'Georgia', fontSize: '34px', color: STONE.text })
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
    const box = add((regionMap ? addRegionPanel : addWoodenPanel)(scene, x, y, (panelWidth - 156) / 2, 96, depth + 2,
      regionMap && accept ? 'danger' : 'normal').setInteractive({ useHandCursor: true }));
    add(scene.add.text(x, y, label, { fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5).setDepth(depth + 3));
    let press = null;
    box.on('pointerdown', (pointer, localX, localY, event) => {
      event?.stopPropagation?.();
      press = { id: pointer.id, x: pointer.x, y: pointer.y };
    });
    const cancelPress = () => { press = null; };
    const move = (pointer) => {
      if (press?.id === pointer.id && Math.hypot(pointer.x - press.x, pointer.y - press.y) > 24) cancelPress();
    };
    box.on('pointerout', cancelPress);
    scene.input.on('pointermove', move);
    scene.input.on('gameout', cancelPress);
    scene.input.on('pointerup', cancelPress);
    box.once('destroy', () => {
      scene.input.off('pointermove', move);
      scene.input.off('gameout', cancelPress);
      scene.input.off('pointerup', cancelPress);
    });
    box.on('pointerup', (pointer, localX, localY, event) => {
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
