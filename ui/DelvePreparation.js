import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { addStonePanel, addStoneButton, addStoneOrnaments, delveStoneTheme, stoneText, STONE } from './CarvedStone.js';
import { bindButtonPress } from './ButtonPress.js';
import HapticsService from '../services/HapticsService.js';

export function preparationButton(scene, x, y, width, height, label, action, options = {}) {
  const depth = options.depth ?? 10;
  const button = addStoneButton(scene, x, y, width, height, depth);
  button.setStrokeStyle(2, options.primary ? STONE.gold : scene.stoneTheme.accent, 0.7);
  const text = stoneText(scene, x, y, label, options.size ?? UI_FONT_SIZES.body34, depth + 1);
  bindButtonPress(scene, button, [text], () => { HapticsService.tap(); action(); });
  return { button, text };
}

export function preparationFrame(scene, delve, title, backLabel, backAction) {
  const { width, height } = scene.scale;
  scene.stoneTheme = delveStoneTheme(delve);
  scene.cameras.main.setBackgroundColor('#0b111c');
  const preview = delve?.visuals?.environment?.layers[0]?.key;
  if (preview && scene.textures.exists(preview)) {
    const art = scene.add.image(width / 2, height / 2, preview).setDepth(-20);
    art.setScale(Math.max(width / art.width, height / art.height)).setAlpha(0.32);
  }
  scene.add.rectangle(width / 2, height / 2, width, height, 0x080e19, 0.4).setDepth(-19);
  addStonePanel(scene, width / 2, 64, width, 128, 0);
  addStoneOrnaments(scene, width / 2, 62, width * 0.52, scene.stoneTheme, 2);
  stoneText(scene, width / 2, 36, title, UI_FONT_SIZES.support28, 3, { color: STONE.muted });
  stoneText(scene, width / 2, 84, delve?.name ?? 'The Delve', UI_FONT_SIZES.heading49, 3);
  preparationButton(scene, 240, 64, 430, 94, backLabel, backAction, { size: UI_FONT_SIZES.body32 });
}

export function preparationNotice(scene, x, y, message, options = {}) {
  const depth = options.depth ?? 10;
  const text = stoneText(scene, x, y, message, options.fontSize ?? UI_FONT_SIZES.overviewHint, depth + 1, {
    fontFamily: UI_FONT_FAMILIES.sans, fontStyle: UI_FONT_WEIGHTS.normal, color: STONE.muted,
    align: 'center', wordWrap: { width: (options.width ?? 1100) - 64 }
  });
  const panel = addStonePanel(scene, x, y, Math.min(options.width ?? 1100, text.width + 80), text.height + 38, depth);
  return { panel, text };
}
