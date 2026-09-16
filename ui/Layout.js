export const UI_SAFE_TOP = 132;
export const UI_SAFE_BOTTOM = 44;
export const UI_SAFE_LEFT = 52;
export const UI_SAFE_RIGHT = 52;

// This function places shared header content below the reserved top inset.
export function topBarY() {

  return UI_SAFE_TOP + 34;
}

// This function reserves separate rows for battle headings and a centered
// tactics bar. The arena starts below the controls with room for enemy
// labels, so adding a fifth tactic never squeezes it into the status text.
export function getBattleLayout(width, height, count = 5) {

  const slots = Math.max(1, Math.min(5, count));
  const gap = 20;
  const buttonWidth = Math.min(300, (width - 690 - gap * (slots - 1)) / slots);
  const totalWidth = slots * buttonWidth + (slots - 1) * gap;
  return {
    titleY: 36, messageY: 96, statusY: 145, labelY: 191,
    buttonY: 252, buttonHeight: 80, buttonWidth,
    arenaTop: Math.max(450, height * 0.42),
    positions: Array.from({ length: slots }, (_, index) =>
      (width - totalWidth) / 2 + buttonWidth / 2 + index * (buttonWidth + gap))
  };
}
