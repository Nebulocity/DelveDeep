// These builders use the supplied wooden plaque for town details and messages. Measure
// content before placing controls, and keep text away from the decorative frame. Display
// depth puts a popup above its current scene.

import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';

// Size and place the supplied wooden plaque around the requested display area.
export function addWoodenPanel(scene, x, y, width, height, depth = 0) {

  // The condition before ? chooses the first value when true and the value after : when
  // false. ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  const panel = scene.textures?.exists('town-sign-details')
    ? scene.add.image(x, y, 'town-sign-details', 'panel').setDisplaySize(width, height)
    : scene.add.rectangle(x, y, width, height, 0x30251d, 0.98);

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects.
  panel.setDepth(depth);
  panel.name = 'wooden-panel';
  return panel;
}

// Wrap readable notice text inside the supplied wooden plaque.
export function addWoodenNotice(scene, x, y, message, { width = 1100, fontSize = UI_FONT_SIZES.body32, depth = 4800, fixed = false } = {}) {

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects. Origin is the anchor within the object: 0 is the left/top edge,
  // 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
  // necessarily the object's corner.
  const text = scene.add.text(x, y, message, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: `${fontSize}px`, fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2',
    stroke: '#21160e', strokeThickness: 2, align: 'center', wordWrap: { width: width - 100 }
  }).setOrigin(0.5).setDepth(depth + 1);

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound.
  const panel = addWoodenPanel(scene, x, y, Math.min(width, (text.width || width - 100) + 100), Math.max(64, text.height + 38), depth);
  if (fixed) {
    panel.setScrollFactor(0);
    text.setScrollFactor(0);
  }

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined. once registers a callback that removes itself after the first matching
  // event.
  text.once?.('destroy', () => panel.destroy());
  return { panel, text, destroy: () => text.destroy() };
}
