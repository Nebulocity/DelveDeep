import { combatPanel, combatText } from './CombatHudTheme.js';
import { addRegionPanel, addRegionButton } from './RegionMapTheme.js';
import { syncRegionMapCameras } from './RegionMapUI.js';
import { addDelveBestiary } from './DelveBestiary.js';
import { hallScroll } from './HallUI.js';
import { UI_FONT_SIZES, UI_FONT_FAMILIES } from '../config/uiTypography.js';
import { playUiSound } from '../services/UiAudioService.js';
import HapticsService from '../services/HapticsService.js';

// Map inspection and preparation share the same encounter-derived showcase. Details
// scroll independently so long preparation advice never pushes the creatures off-screen.
export function showDelveDetails(scene, details) {
  scene.selectionDetailsClose?.();
  scene.mapLocationClose?.();
  const { width, height } = scene.scale;
  const depth = details.depth ?? 10000;
  const w = Math.min(2240, width - 100);
  const h = height - 120;
  const left = (width - w) / 2;
  const centerX = left + w / 2;
  const top = (height - h) / 2;
  const objects = [];
  let bestiary;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    bestiary?.destroy();
    objects.forEach(object => { if (object.scene) object.destroy(); });
    if (scene.selectionDetailsClose === close) scene.selectionDetailsClose = null;
    scene.events.off('shutdown', close);
  };
  scene.selectionDetailsClose = close;
  scene.events.once('shutdown', close);
  const blocked = () => scene.selectionDetailsClose !== close;
  const stop = (pointer, px, py, event) => event?.stopPropagation();
  const shade = scene.add.rectangle(width / 2, height / 2, width, height, 0x020714, 0.72)
    .setDepth(depth).setInteractive();
  shade.on('pointerdown', (pointer, px, py, event) => {
    event?.stopPropagation();
    playUiSound(scene, 'dialogClose');
    HapticsService.tap();
    close();
  });
  const panel = addRegionPanel(scene, centerX, height / 2, w, h, depth + 1)
    .setInteractive().on('pointerdown', stop).on('pointerup', stop);
  objects.push(shade, panel, combatText(scene, centerX, top + 52, details.title,
    UI_FONT_SIZES.heading44, depth + 2, { wordWrap: { width: w - 120 }, align: 'center' }));

  const contentTop = top + 112;
  const contentHeight = h - 232;
  const bestiaryWidth = (w - 112) * 0.59;
  const bestiaryX = left + 32 + bestiaryWidth / 2;
  objects.push(combatPanel(scene, bestiaryX, contentTop + contentHeight / 2,
    bestiaryWidth, contentHeight, depth + 2));
  bestiary = addDelveBestiary(scene, details.delve, bestiaryX,
    contentTop + contentHeight / 2, bestiaryWidth, contentHeight,
    { depth: depth + 3, fixed: true, inspect: false, isBlocked: blocked, displayProfile: 'description' });

  const infoLeft = left + 60 + bestiaryWidth;
  const infoWidth = left + w - 60 - infoLeft;
  objects.push(combatText(scene, infoLeft + infoWidth / 2, contentTop + 28,
    'DELVE DETAILS', UI_FONT_SIZES.delveInfoHeading, depth + 3));
  const bounds = { x: infoLeft, y: contentTop + 68, width: infoWidth - 24,
    height: contentHeight - 82 };
  const content = [];
  let cursor = bounds.y;
  for (const section of details.sections) {
    if (!section.body) continue;
    const heading = combatText(scene, bounds.x, cursor, section.title,
      UI_FONT_SIZES.bestiaryLabel, depth + 3, { color: '#e8b75c',
        wordWrap: { width: bounds.width - 16 } }).setOrigin(0);
    const body = combatText(scene, bounds.x, cursor + heading.height + 12, section.body,
      UI_FONT_SIZES.body30, depth + 3, { fontFamily: UI_FONT_FAMILIES.sans,
        fontStyle: 'normal', wordWrap: { width: bounds.width - 16 },
        lineSpacing: 6 }).setOrigin(0);
    content.push(heading, body);
    cursor = body.y + body.height + 28;
  }
  const scroll = hallScroll(scene, bounds, content, cursor - bounds.y, 0, () => {},
    (owner, px, py, sw, sh) => combatPanel(owner, px, py, sw, sh, depth + 4)
      .setScrollFactor(0), blocked);
  objects.push(scroll.container.setDepth(depth + 4));

  // The frame's decorative centerpiece sits left of its geometric midpoint. Match
  // that visible axis, shifting the complete button and hit area together.
  const closeX = centerX - w * 0.025;
  const button = addRegionButton(scene, closeX, top + h - 60, 320, 82,
    'CLOSE', close, { depth: depth + 5 });
  button.text.setFixedSize(320, 0).setAlign('center').setOrigin(0.5);
  button.panel.uiSound = 'dialogClose';
  objects.push(button.panel, button.text);
  objects.forEach(object => object.setScrollFactor(0));
  if (scene.mapUiCamera) syncRegionMapCameras(scene);
  return close;
}
