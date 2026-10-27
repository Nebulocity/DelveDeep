// Dialogs reuse the Town panel painting, keeping its four corners and four jewels
// at a fixed scale. Only undecorated edge runs stretch between those ornaments.
export function dialogFrame(scene, x, y, width, height, depth = 0, options = {}) {
  const texture = scene.textures.get('town-hub-panel');
  const source = texture.getSourceImage();
  const defaultFrame = texture.firstFrame;
  const scale = Math.min(options.compact ? 0.18 : 0.36, width / 432, height / 432);
  const corner = 144, jewel = 128;
  const bands = size => [corner, (size - jewel) / 2 - corner, jewel,
    (size - jewel) / 2 - corner, corner];
  const targets = size => [corner * scale, (size - jewel * scale) / 2 - corner * scale,
    jewel * scale, (size - jewel * scale) / 2 - corner * scale, corner * scale];
  const columns = bands(source.width), rows = bands(source.height);
  const widths = targets(width), heights = targets(height);

  // Tile a clean sample so a wide dialog does not magnify the painted grain.
  const inset = 'dialog-inset';
  if (!texture.has(inset)) texture.add(inset, 0, source.width / 2 - 64, source.height / 2 - 64, 128, 128);
  const pieces = [scene.add.tileSprite(-width / 2 + 4, -height / 2 + 4,
    width - 8, height - 8, texture.key, inset).setOrigin(0)];
  let sy = 0, dy = -height / 2;
  for (let row = 0; row < 5; row++) {
    let sx = 0, dx = -width / 2;
    for (let col = 0; col < 5; col++) {
      const key = `dialog-${row}-${col}`;
      if (!texture.has(key)) texture.add(key, 0, sx, sy, columns[col], rows[row]);
      if (row === 0 || row === 4 || col === 0 || col === 4) {
        pieces.push(scene.add.image(dx, dy, texture.key, key).setOrigin(0)
          .setDisplaySize(widths[col], heights[row]));
      }
      sx += columns[col];
      dx += widths[col];
    }
    sy += rows[row];
    dy += heights[row];
  }

  // Phaser makes the first added crop its default frame. Preserve the original
  // default so other panels that request no frame still receive the full painting.
  texture.firstFrame = defaultFrame;
  const frame = scene.add.container(x, y, pieces).setSize(width, height).setDepth(depth);
  frame.hidePressShadow = true;

  // Content and optional left/right portraits remain owned by the caller. This
  // artwork has no input handler; existing blockers and tutorial gates own taps.
  const padding = options.padding ?? (options.compact ? 28 : 56);
  frame.dialogContentBounds = { x: x - width / 2 + padding, y: y - height / 2 + padding,
    width: width - padding * 2, height: height - padding * 2 };
  return frame;
}

// Transparent guidance outlines use the same metallic gold and small jewels.
// Keep every stroke inside the original spotlight bounds and leave the target clear.
export function drawDialogOutline(graphics, x, y, width, height) {
  const cut = Math.min(16, width / 6, height / 6);
  const left = x + 4, top = y + 4, right = x + width - 4, bottom = y + height - 4;
  const points = [
    { x: left + cut, y: top }, { x: right - cut, y: top },
    { x: right, y: top + cut }, { x: right, y: bottom - cut },
    { x: right - cut, y: bottom }, { x: left + cut, y: bottom },
    { x: left, y: bottom - cut }, { x: left, y: top + cut }
  ];
  graphics.lineStyle(4, 0x514027, 0.9).strokePoints(points, true);
  graphics.lineStyle(1.5, 0xffdb86, 0.95).strokePoints(points, true);
  const diamond = (cx, cy, radius) => {
    graphics.fillStyle(0x6e4c1d, 1).fillPoints([
      { x: cx, y: cy - radius }, { x: cx + radius, y: cy },
      { x: cx, y: cy + radius }, { x: cx - radius, y: cy }
    ], true);
    graphics.lineStyle(1, 0xffdb86, 1).strokePoints([
      { x: cx, y: cy - radius }, { x: cx + radius, y: cy },
      { x: cx, y: cy + radius }, { x: cx - radius, y: cy }
    ], true);
  };
  for (const cx of [left + cut / 2, right - cut / 2]) {
    for (const cy of [top + cut / 2, bottom - cut / 2]) diamond(cx, cy, cut / 4);
  }
  diamond((left + right) / 2, top, Math.min(3, cut / 4));
  diamond((left + right) / 2, bottom, Math.min(3, cut / 4));
}
