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

// This helper reserves separate rows for battle headings and a centered tactics bar. The
// arena starts below the controls with room for enemy labels, so adding a fifth tactic
// never squeezes it into the status text.
export function getBattleLayout(width, height, count = 5) {

  // We reserve at least one position and at most five, matching the tactic loadout limit.
  const slots = Math.max(1, Math.min(5, count));

  // gap is the empty space between neighboring buttons, in logical canvas pixels.
  const gap = 20;

  // 690 pixels are reserved for the side controls. Subtract those and all the gaps from
  // the canvas width, then share the remaining width among the slots. The 300-pixel
  // ceiling keeps a short loadout from producing oversized buttons.
  const buttonWidth = Math.min(300, (width - 690 - gap * (slots - 1)) / slots);

  // The row includes every button width plus one gap between each pair. There are slots -
  // 1 gaps because there is no gap after the last button.
  const totalWidth = slots * buttonWidth + (slots - 1) * gap;

  // These y positions reserve separate rows for the banner, tactic labels and buttons.
  // arenaTop is at least 450 pixels down, or 42% of the canvas height if that is larger.
  // For each x position, half the leftover space centers the entire row. Half a button
  // width moves from its left edge to its center, and index steps through the row.
  return {
    titleY: 46, messageY: 290, statusY: 42, labelY: 122,
    buttonY: 178, buttonHeight: 80, buttonWidth,
    arenaTop: Math.max(450, height * 0.42),
    positions: Array.from({ length: slots }, (_, index) =>
      (width - totalWidth) / 2 + buttonWidth / 2 + index * (buttonWidth + gap))
  };
}
