// Results reuse the Town Hub's painted charcoal and bronze frames over the current
// dungeon. No generated textures or decorative animation need separate cleanup.
import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { UI_SAFE_TOP, UI_SAFE_BOTTOM, UI_SAFE_LEFT, UI_SAFE_RIGHT } from './Layout.js';
import { serviceFrame } from './TownServiceTheme.js';
import { bindButtonPress } from './ButtonPress.js';
import HapticsService from '../services/HapticsService.js';

const ACCENTS = { fled: '#efbd68', defeat: '#d68b83', victory: '#ffdb86' };

export function resultsText(scene, x, y, value, slot = 'body34', options = {}) {
  const { originX = 0.5, originY = 0.5, ...style } = options;
  return scene.add.text(x, y, value, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: UI_FONT_SIZES[slot],
    color: '#fff1d2', align: 'center', stroke: '#11100e', strokeThickness: 2, ...style
  }).setOrigin(originX, originY).setDepth(4);
}

function frame(scene, x, y, width, height, kind = 'panel') {
  if (scene.textures.exists(`town-hub-${kind}`)) {
    return serviceFrame(scene, x, y, width, height, kind).setDepth(1);
  }

  // A missing decorative asset should still leave a readable, usable results screen.
  return scene.add.rectangle(x, y, width, height, 0x191a1c, 0.98)
    .setStrokeStyle(2, 0xa17c43).setDepth(1);
}

export function resultsFrame(scene, delve, title, outcome, subtitle) {
  const { width, height } = scene.scale;
  const centerX = width / 2;
  const panelWidth = Math.min(1800, width - UI_SAFE_LEFT - UI_SAFE_RIGHT - 64);
  const top = UI_SAFE_TOP;
  const bottom = height - UI_SAFE_BOTTOM;
  const accent = ACCENTS[outcome] ?? ACCENTS.fled;
  scene.cameras.main.setBackgroundColor('#0c1017');
  const backgroundKey = delve?.visuals?.environment?.layers?.[0]?.key;
  if (backgroundKey && scene.textures.exists(backgroundKey)) {
    const art = scene.add.image(centerX, height / 2, backgroundKey).setDepth(-2);
    art.setScale(Math.max(width / art.width, height / art.height));
  }
  scene.add.rectangle(centerX, height / 2, width, height, 0x070b12, 0.62).setDepth(-1);
  frame(scene, centerX, (top + bottom) / 2, panelWidth, bottom - top);
  frame(scene, centerX, top + 78, panelWidth * 0.78, 112, 'bar');
  resultsText(scene, centerX, top + 76, title, 'display62', { color: accent, fontStyle: UI_FONT_WEIGHTS.bold });
  resultsText(scene, centerX, top + 162, delve?.name ?? 'The Delve', 'heading46', {
    wordWrap: { width: panelWidth - 180 }
  });
  resultsText(scene, centerX, top + 222, subtitle, 'body32', { color: '#c6bdac' });

  const columnWidth = (panelWidth - 152) / 2;
  return {
    centerX, columnWidth, leftX: centerX - (columnWidth + 32) / 2, rightX: centerX + (columnWidth + 32) / 2,
    contentTop: top + 268, contentHeight: bottom - top - 482,
    actionY: bottom - 148, utilityY: bottom - 58
  };
}

export function resultsSection(scene, x, top, width, height, title) {
  scene.add.rectangle(x, top + height / 2, width, height, 0x0b1016, 0.72)
    .setStrokeStyle(1, 0xa17c43, 0.65).setDepth(2);
  resultsText(scene, x, top + 35, title, 'body34', { fontStyle: UI_FONT_WEIGHTS.bold, color: '#dfbf83' });
  scene.add.rectangle(x, top + 66, width - 64, 1, 0xa17c43, 0.6).setDepth(3);
}

export function resultsButton(scene, x, y, width, height, label, onTap, options = {}) {
  const kind = options.primary ? 'selected' : options.utility ? 'bar' : 'option';
  const face = frame(scene, x, y, width, height, kind).setDepth(5);
  const highlight = scene.add.rectangle(x, y, width - 40, height - 24,
    options.primary ? 0xc28a26 : 0x5b371d, options.primary ? 0.2 : 0.1).setDepth(5);
  const caption = resultsText(scene, x, y, label, options.utility ? 'support28' : 'body36', {
    fontStyle: UI_FONT_WEIGHTS.bold, color: options.primary ? '#ffdf94' : '#fff1d2'
  }).setDepth(6);
  const hit = scene.add.rectangle(x, y, width, height, 0, 0).setDepth(7)
    .setName(label).setInteractive({ useHandCursor: true });
  hit.pressVisuals = [face, highlight, caption];
  bindButtonPress(scene, hit, [], () => {
    HapticsService[options.utility ? 'tap' : 'confirm']();
    onTap();
  });
  return hit;
}
