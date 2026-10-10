// These helpers build the shared stone interface for Delves. Artwork, border and touch
// area are separate objects so we can animate the face while keeping the hit area steady.
// Most text uses a centered origin. Changing origin changes which part of the object sits
// at x/y. Depth is draw order: a larger number puts an object over a smaller one.

import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import stonePanelUrl from '../assets/ui/carved-stone/panel.png?inline';

export const STONE = { text: '#f3ead5', muted: '#bdc9d4', gold: 0xe8b75c, edge: 0x62778f };

// Queue the shared panel and three-choice icon sheet only if they are not already loaded.
// scene is the Phaser screen that owns the objects, clock and input used here.
export function preloadCarvedStone(scene) {
  if (!scene.textures.exists('carved-stone-panel')) {
    scene.load.image('carved-stone-panel', stonePanelUrl);
  }

  if (!scene.textures.exists('carved-stone-camp-icons')) {
    scene.load.image('carved-stone-camp-icons', new URL('../assets/ui/carved-stone/camp-icons.png', import.meta.url).href);
  }
}

// Crop the requested town, farm or boss column and display it without changing its
// proportions. scene is the Phaser screen that owns the objects, clock and input used
// here. depth controls draw order; higher values draw over lower values.
export function campStoneIcon(scene, x, y, index, depth) {
  const texture = scene.textures.get('carved-stone-camp-icons');
  const image = texture.getSourceImage();

  // The icon sheet has three equally wide columns: town, farm and boss. Divide the sheet
  // width by three to get one column's width in source pixels.
  const cell = Math.floor(image.width / 3);

  // A named frame lets Phaser reuse this crop. index 0, 1 or 2 chooses the column; index *
  // cell is its left edge, and image.height keeps the whole column height.
  const key = `camp-${index}`;
  if (!texture.has(key)) texture.add(key, 0, index * cell, 0, cell, image.height);

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects.
  return scene.add.image(x, y, texture.key, key).setDisplaySize(216, 216 * image.height / cell).setDepth(depth);
}

// Choose trim colors and a motif from the encounter environment, with cave styling as the
// fallback.
export function delveStoneTheme(delve) {

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact. ?.
  // only follows this link when the value exists; a missing optional value gives
  // undefined.
  const id = delve?.visuals?.environment?.id ?? delve?.id ?? '';
  if (/thorn|quarry/.test(id)) return { accent: 0xe3a354, crystal: 0xc66a37, motif: 'roots' };
  if (/dolmark|sunken/.test(id)) return { accent: 0x99b892, crystal: 0x6dc9cc, motif: 'water' };

  if (/void|abyss|verdant/.test(id)) return { accent: 0xb296df, crystal: 0xb077ee, motif: 'runes' };
  return { accent: 0xa1d65c, crystal: 0xb572e6, motif: 'slime' };
}

// Create centered, outlined stone-interface text. options can override the shared
// defaults. scene is the Phaser screen that owns the objects, clock and input used here.
// depth controls draw order; higher values draw over lower values.
export function stoneText(scene, x, y, text, size = UI_FONT_SIZES.body34, depth = 4602, options = {}) {

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects. Origin is the anchor within the object: 0 is the left/top edge,
  // 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
  // necessarily the object's corner. ... copies the source's own fields into this object;
  // fields listed later replace earlier ones. This is a shallow copy, so nested objects
  // are still shared.
  return scene.add.text(x, y, text, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: `${size}px`, fontStyle: UI_FONT_WEIGHTS.bold, color: STONE.text,
    stroke: '#090e17', strokeThickness: 2, ...options
  }).setOrigin(0.5).setDepth(depth);
}

