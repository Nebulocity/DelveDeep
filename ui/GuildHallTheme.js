// These colors and builders give the Hall its oak, leather and brass surfaces. Generated
// canvas textures are cached by their size so repeated cards can reuse them.

export const GUILD = { ink: '#382719', paper: '#ebd7b4', brass: 0xc49b59, bright: 0xf0d599, oak: 0x4b2d19 };

// Check whether this scene should use the Hall's materials and dialog styling. scene is
// the Phaser screen that owns the objects, clock and input used here.
export function isGuildHall(scene) {

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  return ['AdventurersHallScene', 'RosterScene', 'ItemsScene', 'RaidLeaderScene'].includes(scene.scene?.key);
}

// Small deterministic material tiles are shared by every Hall surface.
function material(scene, kind) {
  const key = `guild-material-${kind}`;
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, 256, 256);
  const context = texture.context;
  const pixels = context.createImageData(256, 256);
  const base = { oak: [78, 47, 27], button: [90, 58, 34], leather: [42, 29, 22], paper: [222, 201, 164] }[kind];
  let seed = 7351;

  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {

      // These bit operators work with 32-bit integers. >>> shifts in zero bits, while ^
      // mixes bits with XOR. They are different from ordinary multiplication or
      // exponentiation.
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 4294967296 - 0.5;

      // Angles are radians. cos(angle) gives the horizontal part of a circle; sin(angle)
      // gives the vertical part. Multiplying by a radius turns those fractions into
      // offsets.
      const grain = Math.sin(y * Math.PI / 8 + Math.sin(x * Math.PI / 128) * 2.4 + Math.sin(x * Math.PI / 32) * 0.7);
      const fine = Math.sin(y * Math.PI / 2 + Math.sin(x * Math.PI / 64));

      // Math.hypot calculates straight-line length from the x/y differences: square each,
      // add them, then take the square root.
      const knotDistance = Math.hypot((x - 161) * 0.24, (y - 73) * 0.6);
      const knot = Math.sin(knotDistance * 1.8) * Math.exp(-knotDistance / 14) * 7;

      // The condition before ? chooses the first value when true and the value after :
      // when false. % gives the remainder. With a nonnegative index and positive list
      // length, it wraps the index back to the start of the list.
      const variation = kind === 'paper' ? noise * 11 + fine * 1.3
        : kind === 'leather' ? noise * 13 + ((x + y) % 4 === 0 ? -4 : 0)
          : grain * 5.5 + fine * 2 + knot + noise * 8 - (y % 128 < 3 ? 18 : 0);
      const offset = (y * 256 + x) * 4;
      pixels.data[offset] = base[0] + variation;
      pixels.data[offset + 1] = base[1] + variation * 0.72;
      pixels.data[offset + 2] = base[2] + variation * 0.45;

      pixels.data[offset + 3] = 255;
    }
  }

  context.putImageData(pixels, 0, 0);
  texture.refresh();
  return key;
}

// Draw one brass fitting at the supplied local position.
function rivet(art, x, y, size = 5) {
  art.fillStyle(0x150d08).fillCircle(x + 1, y + 2, size + 2);
  art.fillStyle(GUILD.brass).fillCircle(x, y, size);
  art.fillStyle(GUILD.bright, 0.75).fillCircle(x - 1.5, y - 1.5, size / 2);
  art.lineStyle(1, 0x684720).lineBetween(x - size / 2, y, x + size / 2, y);
}

// Place matching corner fittings around the surface's supplied bounds.
function corners(art, width, height, compact) {

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const reach = compact ? 22 : 37;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const x = sx * (width / 2 - 9), y = sy * (height / 2 - 9);
    art.lineStyle(compact ? 4 : 6, GUILD.brass).lineBetween(x, y, x - sx * reach, y);
    art.lineBetween(x, y, x, y - sy * reach);
    art.lineStyle(1, GUILD.bright, 0.8).lineBetween(x - sx * 2, y - sy * 2, x - sx * (reach - 3), y - sy * 2);
    art.lineBetween(x - sx * 2, y - sy * 2, x - sx * 2, y - sy * (reach - 3));
    rivet(art, x - sx * 7, y - sy * 7, compact ? 3 : 5);
  }
}

