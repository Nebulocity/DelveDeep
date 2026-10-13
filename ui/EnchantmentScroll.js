// Draw a shared glowing purple scroll so enchanted gear is easy to spot in every Hall view.
export function addEnchantmentScroll(scene, x, y, size = 36, depth = 0) {
  const glow = size * 0.38;
  const icon = scene.add.graphics().setPosition(x, y).setDepth(depth);

  // Soft purple light sits behind the scroll, with brighter edges on the paper and rolls.
  icon.fillStyle(0x9b4dff, 0.2).fillCircle(0, 0, size * 0.54);
  icon.lineStyle(glow, 0xa855f7, 0.2).strokeCircle(0, 0, size * 0.38);
  icon.fillStyle(0x542179, 1).fillRoundedRect(-size * 0.24, -size * 0.36, size * 0.48, size * 0.72, size * 0.09);
  icon.lineStyle(2, 0xe9d5ff, 0.98).strokeRoundedRect(-size * 0.24, -size * 0.36, size * 0.48, size * 0.72, size * 0.09);
  icon.fillStyle(0xe9d5ff, 0.96).fillRoundedRect(-size * 0.16, -size * 0.26, size * 0.32, size * 0.52, size * 0.04);
  icon.fillStyle(0xa855f7, 1).fillRoundedRect(-size * 0.22, -size * 0.4, size * 0.44, size * 0.14, size * 0.07);
  icon.fillRoundedRect(-size * 0.22, size * 0.26, size * 0.44, size * 0.14, size * 0.07);
  icon.lineStyle(2, 0x7135a5, 1).strokeCircle(0, -size * 0.33, size * 0.06);
  icon.strokeCircle(0, size * 0.33, size * 0.06);
  icon.lineStyle(1.5, 0x7936a8, 0.95).lineBetween(-size * 0.09, -size * 0.08, size * 0.09, -size * 0.08);
  icon.lineBetween(-size * 0.09, size * 0.02, size * 0.09, size * 0.02);

  return icon;
}
