// Shop inspection uses a facility-themed temporary details panel. Text wraps inside its
// inset and long content scrolls rather than shrinking to an unreadable size. Closing
// removes the blocker so the main shop becomes interactive again.

import { addFacilityPlate } from './FacilityChoiceArt.js';
import { bindButtonPress } from './ButtonPress.js';
import { hallScroll } from './HallUI.js';
import HapticsService from '../services/HapticsService.js';
import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';

// Open facility-themed item details with readable wrapping and scrolling for long content.
// scene is the Phaser screen that owns the objects, clock and input used here.
export function showShopDetails(scene, details) {

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  scene.selectionDetailsClose?.();

  // A Set keeps each value once. has checks membership without searching a list for
  // duplicate entries.
  const existing = new Set(scene.children.list);
  const objects = [];

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  const depth = details.depth ?? 10000;

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { width, height } = scene.scale;
  const facility = scene.facility.name;
  const x = width / 2;

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound.
  const panelWidth = Math.min(details.panelWidth ?? 1380, width - 120);
  const textWidth = panelWidth - 180;

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects. Origin is the anchor within the object: 0 is the left/top edge,
  // 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
  // necessarily the object's corner.
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

  // once registers a callback that removes itself after the first matching event.
  scene.events.once('shutdown', close);

  // This gives the display object an input hit area. Visible artwork alone does not make
  // an object respond to a tap.
  const shade = scene.add.rectangle(x, height / 2, width, height, 0x000000, 0.7)
    .setName('shop-details-shade').setDepth(depth).setInteractive();
  const { art: panel, theme } = addFacilityPlate(scene, facility, x, height / 2, panelWidth, panelHeight);
  panel.setName('shop-details-panel').setDepth(depth + 1);
  panel.lineStyle(2, theme.edge, 0.65);
  panel.lineBetween(-panelWidth / 2 + 60, -panelHeight / 2 + headerHeight, panelWidth / 2 - 60, -panelHeight / 2 + headerHeight);
  const blocker = scene.add.rectangle(x, height / 2, panelWidth, panelHeight, 0, 0)
    .setDepth(depth + 2).setInteractive();

  const stop = (pointer, px, py, event) => event?.stopPropagation?.();

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  blocker.on('pointerdown', stop).on('pointerup', stop);
  shade.on('pointerdown', (pointer, px, py, event) => {
    stop(pointer, px, py, event);
    HapticsService.tap();
    close();
  });
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
  bindButtonPress(scene, hit, [label], () => {
    HapticsService.tap();
    close();
  });

  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside. filter keeps entries whose callback returns true. It builds a new list and
  // leaves the original list in place.
  objects.push(...scene.children.list.filter(object => !existing.has(object)));
  return close;
}
