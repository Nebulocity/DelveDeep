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

// The banner shares one row between the wave counter, tactics, BGM and Pause.
// Battlefield geometry stays unchanged when the buttons move into the header.
export function getBattleLayout(width, height, count = 5) {

  // We reserve at least one position and at most five, matching the tactic loadout limit.
  const slots = Math.max(1, Math.min(5, count));

  // gap is the empty space between neighboring buttons, in logical canvas pixels.
  const gap = 16;

  // The wave counter owns the first 320 logical pixels. BGM starts 580 pixels from the right.
  // A small gutter on each side leaves room for five smaller, full-height touch targets.
  const left = 340, right = width - 600;
  const buttonWidth = Math.min(270, (right - left - gap * (slots - 1)) / slots);

  // The row includes every button width plus one gap between each pair. There are slots -
  // 1 gaps because there is no gap after the last button.
  const totalWidth = slots * buttonWidth + (slots - 1) * gap;

  // Center short loadouts inside their available banner segment, keeping the floor unchanged.
  return {
    titleY: 46, messageY: 290, statusY: 34, labelY: 48,
    buttonY: 48, buttonHeight: 84, buttonWidth,
    arenaTop: Math.max(450, height * 0.42),
    positions: Array.from({ length: slots }, (_, index) =>
      left + (right - left - totalWidth) / 2 + buttonWidth / 2 + index * (buttonWidth + gap))
  };
}
