import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import HapticsService from '../services/HapticsService.js';
import { addFacilityPlate } from './FacilityChoiceArt.js';
import { bindButtonPress } from './ButtonPress.js';
import { DETAILS_HINT } from './SelectionDetails.js';

export function addFacilityReturnButton(scene, facilityName, onReturn, { x = 312, y = 166 } = {}) {
  const width = 520;
  const height = 92;
  const { art, theme } = addFacilityPlate(scene, facilityName, x, y, width, height);
  art.lineStyle(4, theme.glow, 0.95);
  art.lineBetween(-width / 2 + 38, 0, -width / 2 + 66, 0);
  art.lineBetween(-width / 2 + 38, 0, -width / 2 + 49, -11);
  art.lineBetween(-width / 2 + 38, 0, -width / 2 + 49, 11);
  const label = scene.add.text(x + 19, y, 'Return to Town', {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2',
    stroke: '#100e0c', strokeThickness: 2
  }).setOrigin(0.5);
  const target = scene.add.rectangle(x, y, width, height, 0x000000, 0)
    .setName('facility-return').setInteractive({ useHandCursor: true });
  target.pressVisuals = [art];
  bindButtonPress(scene, target, [label], () => { HapticsService.tap(); onReturn(); });
  return target;
}

export function addFacilityDetailsHint(scene, facilityName, y, { x = scene.scale.width / 2 } = {}) {
  const width = 1100;
  const { art } = addFacilityPlate(scene, facilityName, x, y, width, 64);
  art.setName('facility-details-hint');
  return scene.add.text(x, y, DETAILS_HINT, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('shopHint'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2',
    align: 'center', wordWrap: { width: width - 90 }, stroke: '#100e0c', strokeThickness: 1
  }).setOrigin(0.5);
}
