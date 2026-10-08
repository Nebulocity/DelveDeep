import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
const THEMES = {
  Hall: { face: 0x382416, edge: 0xc89b61, glow: 0xf3d5a1, shadow: 0x160d08 },
  Alchemist: { face: 0x20382e, edge: 0xb99a67, glow: 0xc7e4b2, shadow: 0x0c1813 },
  Blacksmith: { face: 0x272b2c, edge: 0xa87957, glow: 0xffcb91, shadow: 0x111314 },
  Enchanter: { face: 0x28243b, edge: 0x9d86bd, glow: 0xe2d1ff, shadow: 0x100d1a }
};

function strokeShape(graphics, points, close = true) {
  graphics.beginPath();
  graphics.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) graphics.lineTo(points[i], points[i + 1]);
  if (close) graphics.closePath();
  graphics.strokePath();
}

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

export function addFacilityChoiceCard(scene, facilityName, entry, x, y, width, active = false, { height = 150, showSubtitle = true } = {}) {
  const theme = THEMES[facilityName] ?? THEMES.Hall;
  const left = x - width / 2;
  const top = y - height / 2;
  const art = scene.add.graphics();
  art.fillStyle(theme.shadow, 0.96);
  art.fillRoundedRect(left + 5, top + 7, width, height, 15);
  art.fillStyle(theme.face, 0.96);
  art.fillRoundedRect(left, top, width, height, 15);
  art.lineStyle(active ? 6 : 4, active ? theme.glow : theme.edge, 0.95);
  art.strokeRoundedRect(left, top, width, height, 15);
  art.lineStyle(2, theme.edge, 0.45);
  art.strokeRoundedRect(left + 9, top + 9, width - 18, height - 18, 10);
  for (let i = 0; i < 9; i++) {
    art.lineStyle(1, i % 3 === 0 ? theme.glow : theme.shadow, i % 3 === 0 ? 0.15 : 0.3);
    const grainY = top + 16 + i * (height - 32) / 8;
    art.lineBetween(left + 120, grainY, left + width - 20 - i % 3 * 13, grainY);
  }
  if (facilityName === 'Blacksmith') {
    art.fillStyle(0x111515, 0.7);
    art.fillRect(left + 14, top + 16, 8, height - 32);
    art.fillRect(left + width - 22, top + 16, 8, height - 32);
  } else if (facilityName === 'Enchanter') {
    art.lineStyle(2, theme.glow, 0.43);
    art.strokeCircle(left + width - 54, y, 25);
    art.strokeCircle(left + width - 54, y, 13);
  } else if (facilityName === 'Alchemist') {
    art.lineStyle(2, theme.glow, 0.42);
    art.strokeCircle(left + width - 59, y - 20, 9);
    art.strokeCircle(left + width - 39, y + 17, 5);
  }
  [left + 21, left + width - 21].forEach((rivetX) => {
    [top + 20, top + height - 20].forEach((rivetY) => {
      art.fillStyle(0x171819);
      art.fillCircle(rivetX, rivetY, 6);
      art.fillStyle(theme.edge, 0.55);
      art.fillCircle(rivetX - 1, rivetY - 1, 2);
    });
  });

  const compact = showSubtitle && width < 500;
  const emblemX = compact ? x : left + 78;
  const emblem = scene.add.graphics().setPosition(emblemX, compact ? y - 32 : y);
  emblem.fillStyle(theme.shadow, 0.96);
  emblem.fillCircle(0, 0, 53);
  emblem.lineStyle(4, theme.edge, 0.95);
  emblem.strokeCircle(0, 0, 52);
  emblem.lineStyle(1, theme.glow, 0.55);
  emblem.strokeCircle(0, 0, 44);
  drawChoiceIcon(emblem, entry.icon, theme.glow);
  if (compact || !showSubtitle) emblem.setScale(0.55);

  scene.add.text(showSubtitle ? x : x + 28, showSubtitle ? compact ? y + 14 : y - 24 : y, entry.label, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: width < 500 ? fontPx('body34') : entry.label.length > 10 ? fontPx('heading38') : fontPx('heading42'),
    fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2',
    stroke: theme.shadow === 0x100d1a ? '#100d1a' : '#170f0a', strokeThickness: 3
  }).setOrigin(0.5);
  if (showSubtitle) scene.add.text(x, compact ? y + 53 : y + 34, entry.subtitle, {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: compact ? fontPx('support28') : fontPx('support29'), color: '#e8d6bc', align: 'center',
    wordWrap: { width: compact ? width - 30 : width - 185 }
  }).setOrigin(0.5);
  return scene.add.rectangle(x, y, width, height, 0x000000, 0).setInteractive({ useHandCursor: true });
}

export function addCategoryIcon(scene, icon, x, y, color) {
  const art = scene.add.graphics().setPosition(x, y).setScale(0.55);
  drawChoiceIcon(art, icon, color);
  return art;
}
export function addFacilityPlate(scene, facilityName, x, y, width, height) {
  const theme = THEMES[facilityName] ?? THEMES.Hall;
  const art = scene.add.graphics().setPosition(x, y);
  const left = -width / 2;
  const top = -height / 2;
  const radius = facilityName === 'Blacksmith' ? 5 : 14;
  art.fillStyle(theme.shadow, 0.95);
  art.fillRoundedRect(left + 4, top + 6, width, height, radius);
  art.fillStyle(theme.face, 0.98);
  art.fillRoundedRect(left, top, width, height, radius);
  art.lineStyle(3, theme.edge, 0.95);
  art.strokeRoundedRect(left, top, width, height, radius);
  art.lineStyle(1, theme.glow, 0.4);
  art.strokeRoundedRect(left + 7, top + 7, width - 14, height - 14, Math.max(2, radius - 4));
  for (let i = 0; i < 5; i++) {
    art.lineStyle(1, i % 2 ? theme.glow : theme.shadow, i % 2 ? 0.08 : 0.35);
    art.lineBetween(left + 18, top + 15 + i * (height - 30) / 4, -left - 18, top + 15 + i * (height - 30) / 4);
  }
  for (const side of [-1, 1]) {
    const edgeX = side * (width / 2 - 17);
    if (facilityName === 'Blacksmith') {
      art.fillStyle(theme.shadow, 0.85);
      art.fillRect(edgeX - 5, top + 10, 10, height - 20);
      for (const rivetY of [top + 16, -top - 16]) {
        art.fillStyle(theme.edge, 0.9);
        art.fillCircle(edgeX, rivetY, 4);
        art.fillStyle(theme.glow, 0.5);
        art.fillCircle(edgeX - 1, rivetY - 1, 1.5);
      }
    } else if (facilityName === 'Alchemist') {
      art.lineStyle(2, theme.glow, 0.6);
      art.strokeCircle(edgeX, -10, 4);
      art.strokeCircle(edgeX, 12, 2);
      art.lineStyle(2, theme.edge, 0.7);
      art.lineBetween(edgeX, -2, edgeX, 5);
    } else {
      art.lineStyle(2, theme.glow, 0.7);
      strokeShape(art, [edgeX, -12, edgeX + 5, 0, edgeX, 12, edgeX - 5, 0]);
      art.lineBetween(edgeX - 8, 0, edgeX + 8, 0);
    }
  }
  return { art, theme };
}
