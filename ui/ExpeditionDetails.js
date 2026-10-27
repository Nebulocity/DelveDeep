import { dialogFrame } from './DialogFrame.js';
import { scrollbarSurface } from './Scrollbar.js';
import { combatButton, combatText } from './CombatHudTheme.js';
import { bindButtonPress } from './ButtonPress.js';
import { hallScroll } from './HallUI.js';
import { UI_FONT_FAMILIES } from '../config/uiTypography.js';
import { DESCRIPTION_ART_DISPLAY } from '../data/characterDisplayProfiles.js';

// Long expedition descriptions keep their full contents in measured, scrollable sections.
export function showExpeditionDetails(scene, details) {
  scene.selectionDetailsClose?.();
  const { width, height } = scene.scale;
  const w = Math.min(1480, width - 160);
  const h = Math.min(820, height - 140);
  const x = width / 2, top = (height - h) / 2, left = x - w / 2;
  const depth = details.depth ?? 10000;
  const objects = [];
  const close = () => {
    objects.forEach(object => object.destroy());
    scene.selectionDetailsClose = null;
    scene.events.off('shutdown', close);
  };
  scene.selectionDetailsClose = close;
  scene.events.once('shutdown', close);
  const shade = scene.add.rectangle(x, height / 2, width, height, 0x020714, 0.65).setDepth(depth).setInteractive();
  shade.on('pointerdown', (pointer, px, py, event) => { event.stopPropagation(); close(); });
  const panel = dialogFrame(scene, x, height / 2, w, h, depth + 1).setInteractive();
  panel.on('pointerdown', (pointer, px, py, event) => event.stopPropagation());
  objects.push(shade, panel, combatText(scene, x, top + 49, details.title, 40, depth + 2));
  const hasImage = details.image && scene.textures.exists(details.image);
  const imageColumn = hasImage ? 430 : 0;
  if (hasImage) {
    const image = scene.add.image(left + 235, top + h / 2 - 20, details.image).setDepth(depth + 2);
    image.setScale(Math.min(380 / image.width, (h - 210) / image.height)
      * DESCRIPTION_ART_DISPLAY.expedition.sizeMultiplier);
    objects.push(image);
  }
  const bounds = { x: left + 44 + imageColumn, y: top + 108, width: w - 110 - imageColumn, height: h - 220 };
  const content = [];
  let y = bounds.y;
  for (const section of details.sections) {
    if (!section.body) continue;
    const heading = combatText(scene, bounds.x, y, section.title, 31, depth + 3,
      { color: '#ffd57b' }).setOrigin(0);
    const body = combatText(scene, bounds.x, y + 42, section.body, 30, depth + 3,
      { fontFamily: UI_FONT_FAMILIES.sans, fontStyle: 'normal', wordWrap: { width: bounds.width - 30 }, fixedWidth: bounds.width - 30 }).setOrigin(0);
    content.push(heading, body);
    y += body.height + 73;
  }
  const scroll = hallScroll(scene, bounds, content, y - bounds.y, 0, () => {},
    (owner, px, py, sw, sh, kind) => scrollbarSurface(owner, px, py, sw, sh, kind, depth + 3));
  objects.push(scroll.container.setDepth(depth + 3));
  const button = combatButton(scene, x, top + h - 58, 340, 82, depth + 3);
  const caption = combatText(scene, x, button.y, 'CLOSE', 31, depth + 4);
  objects.push(button, caption);
  bindButtonPress(scene, button, [caption], close);
}
