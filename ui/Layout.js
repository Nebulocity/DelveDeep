// Shared screen layout uses logical canvas pixels. These helpers return positions, not
// display objects. A size comes from the Phaser canvas rather than the phone's raw
// physical resolution, because the canvas is scaled as one piece when it fits the device.

export const UI_SAFE_TOP = 132;
export const UI_SAFE_BOTTOM = 44;
export const UI_SAFE_LEFT = 52;
export const UI_SAFE_RIGHT = 52;

// This helper places shared header content below the reserved top inset.
export function topBarY() {

  return UI_SAFE_TOP + 34;
}

// Tactics sit below the flush header. These positions never change battlefield geometry.
export function getBattleLayout(width, height, count = 5) {
  const slots = Math.max(1, Math.min(5, count));
  const gap = 16;
  const left = 410;
  const right = width - 370;
  const buttonWidth = Math.min(270, (right - left - gap * (slots - 1)) / slots);
  const totalWidth = slots * buttonWidth + (slots - 1) * gap;
  return {
    titleY: 30, messageY: 244, statusY: 32, labelY: 48,
    buttonY: 154, buttonHeight: 100, buttonWidth,
    arenaTop: Math.max(450, height * 0.42),
    positions: Array.from({ length: slots }, (_, index) =>
      left + (right - left - totalWidth) / 2 + buttonWidth / 2 + index * (buttonWidth + gap))
  };
}
