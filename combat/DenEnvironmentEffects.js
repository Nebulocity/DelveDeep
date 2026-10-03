function drawGlow(scene, radius, color) {
  const graphic = scene.add.graphics();
  graphic.fillStyle(color, 0.035);
  graphic.fillEllipse(0, 0, radius * 2.8, radius * 2);
  graphic.fillStyle(color, 0.075);
  graphic.fillEllipse(0, 0, radius * 1.65, radius * 1.2);
  graphic.fillStyle(color, 0.13);
  graphic.fillEllipse(0, 0, radius * 0.75, radius * 0.55);
  return graphic;
}

export function createDenEnvironmentEffects(scene, config, transform) {
  if (!config) return null;
  const objects = [];
  const glows = [];
  let elapsed = 0;

  for (const [kind, sources] of [
    ['lantern', config.lanterns ?? []],
    ['fungus', config.fungi ?? []]
  ]) {
    for (const [index, source] of sources.entries()) {
      const color = kind === 'lantern' ? 0xffba59 : 0x83ffd6;
      const graphic = drawGlow(scene, source.radius, color)
        .setPosition(transform.x + source.x * transform.scale,
          transform.y + source.y * transform.scale)
        .setScale(transform.scale).setDepth(-960);
      objects.push(graphic);
      glows.push({ graphic, kind, phase: index * 1.67 });
    }
  }

  const update = (_time, delta) => {
    if (scene.combatPaused) return;
    elapsed += Math.min(delta, 100) / 1000;
    for (const glow of glows) {
      const speed = glow.kind === 'lantern' ? 7.4 : 1.9;
      const pulse = Math.sin(elapsed * speed + glow.phase);
      glow.graphic.setAlpha(0.55 + pulse * (glow.kind === 'lantern' ? 0.13 : 0.22));
    }
  };
  scene.events.on('update', update);
  scene.events.once('shutdown', () => {
    scene.events.off('update', update);
    objects.forEach(object => object.destroy());
  });
  update(0, 0);
  return { objects };
}
