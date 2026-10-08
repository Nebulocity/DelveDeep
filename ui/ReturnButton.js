// This builds the shared return control. The caller supplies where it goes; button press
// feedback and input cancellation remain shared with other controls.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import HapticsService from '../services/HapticsService.js';

// Build the shared return control and bind the caller's destination action. scene is the
// Phaser screen that owns the objects, clock and input used here.
export function addReturnButton(scene, destination, onReturn, { x = 312, y = 166, feedback = 'tap' } = {}) {

  // This gives the display object an input hit area. Visible artwork alone does not make
  // an object respond to a tap.
  const button = scene.add.rectangle(x, y, 520, 76, 0x382014, 0.94)
    .setStrokeStyle(3, 0xd4a15e)
    .setInteractive({ useHandCursor: true });

  // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center and
  // 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
  // corner.
  scene.add.text(x, y, `Return to ${destination}`, {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2'
  }).setOrigin(0.5);

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  button.on('pointerdown', () => {
    HapticsService[feedback]();
    onReturn();
  });

  return button;
}
