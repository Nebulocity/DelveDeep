// This builds the shop's framing, action surfaces and common controls. The facility theme
// changes the visual materials without changing shop rules.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import HapticsService from '../services/HapticsService.js';
import { addFacilityPlate } from './FacilityChoiceArt.js';
import { bindButtonPress } from './ButtonPress.js';
import { DETAILS_HINT } from './SelectionDetails.js';

// Build the facility-themed return control and connect its destination action.
export function addFacilityReturnButton(scene, facilityName, onReturn, { x = 312, y = 166 } = {}) {
  const width = 520;
  const height = 92;

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { art, theme } = addFacilityPlate(scene, facilityName, x, y, width, height);

  // Highlight the upper bevel and deepen the lower lip to match the shop action faces.
  art.lineStyle(3, theme.glow, 0.75);
  art.lineBetween(-width / 2 + 14, -height / 2 + 5, width / 2 - 14, -height / 2 + 5);
  art.lineStyle(5, theme.shadow, 0.95);
  art.lineBetween(-width / 2 + 14, height / 2 - 4, width / 2 - 14, height / 2 - 4);
  art.lineStyle(4, theme.glow, 0.95);
  art.lineBetween(-width / 2 + 38, 0, -width / 2 + 66, 0);
  art.lineBetween(-width / 2 + 38, 0, -width / 2 + 49, -11);
  art.lineBetween(-width / 2 + 38, 0, -width / 2 + 49, 11);

  // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center and
  // 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
  // corner.
  const label = scene.add.text(x + 19, y, 'Return to Town', {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2',
    stroke: '#100e0c', strokeThickness: 2
  }).setOrigin(0.5);

  // This gives the display object an input hit area. Visible artwork alone does not make
  // an object respond to a tap.
  const target = scene.add.rectangle(x, y, width, height, 0x000000, 0)
    .setName('facility-return').setInteractive({ useHandCursor: true });
  target.pressVisuals = [art];
  bindButtonPress(scene, target, [label], () => {
    HapticsService.tap();
    onReturn();
  });

  return target;
}

// Place the shared hold-for-details instruction inside the facility header.
export function addFacilityDetailsHint(scene, facilityName, y, { x = scene.scale.width / 2 } = {}) {
  const width = 1100;

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { art } = addFacilityPlate(scene, facilityName, x, y, width, 64);
  art.setName('facility-details-hint');

  // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center and
  // 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
  // corner.
  return scene.add.text(x, y, DETAILS_HINT, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('shopHint'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2',
    align: 'center', wordWrap: { width: width - 90 }, stroke: '#100e0c', strokeThickness: 1
  }).setOrigin(0.5);
}
