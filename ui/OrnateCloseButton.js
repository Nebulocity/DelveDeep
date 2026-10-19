import { bindButtonPress } from './ButtonPress.js';
import HapticsService from '../services/HapticsService.js';

// Draw once in local coordinates so the whole seal can move with button presses.
// The engraved mark uses strokes rather than a font-dependent multiplication glyph.
export function addCloseEmblem(scene, x, y, size, depth = 1003) {
  const art = scene.add.graphics().setPosition(x, y).setScale(size / 96).setDepth(depth);
  art.fillStyle(0x020811).fillCircle(0, 3, 39);
  art.fillStyle(0x101e2c).fillCircle(0, 0, 37);
  art.lineStyle(4, 0x69451f).strokeCircle(0, 0, 37);
  art.lineStyle(2, 0xe6bd70).strokeCircle(0, 0, 35);
  art.lineStyle(1, 0x99733b).strokeCircle(0, 0, 29);

  // Small diamond finials echo the central jewels on the game's painted frames.
  for (let index = 0; index < 4; index++) {
    const angle = index * Math.PI / 2;
    const px = Math.cos(angle) * 37, py = Math.sin(angle) * 37;
    const points = [{ x: px, y: py - 6 }, { x: px + 5, y: py },
      { x: px, y: py + 6 }, { x: px - 5, y: py }];
    art.fillStyle(0xc28c3c).fillPoints(points, true);
    art.lineStyle(1, 0xffdf91).strokePoints(points, true);
  }
  art.lineStyle(7, 0x020811).lineBetween(-10, -8, 10, 12).lineBetween(10, -8, -10, 12);
  art.lineStyle(5, 0xc28c3c).lineBetween(-10, -10, 10, 10).lineBetween(10, -10, -10, 10);
  art.lineStyle(2, 0xffe3a5).lineBetween(-10, -11, 10, 9).lineBetween(10, -11, -10, 9);
  return art;
}

export function addOrnateCloseButton(scene, x, y, width, height, action, { depth = 1003, fixed = true } = {}) {
  const art = addCloseEmblem(scene, x, y, Math.min(width, height), depth);
  const button = scene.add.rectangle(x, y, width, height, 0, 0).setDepth(depth + 1)
    .setInteractive({ useHandCursor: true }).setName('window-close');
  button.pressVisuals = [art];
  art.hidePressShadow = true;
  button.uiSound = 'dialogClose';
  if (fixed) { art.setScrollFactor(0); button.setScrollFactor(0); }
  bindButtonPress(scene, button, [], () => { HapticsService.tap(); action(); });
  const cancelDrag = pointer => {
    if (pointer.isDown && Math.hypot(pointer.x - pointer.downX, pointer.y - pointer.downY) > 24) button.emit('pointerout');
  };
  scene.input.on('pointermove', cancelDrag);
  button.once('destroy', () => { scene.input.off('pointermove', cancelDrag); art.destroy(); });
  return { button, art, objects: [art, button] };
}
