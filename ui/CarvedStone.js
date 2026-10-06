import stonePanelUrl from '../assets/ui/carved-stone/panel.png?inline';

export const STONE = { text: '#f3ead5', muted: '#bdc9d4', gold: 0xe8b75c, edge: 0x62778f };

export function preloadCarvedStone(scene) {
  if (!scene.textures.exists('carved-stone-panel')) {
    scene.load.image('carved-stone-panel', stonePanelUrl);
  }
  if (!scene.textures.exists('carved-stone-camp-icons')) {
    scene.load.image('carved-stone-camp-icons', new URL('../assets/ui/carved-stone/camp-icons.png', import.meta.url).href);
  }
}

export function campStoneIcon(scene, x, y, index, depth) {
  const texture = scene.textures.get('carved-stone-camp-icons');
  const image = texture.getSourceImage();
  const cell = Math.floor(image.width / 3);
  const key = `camp-${index}`;
  if (!texture.has(key)) texture.add(key, 0, index * cell, 0, cell, image.height);
  return scene.add.image(x, y, texture.key, key).setDisplaySize(216, 216 * image.height / cell).setDepth(depth);
}

export function delveStoneTheme(delve) {
  const id = delve?.visuals?.environment?.id ?? delve?.id ?? '';
  if (/thorn|quarry/.test(id)) return { accent: 0xe3a354, crystal: 0xc66a37, motif: 'roots' };
  if (/dolmark|sunken/.test(id)) return { accent: 0x99b892, crystal: 0x6dc9cc, motif: 'water' };
  if (/void|abyss|verdant/.test(id)) return { accent: 0xb296df, crystal: 0xb077ee, motif: 'runes' };
  return { accent: 0xa1d65c, crystal: 0xb572e6, motif: 'slime' };
}

export function stoneText(scene, x, y, text, size = 34, depth = 4602, options = {}) {
  return scene.add.text(x, y, text, {
    fontFamily: 'Georgia', fontSize: `${size}px`, fontStyle: 'bold', color: STONE.text,
    stroke: '#090e17', strokeThickness: 2, ...options
  }).setOrigin(0.5).setDepth(depth);
}

export function addStonePanel(scene, x, y, width, height, depth = 4600) {
  const pixelWidth = Math.max(40, Math.round(width));
  const pixelHeight = Math.max(40, Math.round(height));
  const key = `carved-stone-surface-${pixelWidth}-${pixelHeight}`;
  if (!scene.textures.exists(key)) {
    const surface = scene.textures.createCanvas(key, pixelWidth, pixelHeight);
    const context = surface.getContext();
    const source = scene.textures.get('carved-stone-panel').getSourceImage();
    const sourceX = [0, 160, 1614];
    const sourceY = [66, 226, 660];
    const sourceWidths = [160, 1454, 160];
    const sourceHeights = [160, 434, 160];
    const targetX = [0, 20, pixelWidth - 20];
    const targetY = [0, 20, pixelHeight - 20];
    const targetWidths = [20, pixelWidth - 40, 20];
    const targetHeights = [20, pixelHeight - 40, 20];
    context.imageSmoothingEnabled = false;
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        context.drawImage(source, sourceX[column], sourceY[row], sourceWidths[column], sourceHeights[row],
          targetX[column], targetY[row], targetWidths[column], targetHeights[row]);
      }
    }
    surface.refresh();
  }
  const panel = scene.add.image(x, y, key).setDisplaySize(width, height).setDepth(depth);
  panel.name = 'carved-stone-panel';
  return panel;
}

export function addStoneButton(scene, x, y, width, height, depth = 4600, color = 0x1f2937) {
  const art = addStonePanel(scene, x, y, width, height, depth);
  const edge = scene.add.rectangle(x, y, width - 10, height - 10, 0, 0).setDepth(depth + 0.1);
  const hit = scene.add.rectangle(x, y, width, height, 0, 0.001)
    .setDepth(depth + 0.2).setInteractive({ useHandCursor: true });
  hit.name = 'carved-stone-button';
  hit.pressVisuals = [art, edge];
  hit.setFillStyle = (fill) => {
    art.setTint(fill === 0x3b321d || fill === 0x50432e ? 0xffd58e
      : fill === 0x633328 || fill === 0x3f1d1d ? 0xffaaa0
        : fill === 0x1c1917 ? 0x8c929b : 0xffffff);
    return hit;
  };
  hit.setStrokeStyle = (thickness, stroke, alpha = 1) => {
    edge.setStrokeStyle(thickness, stroke, alpha);
    return hit;
  };
  hit.once('destroy', () => { art.destroy(); edge.destroy(); });
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

export function stoneIcon(scene, x, y, kind, size = 42, depth = 4602, color = 0xe8dcc0) {
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
    [-13, 0, 13].forEach((px, i) => { g.fillCircle(px, i === 1 ? -12 : -7, 5); g.fillRoundedRect(px - 5, i === 1 ? -4 : 1, 10, 18, 3); });
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
