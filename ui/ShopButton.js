// Shop controls share a raised face while their fixed input rectangle keeps taps and
// scroll clipping stable. Availability comes from the existing shop transaction rules.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { bindButtonPress } from './ButtonPress.js';

// Draw in local canvas pixels so this artwork can move with a masked shop list.
export function addShopButtonFace(scene, theme, x, y, width, height, { enabled = true, prominent = false } = {}) {
  const art = scene.add.graphics().setPosition(x, y);
  const left = -width / 2;
  const top = -height / 2;
  const radius = 10;

  // Enabled faces have a bright rim and a six-pixel lower lip. Disabled faces sit flat
  // and use opaque muted colors, so they remain readable against the item card.
  art.fillStyle(0x0c1013, enabled ? 0.95 : 0.6);
  art.fillRoundedRect(left, top + (enabled ? 6 : 1), width, height, radius);
  art.fillStyle(enabled ? prominent ? theme.edge : theme.face : 0x303336);
  art.fillRoundedRect(left, top, width, height, radius);
  art.lineStyle(enabled ? 3 : 2, enabled ? theme.edge : 0x606364);
  art.strokeRoundedRect(left, top, width, height, radius);

  if (enabled) {

    // A light upper bevel and dark lower bevel suggest a solid, pressable surface.
    art.fillStyle(0xffffff, prominent ? 0.2 : 0.1);
    art.fillRoundedRect(left + 4, top + 4, width - 8, height / 2 - 4, 6);
    art.lineStyle(2, prominent ? 0xfff1cf : theme.edge, 0.85);
    art.lineBetween(left + 12, top + 6, -left - 12, top + 6);
    art.lineStyle(4, 0x101318, prominent ? 0.45 : 0.7);
    art.lineBetween(left + 10, -top - 4, -left - 10, -top - 4);
  }

  return art;
}

// Build the face, readable label and fixed target without deciding what a tap does.
export function addShopButton(scene, theme, x, y, width, height, text, options = {}) {
  const enabled = options.enabled ?? true;
  const art = addShopButtonFace(scene, theme, x, y, width, height, options);
  const label = scene.add.text(x, y, text, {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: options.fontSize ?? fontPx('shopCost'),
    fontStyle: UI_FONT_WEIGHTS.bold,
    color: enabled ? options.prominent ? '#171319' : theme.text : '#a6a8a9',
    stroke: enabled && !options.prominent ? '#101318' : undefined,
    strokeThickness: enabled && !options.prominent ? 2 : 0
  }).setOrigin(0.5);
  const target = scene.add.rectangle(x, y, width, height, 0x000000, 0);
  target.pressVisuals = [art];
  return { target, label };
}

// Bind visual feedback after held-details input. That binding alone owns the action,
// so a release after dragging or opening details never performs a transaction here.
export function bindShopButtonFeedback(scene, button, extraVisuals = []) {
  bindButtonPress(scene, button.target, [button.label, ...extraVisuals]);
}