// Build a sized oak/leather surface with reusable texture and brass framing. scene is the
// Phaser screen that owns the objects, clock and input used here. width is the available
// width in this coordinate space.
export function guildSurface(scene, x, y, width, height, variant = 'panel', selected = false) {
  const compact = ['button', 'row', 'track', 'thumb'].includes(variant);

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const rim = variant === 'paper' ? 26 : compact ? 8 : 18;
  const faceKind = variant === 'paper' ? 'paper' : ['button', 'thumb', 'beam'].includes(variant) ? 'button' : 'leather';

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  const face = scene.add.tileSprite(0, 0, Math.max(1, width - rim * 2), Math.max(1, height - rim * 2), material(scene, faceKind));
  if (selected) face.setTint(0xffd797);
  const timber = scene.add.tileSprite(0, 0, width, height, material(scene, 'oak'));
  const art = scene.add.graphics();
  art.lineStyle(3, 0x140c07).strokeRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2);
  art.lineStyle(selected ? 4 : 2, selected ? GUILD.bright : GUILD.brass, selected ? 1 : 0.74)
    .strokeRect(-width / 2 + 5, -height / 2 + 5, width - 10, height - 10);

  art.lineStyle(2, 0x170e09, 0.9).strokeRect(-width / 2 + rim, -height / 2 + rim, width - rim * 2, height - rim * 2);
  art.lineStyle(1, variant === 'paper' ? 0x8e7248 : 0xc1945e, 0.34)
    .strokeRect(-width / 2 + rim + 4, -height / 2 + rim + 4, width - (rim + 4) * 2, height - (rim + 4) * 2);

  if (!['beam', 'track', 'thumb'].includes(variant)) corners(art, width, height, compact);
  if (variant === 'thumb') {
    art.lineStyle(2, GUILD.brass, 0.8);
    for (const offset of [-8, 0, 8]) art.lineBetween(-width / 2 + 8, offset, width / 2 - 8, offset);
  }
  const surface = scene.add.container(x, y, [timber, face, art]).setSize(width, height).setName(`guild-${variant}`);

  return surface;
}

// Draw the shared Hall crest at its supplied position and scale. scene is the Phaser
// screen that owns the objects, clock and input used here.
export function guildCrest(scene, x, y, size = 54, muted = false) {
  const art = scene.add.graphics().setPosition(x, y).setScale(size / 54);
  art.fillStyle(0x2e1711).fillCircle(0, 0, 29);

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  art.lineStyle(2, GUILD.brass, muted ? 0.3 : 0.9).strokeCircle(0, 0, 29);
  art.fillStyle(0x623126, muted ? 0.25 : 1);
  art.beginPath().moveTo(-16, -18).lineTo(16, -18).lineTo(15, 8).lineTo(0, 22).lineTo(-15, 8).closePath().fillPath();
  art.lineStyle(2, GUILD.brass, muted ? 0.3 : 1).strokePath();
  art.lineBetween(-9, -12, 10, 12).lineBetween(9, -12, -10, 12);
  art.lineBetween(-12, -4, -3, -10).lineBetween(12, -4, 3, -10);
  art.fillStyle(GUILD.bright, muted ? 0.25 : 0.9).fillCircle(0, -4, 3);

  return art;
}

// Draw a decorative section divider inside the Hall workspace. scene is the Phaser screen
// that owns the objects, clock and input used here. width is the available width in this
// coordinate space.
export function guildRule(scene, x, y, width) {
  const art = scene.add.graphics().setPosition(x, y);
  art.lineStyle(1, GUILD.brass, 0.5).lineBetween(-width / 2, 0, -12, 0).lineBetween(12, 0, width / 2, 0);
  art.lineStyle(2, GUILD.brass, 0.8);
  art.beginPath().moveTo(0, -5).lineTo(7, 0).lineTo(0, 5).lineTo(-7, 0).closePath().strokePath();

  return art;
}
