// Lantern and mineral light are separate cosmetic layers over the approved quarry art.
// They use presentation time only, so neither animation changes combat or saved rolls.
export function createQuarryEnvironmentEffects(scene, config, transform) {
  if (!config) return null;
  const objects = [];
  const lights = [];
  let elapsed = 0;
  let paused = false;

  // Draw in original artwork pixels. The same position and scale as the scenery keeps
  // each flame and crystal face aligned on both a phone and a desktop. Depth -950
  // puts the light above the background but behind units and foreground corner rocks.
  const makeLayer = () => {
    const graphic = scene.add.graphics().setPosition(transform.x, transform.y)
      .setScale(transform.scale).setDepth(-950);
    objects.push(graphic);
    return graphic;
  };

  // Several faint nested ellipses soften the spill instead of drawing one hard disk.
  const addHalo = (graphic, source, color) => {
    for (let step = 10; step >= 1; step -= 1) {
      graphic.fillStyle(color, 0.009);
      graphic.fillEllipse(source.x, source.y, source.radius * step / 4,
        source.radius * step / 3.3);
    }
  };

  for (const [index, source] of config.lanterns.entries()) {
    const graphic = makeLayer();
    addHalo(graphic, source, 0xffac46);
    graphic.fillStyle(0xffd281, 0.32);
    graphic.fillEllipse(source.x, source.y, 9, 17);
    lights.push({ graphic, kind: 'lantern', phase: index * 1.9, speed: 7.1 + index * 0.7 });
  }

  for (const [index, source] of config.crystals.entries()) {
    const graphic = makeLayer();
    addHalo(graphic, source, 0x36dfdf);
    graphic.fillStyle(0x73ffff, 0.28);

    // Phaser expects points with x/y properties; map converts each authored [x, y]
    // pair into that shape. The filled polygons brighten just the mineral faces.
    for (const face of source.faces) {
      graphic.fillPoints(face.map(([x, y]) => ({ x, y })), true);
    }
    lights.push({ graphic, kind: 'crystal', phase: index * 0.83, speed: 0.85 + index * 0.06 });
  }

  const update = (_time, delta) => {
    if (paused || scene.combatPaused) return;

    // Phaser supplies milliseconds. Convert to seconds and cap a returning frame
    // at 100 ms so background catch-up cannot cause a sudden flash. Sine angles
    // are radians; a speed near 1 gives a slow pulse over roughly six seconds.
    elapsed += Math.min(delta, 100) / 1000;
    for (const light of lights) {
      const wave = Math.sin(elapsed * light.speed + light.phase);
      if (light.kind === 'crystal') {
        light.graphic.setAlpha(0.48 + wave * 0.38);
      } else {

        // Mix two faster rhythms for independent flame flutter without random rolls.
        const flutter = Math.sin(elapsed * 13.3 + light.phase * 1.4) * 0.09;
        light.graphic.setAlpha(0.64 + wave * 0.2 + flutter);
      }
    }
  };
  const pause = () => { paused = true; };
  const resume = () => { paused = false; };
  scene.events.on('update', update);
  scene.events.on('pause', pause);
  scene.events.on('resume', resume);

  // Remove all listeners before destroying the graphics so repeated Quarry visits
  // cannot accumulate light layers or update objects belonging to an old scene.
  scene.events.once('shutdown', () => {
    scene.events.off('update', update);
    scene.events.off('pause', pause);
    scene.events.off('resume', resume);
    objects.forEach(object => object.destroy());
  });
  update(0, 0);
  return { objects };
}
