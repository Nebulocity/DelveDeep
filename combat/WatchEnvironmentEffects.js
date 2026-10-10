// Lantern light and water are separate cosmetic layers over the approved chamber.
// Use scene update time, never the saved combat random stream, for gentle ambience.
export function createWatchEnvironmentEffects(scene, config, transform) {
  if (!config) return null;
  const objects = [];
  let elapsed = 0;
  let lastFrame = -1;

  // Every drawing uses original-image pixels and the artwork's shared transform.
  // Depth -950 is above the background but behind combatants and corner masonry.
  const makeLayer = () => {
    const graphic = scene.add.graphics().setPosition(transform.x, transform.y)
      .setScale(transform.scale).setDepth(-950);
    objects.push(graphic);
    return graphic;
  };
  const water = makeLayer();
  const lanterns = config.lanterns.map(source => ({ source, graphic: makeLayer() }));

  // Geometry masks use screen coordinates, so project the traced water polygons
  // once. The hidden mask clips both ripple rings and golden water reflections.
  const maskShape = scene.make.graphics({ x: 0, y: 0, add: false });
  maskShape.fillStyle(0xffffff);
  for (const polygon of config.waterRegions) {
    maskShape.fillPoints(polygon.map(([x, y]) => ({
      x: transform.x + x * transform.scale, y: transform.y + y * transform.scale
    })), true);
  }
  const mask = maskShape.createGeometryMask();
  water.setMask(mask);

  // Layer several faint rings for soft light without a hard glowing disk. The
  // small bright center follows the flame, while the broad spill lights masonry.
  for (const { source, graphic } of lanterns) {
    for (let step = 8; step >= 1; step -= 1) {
      graphic.fillStyle(0xffb14c, 0.012);
      graphic.fillEllipse(source.x, source.y, source.radius * step / 3,
        source.radius * step / 2.5);
    }
    graphic.fillStyle(0xffd480, 0.34);
    graphic.fillEllipse(source.x, source.y, 12, 22);
  }

  // Different phases keep lanterns from blinking together. Radians measure the
  // sine-wave angle; combining two speeds gives an irregular but gentle flutter.
  const brightness = index => 0.66 + Math.sin(elapsed * (7.1 + index * 0.7)
    + index * 1.9) * 0.17 + Math.sin(elapsed * 13.3 + index * 2.7) * 0.08;
  const update = (_time, delta) => {
    if (scene.combatPaused) return;

    // Convert milliseconds to seconds and cap catch-up so returning to the game
    // cannot jump the water animation through several seconds in one update.
    elapsed += Math.min(delta, 100) / 1000;
    lanterns.forEach(({ graphic }, index) => graphic.setAlpha(brightness(index)));
    const frame = Math.floor(elapsed * 24);
    if (frame === lastFrame) return;
    lastFrame = frame;
    water.clear();

    // Two expanding, fading ellipses per source suggest ripples in perspective.
    // The remainder operator wraps each ring's progress into a repeating 0..1 cycle.
    config.ripples.forEach((source, index) => {
      for (let ring = 0; ring < 2; ring += 1) {
        const progress = (elapsed * 0.32 + index * 0.173 + ring * 0.5) % 1;
        const radius = source.radius * (0.3 + progress);
        water.lineStyle(1.3, 0xabe4ed, Math.sin(progress * Math.PI) * 0.19);
        water.strokeEllipse(source.x + Math.sin(elapsed * 0.7 + index) * 3,
          source.y, radius * 2, radius * 0.34);
      }
    });

    // Short reflection streaks drift sideways with the water and brighten with
    // their matching lantern. The polygon mask prevents light from crossing stone.
    config.reflections.forEach((source, index) => {
      for (let stripe = 0; stripe < 9; stripe += 1) {
        const wave = Math.sin(elapsed * 1.8 + stripe * 1.7 + index);
        water.fillStyle(0xffc46b, brightness(index) * (0.08 + (wave + 1) * 0.025));
        water.fillEllipse(source.x + wave * 5, source.y + stripe * source.height / 9,
          source.width * (0.35 + (wave + 1) * 0.2), 2);
      }
    });
  };
  scene.events.on('update', update);

  // Release the listener and mask before destroying the drawings. This prevents
  // repeated visits from accumulating effects or touching a retired scene.
  scene.events.once('shutdown', () => {
    scene.events.off('update', update);
    water.clearMask();
    mask.destroy();
    maskShape.destroy();
    objects.forEach(object => object.destroy());
  });
  update(0, 0);
  return { objects };
}
