// Shared compact line symbols used by existing Hall and identity displays.

// Trace and outline the supplied local-coordinate shape on this Graphics object.
function strokeShape(graphics, points, close = true) {
  graphics.beginPath();
  graphics.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) graphics.lineTo(points[i], points[i + 1]);

  if (close) graphics.closePath();
  graphics.strokePath();
}

// Draw the matching decorative illustration in the action card's local coordinate space.
function drawChoiceIcon(graphics, icon, color) {
  graphics.lineStyle(5, color, 0.96);
  if (icon === 'shield') {
    strokeShape(graphics, [0, -30, 25, -20, 21, 10, 0, 29, -21, 10, -25, -20]);
    graphics.lineBetween(-13, 0, 13, 0);
    graphics.lineBetween(0, -13, 0, 16);
  } else if (icon === 'satchel') {
    graphics.strokeRoundedRect(-24, -13, 48, 43, 6);
    graphics.strokeEllipse(0, -15, 28, 24);
    graphics.lineBetween(-12, 4, 12, 4);
  } else if (icon === 'tactics') {
    graphics.lineBetween(-25, -27, 23, 23);
    graphics.lineBetween(25, -27, -23, 23);
    graphics.lineBetween(-26, -11, -10, -27);
    graphics.lineBetween(26, -11, 10, -27);
    graphics.strokeCircle(0, 0, 5);
  } else if (icon === 'flask' || icon === 'flask-sale') {
    strokeShape(graphics, [-10, -29, 10, -29, 10, -8, 23, 18, 18, 27, -18, 27, -23, 18, -10, -8]);
    graphics.lineBetween(-18, 8, 18, 8);
    if (icon === 'flask-sale') graphics.strokeCircle(24, -21, 8);
  } else if (icon === 'cauldron') {
    graphics.strokeEllipse(0, -8, 52, 17);
    strokeShape(graphics, [-25, -6, -20, 23, 20, 23, 25, -6], false);
    graphics.lineBetween(-13, 23, -18, 31);
    graphics.lineBetween(13, 23, 18, 31);
    graphics.strokeCircle(-10, -24, 4);
    graphics.strokeCircle(8, -30, 5);
  } else if (icon === 'sword') {
    strokeShape(graphics, [0, -31, 8, -17, 4, 14, -4, 14, -8, -17]);
    graphics.lineBetween(-20, 14, 20, 14);
    graphics.lineBetween(0, 14, 0, 29);
  } else if (icon === 'ingot') {
    strokeShape(graphics, [-24, 17, -16, -8, 17, -8, 25, 17]);
    graphics.lineBetween(-16, -8, -8, 17);
    graphics.lineBetween(17, -8, 9, 17);
    graphics.lineBetween(-24, 17, 25, 17);
  } else if (icon === 'anvil') {
    strokeShape(graphics, [-29, -5, 27, -5, 16, 7, 6, 7, 6, 19, 21, 19, 21, 27, -20, 27, -20, 19, -6, 19, -6, 7, -21, 7]);
    graphics.lineBetween(6, -20, 18, -8);
  } else if (icon === 'scroll' || icon === 'scroll-sale') {
    graphics.strokeRoundedRect(-18, -26, 36, 52, 5);
    graphics.strokeCircle(-18, -20, 6);
    graphics.strokeCircle(18, 20, 6);
    graphics.lineBetween(-9, -10, 9, -10);
    graphics.lineBetween(-9, 0, 9, 0);

    if (icon === 'scroll-sale') graphics.strokeCircle(23, -22, 8);
  } else if (icon === 'rune') {
    strokeShape(graphics, [0, -31, 8, -8, 29, 0, 8, 8, 0, 31, -8, 8, -29, 0, -8, -8]);
    graphics.strokeCircle(0, 0, 7);
  }
}

// Draw a small matching symbol beside the item category control.
export function addCategoryIcon(scene, icon, x, y, color) {
  const art = scene.add.graphics().setPosition(x, y).setScale(0.55);
  drawChoiceIcon(art, icon, color);
  return art;
}

