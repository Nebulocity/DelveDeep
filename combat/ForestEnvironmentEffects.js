function drawFireGlow(scene, radius) {
  const glow = scene.add.graphics();
  glow.fillStyle(0xff9b37, 0.055);
  glow.fillEllipse(0, 0, radius * 2.4, radius * 1.2);
  glow.fillStyle(0xffb24d, 0.12);
  glow.fillEllipse(0, 0, radius * 1.4, radius * 0.7);
  glow.fillStyle(0xffd47a, 0.17);
  glow.fillEllipse(0, 0, radius * 0.65, radius * 0.4);
  return glow;
}

function drawEmber(scene, size) {
  const ember = scene.add.graphics();
  ember.fillStyle(0xffa345);
  ember.fillRect(0, 0, size, size);
  ember.fillStyle(0xffe19a);
  ember.fillRect(0, 0, Math.max(1, size - 1), 1);
  return ember;
}

export function createForestEnvironmentEffects(scene, config, transform) {
  if (!config) return null;
  const objects = [];
  const fires = [];
  const embers = [];
  let elapsed = 0;
  const position = (x, y) => ({ x: transform.x + x * transform.scale,
    y: transform.y + y * transform.scale });

  for (const [index, fire] of (config.fires ?? []).entries()) {
    const p = position(fire.x, fire.y);
    const graphic = drawFireGlow(scene, fire.radius).setPosition(p.x, p.y)
      .setScale(transform.scale).setDepth(-960);
    objects.push(graphic);
    fires.push({ graphic, strength: fire.strength ?? 1, phase: index * 1.73 });
  }

  for (const [sourceIndex, source] of (config.embers ?? []).entries()) {
    for (let index = 0; index < source.count; index += 1) {
      const graphic = drawEmber(scene, index % 3 === 0 ? 3 : 2)
        .setScale(transform.scale).setDepth(-950);
      objects.push(graphic);
      embers.push({ graphic, source, phase: (index * 0.37 + sourceIndex * 0.23) % 1,
        sway: index * 1.9 + sourceIndex, speed: 0.55 + index % 4 * 0.11 });
    }
  }

  const update = (_time, delta) => {
    if (scene.combatPaused) return;
    elapsed += Math.min(delta, 100) / 1000;
    for (const fire of fires) {
      const flicker = Math.sin(elapsed * 8.3 + fire.phase) * 0.12
        + Math.sin(elapsed * 13.7 + fire.phase * 2) * 0.06;
      fire.graphic.setAlpha((0.55 + flicker) * fire.strength);
    }
    for (const ember of embers) {
      const progress = (elapsed * ember.speed + ember.phase) % 1;
      const x = ember.source.x + Math.sin(progress * 6 + ember.sway) * ember.source.spread * progress;
      const y = ember.source.y - progress * ember.source.rise;
      const p = position(x, y);
      ember.graphic.setPosition(p.x, p.y).setAlpha(Math.sin(Math.PI * progress) * 0.8);
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
