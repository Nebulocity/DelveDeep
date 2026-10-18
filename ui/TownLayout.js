import { UI_SAFE_LEFT, UI_SAFE_RIGHT, UI_SAFE_BOTTOM } from './Layout.js';

// FIT already protects physical cutouts. Logical gutters keep ornate corners and
// finger targets inside the canvas without changing global scaling.
export function getTownLayout(width, height, style) {
  const left = UI_SAFE_LEFT, right = width - UI_SAFE_RIGHT;
  const bottom = height - UI_SAFE_BOTTOM;
  const unit = Math.min(1, width / 2400, height / 1080);
  const top = 184 * unit;
  const gap = 12 * unit;
  const positions = [];
  if (style === 'side-rails') {
    const buttonHeight = Math.min(166 * unit, (bottom - top - gap * 4) / 5);
    const buttonWidth = 218 * unit;
    for (let i = 0; i < 5; i++) {
      positions.push({ x: left + buttonWidth / 2, y: top + buttonHeight / 2 + i * (buttonHeight + gap), width: buttonWidth, height: buttonHeight, framed: true });
    }
    const offset = (buttonHeight + gap) / 2;
    for (let i = 0; i < 4; i++) {
      positions.push({ x: right - buttonWidth / 2, y: top + offset + buttonHeight / 2 + i * (buttonHeight + gap), width: buttonWidth, height: buttonHeight, framed: true });
    }
    return { positions, unit };
  }
  const barWidth = Math.min(1500 * unit, right - left);
  const barHeight = 170 * unit;
  const barY = bottom - barHeight / 2;
  const slotWidth = (barWidth - 90 * unit) / 5;
  for (let i = 0; i < 5; i++) {
    positions.push({ x: width / 2 + (i - 2) * slotWidth, y: barY, width: slotWidth - 10 * unit, height: barHeight - 20 * unit, framed: false });
  }
  const townWidth = 220 * unit;
  const townHeight = 164 * unit;
  for (let i = 0; i < 4; i++) {
    positions.push({ x: width / 2 + (i - 1.5) * (townWidth + gap), y: bottom - barHeight - gap - townHeight / 2, width: townWidth, height: townHeight, framed: true });
  }
  return { positions, unit, bar: { x: width / 2, y: barY, width: barWidth, height: barHeight } };
}