// Build a reusable nine-piece panel texture at this size, then place a display copy at
// x/y. scene is the Phaser screen that owns the objects, clock and input used here. width
// is the available width in this coordinate space.
export function addStonePanel(scene, x, y, width, height, depth = 4600) {

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  const pixelWidth = Math.max(40, Math.round(width));
  const pixelHeight = Math.max(40, Math.round(height));
  const key = `carved-stone-surface-${pixelWidth}-${pixelHeight}`;

  if (!scene.textures.exists(key)) {
    const surface = scene.textures.createCanvas(key, pixelWidth, pixelHeight);
    const context = surface.getContext();
    const source = scene.textures.get('carved-stone-panel').getSourceImage();

    // We split the source artwork into three columns and three rows. The corners stay
    // small, while the center and edge strips stretch to the requested size. This keeps
    // the carved frame from stretching like a single full-size image.
    const sourceX = [0, 160, 1614];
    const sourceY = [66, 226, 660];
    const sourceWidths = [160, 1454, 160];
    const sourceHeights = [160, 434, 160];

    // Each destination corner is 20 pixels wide and tall. The middle fills the remaining
    // size after taking 20 pixels from each edge. X/Y arrays are the start positions;
    // Widths/Heights arrays are the sizes of those nine pieces.
    const targetX = [0, 20, pixelWidth - 20];

    const targetY = [0, 20, pixelHeight - 20];
    const targetWidths = [20, pixelWidth - 40, 20];
    const targetHeights = [20, pixelHeight - 40, 20];

    // Disable smoothing so resizing keeps the supplied pixel edges crisp. The row/column
    // loops below copy each of the nine pieces into its matching slot.
    context.imageSmoothingEnabled = false;

    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {

        // drawImage copies a source rectangle into a destination rectangle. After the
        // image, the first four numbers choose the artwork crop; the last four choose its
        // position and size on this canvas.
        context.drawImage(source, sourceX[column], sourceY[row], sourceWidths[column], sourceHeights[row],
          targetX[column], targetY[row], targetWidths[column], targetHeights[row]);
      }
    }

    surface.refresh();
  }

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects.
  const panel = scene.add.image(x, y, key).setDisplaySize(width, height).setDepth(depth);
  panel.name = 'carved-stone-panel';
  return panel;
}

// Combine a textured face, inset outline and fixed input area into one button interface.
// scene is the Phaser screen that owns the objects, clock and input used here. width is
// the available width in this coordinate space.
export function addStoneButton(scene, x, y, width, height, depth = 4600, color = 0x1f2937) {
  const art = addStonePanel(scene, x, y, width, height, depth);

  // The border is inset five pixels on each side: subtract ten from both sizes. The
  // transparent rectangle only draws the selection outline over the panel.
  const edge = scene.add.rectangle(x, y, width - 10, height - 10, 0, 0).setDepth(depth + 0.1);

  // The full-size hit area stays still while the artwork depresses. Alpha 0.001 keeps it
  // effectively invisible but available for input. Its depth sits just above the face and
  // outline so it receives the touch.
  const hit = scene.add.rectangle(x, y, width, height, 0, 0.001)
    .setDepth(depth + 0.2).setInteractive({ useHandCursor: true });
  hit.name = 'carved-stone-button';
  hit.pressVisuals = [art, edge];

  // Callers use the familiar rectangle styling methods. Here we adapt those methods to
  // tint the textured face instead of filling a flat rectangle. The selected and
  // dangerous-action colors get gold or red tints.
  hit.setFillStyle = (fill) => {

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    art.setTint(fill === 0x3b321d || fill === 0x50432e ? 0xffd58e
      : fill === 0x633328 || fill === 0x3f1d1d ? 0xffaaa0
        : fill === 0x1c1917 ? 0x8c929b : 0xffffff);

    return hit;
  };

  hit.setStrokeStyle = (thickness, stroke, alpha = 1) => {
    edge.setStrokeStyle(thickness, stroke, alpha);
    return hit;
  };

  // once registers a callback that removes itself after the first matching event.
  hit.once('destroy', () => {
    art.destroy();
    edge.destroy();
  });

  // This control consists of three objects. Hiding the hit area alone would leave the
  // artwork visible, so visibility is passed to the face and border too.
  hit.setVisible = (visible) => {
    hit.visible = visible;
    art.setVisible(visible);
    edge.setVisible(visible);

    return hit;
  };

  hit.setFillStyle(color);
  return hit;
}

// Ornaments live in the interface margins, away from the shared tactical floor.
export function addStoneOrnaments(scene, x, y, width, theme, depth = 4601) {

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects.
  const g = scene.add.graphics().setDepth(depth);
  for (const side of [-1, 1]) {
    const px = x + side * (width / 2 - 26);
    g.lineStyle(3, 0x302547).fillStyle(theme.crystal);
    g.fillPoints([{ x: px, y: y - 25 }, { x: px + 12, y }, { x: px, y: y + 20 }, { x: px - 12, y }], true);
    g.strokePoints([{ x: px, y: y - 25 }, { x: px + 12, y }, { x: px, y: y + 20 }, { x: px - 12, y }], true);
    g.lineStyle(3, 0xd7c4f3, 0.6).lineBetween(px, y - 19, px - 6, y);
    g.fillStyle(theme.accent);

    if (theme.motif === 'slime') {
      g.fillRoundedRect(px + side * 16 - 4, y + 10, 8, 27, 4);
      g.fillRoundedRect(px + side * 25 - 3, y + 6, 6, 16, 3);
    } else {
      g.lineStyle(3, theme.accent).strokePoints([
        { x: px + side * 17, y: y - 12 }, { x: px + side * 24, y: y + 6 },
        { x: px + side * 16, y: y + 26 }
      ]);
    }
  }

  return g;
}

