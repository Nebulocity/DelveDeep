import { addFacilityPlate } from './FacilityChoiceArt.js';
import { bindButtonPress } from './ButtonPress.js';
import { hallScroll } from './HallUI.js';
import HapticsService from '../services/HapticsService.js';
import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';

export function showShopDetails(scene, details) {
  scene.selectionDetailsClose?.();
  const existing = new Set(scene.children.list);
  const objects = [];
  const depth = details.depth ?? 10000;
  const { width, height } = scene.scale;
  const facility = scene.facility.name;
  const x = width / 2;
  const panelWidth = Math.min(details.panelWidth ?? 1380, width - 120);
  const textWidth = panelWidth - 180;
  const title = scene.add.text(x, 0, details.title, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: `${UI_FONT_SIZES.body36}px`,
    fontStyle: UI_FONT_WEIGHTS.bold, color: details.shopTheme.text,
    align: 'center', wordWrap: { width: textWidth }
  }).setOrigin(0.5, 0).setDepth(depth + 4);
  const body = scene.add.text(x - textWidth / 2, 0, details.description, {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: `${UI_FONT_SIZES.detailBody}px`,
    color: details.shopTheme.text, align: details.align ?? 'center',
    fixedWidth: textWidth, wordWrap: { width: textWidth }, lineSpacing: 10
  }).setDepth(depth + 4);
  const headerHeight = title.height + 80;
  const panelHeight = Math.min(height - 120, Math.max(420, headerHeight + body.height + 180));
  const top = (height - panelHeight) / 2;
  const bodyY = top + headerHeight + 30;
  const bodyHeight = panelHeight - headerHeight - 170;
  title.setY(top + 40);
  body.setY(bodyY);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scene.events.off('shutdown', close);
    if (scene.selectionDetailsClose === close) scene.selectionDetailsClose = null;
    objects.forEach(object => { if (object.active) object.destroy(); });
  };
  scene.selectionDetailsClose = close;
  scene.events.once('shutdown', close);
  const shade = scene.add.rectangle(x, height / 2, width, height, 0x000000, 0.7)
    .setName('shop-details-shade').setDepth(depth).setInteractive();
  const { art: panel, theme } = addFacilityPlate(scene, facility, x, height / 2, panelWidth, panelHeight);
  panel.setName('shop-details-panel').setDepth(depth + 1);
  panel.lineStyle(2, theme.edge, 0.65);
  panel.lineBetween(-panelWidth / 2 + 60, -panelHeight / 2 + headerHeight, panelWidth / 2 - 60, -panelHeight / 2 + headerHeight);
  const blocker = scene.add.rectangle(x, height / 2, panelWidth, panelHeight, 0, 0)
    .setDepth(depth + 2).setInteractive();
  const stop = (pointer, px, py, event) => event?.stopPropagation?.();
  blocker.on('pointerdown', stop).on('pointerup', stop);
  shade.on('pointerdown', (pointer, px, py, event) => { stop(pointer, px, py, event); HapticsService.tap(); close(); });
  const scroll = hallScroll(scene, { x: body.x, y: bodyY, width: textWidth, height: bodyHeight },
    [body], body.height, 0, () => {},
    (owner, sx, sy, sw, sh) => addFacilityPlate(owner, facility, sx, sy, sw, sh).art.setDepth(depth + 4),
    () => false);
  scroll.container.setDepth(depth + 4);
  const buttonY = top + panelHeight - 70;
  const { art: button } = addFacilityPlate(scene, facility, x, buttonY, 380, 96);
  button.setDepth(depth + 5);
  const label = scene.add.text(x, buttonY, 'CLOSE', {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: `${UI_FONT_SIZES.body32}px`, color: details.shopTheme.text
  }).setOrigin(0.5).setDepth(depth + 6);
  const hit = scene.add.rectangle(x, buttonY, 380, 96, 0, 0)
    .setName('shop-details-close').setDepth(depth + 6).setInteractive({ useHandCursor: true });
  hit.pressVisuals = [button];
  bindButtonPress(scene, hit, [label], () => { HapticsService.tap(); close(); });
  objects.push(...scene.children.list.filter(object => !existing.has(object)));
  return close;
}
