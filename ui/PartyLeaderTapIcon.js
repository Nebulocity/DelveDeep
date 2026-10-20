// A fingertip striking a horned monster, drawn locally so floating damage needs no
// font glyph, emoji support or extra texture load on browser and Android.
export function createPartyLeaderTapIcon(scene, x, y, size = 48) {
  const icon = scene.add.graphics().setPosition(x, y).setScale(size / 64);
  const polygon = points => {
    icon.beginPath();
    icon.moveTo(points[0][0] - 32, points[0][1] - 32);
    points.slice(1).forEach(([px, py]) => icon.lineTo(px - 32, py - 32));
    icon.closePath();
    icon.fillPath();
    icon.strokePath();
  };
  icon.fillStyle(0xfbbf24, 1).lineStyle(3, 0x171009, 1);

  // The raised index finger and curled knuckles read as a tap rather than a weapon.
  polygon([[5, 41], [8, 34], [25, 17], [29, 17], [32, 20], [31, 24],
    [23, 33], [27, 31], [32, 34], [36, 35], [39, 40], [37, 48],
    [28, 57], [18, 57], [6, 46]]);

  // Keep the face separate from the finger, with two dark eyes visible at small sizes.
  polygon([[37, 24], [36, 13], [44, 17], [52, 17], [60, 13], [59, 24],
    [60, 35], [54, 41], [43, 41], [37, 35]]);
  icon.fillStyle(0x171009, 1);
  icon.fillRect(40 - 32, 26 - 32, 5, 5);
  icon.fillRect(51 - 32, 26 - 32, 5, 5);
  icon.lineStyle(3, 0xfde68a, 1);
  icon.lineBetween(31 - 32, 7 - 32, 31 - 32, 1 - 32);
  icon.lineBetween(23 - 32, 11 - 32, 19 - 32, 6 - 32);
  icon.lineBetween(37 - 32, 10 - 32, 41 - 32, 5 - 32);
  return icon;
}
