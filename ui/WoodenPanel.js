import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
export function addWoodenPanel(scene, x, y, width, height, depth = 0) {
  const panel = scene.textures?.exists('town-sign-details')
    ? scene.add.image(x, y, 'town-sign-details', 'panel').setDisplaySize(width, height)
    : scene.add.rectangle(x, y, width, height, 0x30251d, 0.98);
  panel.setDepth(depth);
  panel.name = 'wooden-panel';
  return panel;
}

export function addWoodenNotice(scene, x, y, message, { width = 1100, fontSize = UI_FONT_SIZES.body32, depth = 4800, fixed = false } = {}) {
  const text = scene.add.text(x, y, message, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: `${fontSize}px`, fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2',
    stroke: '#21160e', strokeThickness: 2, align: 'center', wordWrap: { width: width - 100 }
  }).setOrigin(0.5).setDepth(depth + 1);
  const panel = addWoodenPanel(scene, x, y, Math.min(width, (text.width || width - 100) + 100), Math.max(64, text.height + 38), depth);
  if (fixed) { panel.setScrollFactor(0); text.setScrollFactor(0); }
  text.once?.('destroy', () => panel.destroy());
  return { panel, text, destroy: () => text.destroy() };
}