// Draw the requested small interface symbol around its supplied center. scene is the
// Phaser screen that owns the objects, clock and input used here. depth controls draw
// order; higher values draw over lower values.
export function stoneIcon(scene, x, y, kind, size = 42, depth = 4602, color = 0xe8dcc0) {

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects.
  const g = scene.add.graphics({ x, y }).setDepth(depth);
  g.setScale(size / 48);
  g.lineStyle(4, color).fillStyle(color);

  if (['MELEE', 'ATTACK'].includes(kind)) {
    g.lineBetween(-15, 17, 14, -14).lineBetween(-13, 1, 1, 14);
    g.fillTriangle(14, -14, 8, -19, 19, -19);
    if (kind === 'ATTACK') g.lineBetween(-14, -14, 16, 17).lineBetween(-1, 14, 12, 1);
  } else if (kind === 'TANKS') {
    g.strokePoints([{ x: -16, y: -18 }, { x: 16, y: -18 }, { x: 14, y: 8 }, { x: 0, y: 21 }, { x: -14, y: 8 }], true);
    g.lineBetween(0, -17, 0, 16);
  } else if (kind === 'HEALERS') {
    g.fillRect(-5, -20, 10, 40).fillRect(-20, -5, 40, 10);
  } else if (kind === 'RANGED') {
    g.strokePoints([{ x: -10, y: -19 }, { x: 5, y: -12 }, { x: 12, y: 0 }, { x: 5, y: 12 }, { x: -10, y: 19 }]);
    g.lineBetween(-10, -19, -10, 19).lineBetween(-20, 0, 20, 0);
    g.fillTriangle(22, 0, 13, -6, 13, 6);
  } else if (['ALL', 'STACK'].includes(kind)) {
    [-13, 0, 13].forEach((px, i) => {
      g.fillCircle(px, i === 1 ? -12 : -7, 5);
      g.fillRoundedRect(px - 5, i === 1 ? -4 : 1, 10, 18, 3);
    });
  } else if (kind === 'HOLD') {
    g.fillRoundedRect(-13, -5, 26, 25, 7);
    [-11, -4, 3, 10].forEach((px, i) => g.fillRoundedRect(px - 2, -20 + Math.abs(i - 1) * 3, 5, 25, 2));
  } else if (kind === 'INTERRUPT') {
    g.fillRect(-3, -19, 6, 26).fillCircle(0, 17, 4);
  } else if (kind === 'PAUSE') {
    g.fillRect(-13, -18, 9, 36).fillRect(4, -18, 9, 36);
  } else if (kind === 'TOWN') {
    g.fillRect(-18, -3, 36, 25).fillRect(-22, -16, 12, 37).fillRect(10, -16, 12, 37);
    g.fillTriangle(-24, -16, -16, -28, -8, -16).fillTriangle(8, -16, 16, -28, 24, -16);
    g.fillStyle(0x101c2c).fillRoundedRect(-5, 5, 10, 17, 5);
  } else if (kind === 'FARM') {
    g.fillRoundedRect(-18, -10, 28, 28, 7).fillTriangle(-12, -12, 4, -12, 0, -22);
    g.lineStyle(3, 0xf7d178).strokeCircle(12, 13, 10).strokeCircle(-6, 20, 8);
  } else if (kind === 'BOSS') {
    g.fillCircle(0, -1, 18).fillRect(-10, 10, 20, 13);
    g.fillTriangle(-14, -10, -28, -24, -23, 3).fillTriangle(14, -10, 28, -24, 23, 3);
    g.fillStyle(0x21131e).fillTriangle(-13, -5, -3, 0, -10, 6).fillTriangle(13, -5, 3, 0, 10, 6);
    g.fillTriangle(0, 4, -4, 12, 4, 12);
  } else if (kind === 'RETREAT') {
    g.lineBetween(18, 0, -17, 0).lineBetween(-17, 0, -4, -13).lineBetween(-17, 0, -4, 13);
  } else {
    g.lineBetween(-18, 0, 18, 0).lineBetween(0, -18, 0, 18);
    [-1, 1].forEach(s => {
      g.lineBetween(s * 18, 0, s * 10, -7).lineBetween(s * 18, 0, s * 10, 7);
      g.lineBetween(0, s * 18, -7, s * 10).lineBetween(0, s * 18, 7, s * 10);
    });
  }

  return g;
}
