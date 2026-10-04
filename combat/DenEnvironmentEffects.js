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
  const waterfalls = config.waterfalls ?? [];
  const waterSurfaces = config.waterSurfaces ?? [];
  let elapsed = 0;
  let waterFrame = -1;

  const water = waterfalls.length > 0 || waterSurfaces.length > 0
    ? scene.add.graphics().setPosition(transform.x, transform.y)
      .setScale(transform.scale).setDepth(-950)
    : null;
  if (water) objects.push(water);

  for (const [kind, sources] of [
    ['lantern', config.lanterns ?? []],
    ['candle', config.candles ?? []],
    ['fungus', config.fungi ?? []]
  ]) {
    for (const [index, source] of sources.entries()) {
      const color = kind === 'fungus' ? 0x83ffd6 : 0xffba59;
      const graphic = drawGlow(scene, source.radius, color)
        .setPosition(transform.x + source.x * transform.scale,
          transform.y + source.y * transform.scale)
        .setScale(transform.scale).setDepth(kind === 'fungus' ? 4310 : -960);
      objects.push(graphic);
      glows.push({ graphic, kind, phase: index * 1.67 + (kind === 'candle' ? 0.73 : 0.31),
        speed: kind === 'fungus' ? 0.69 + index * 0.13 : 6.1 + index * 0.83
          + (kind === 'candle' ? 2.4 : 0) });
    }
  }

  const update = (_time, delta) => {
    if (scene.combatPaused) return;
    elapsed += Math.min(delta, 100) / 1000;
    for (const glow of glows) {
      const pulse = Math.sin(elapsed * glow.speed + glow.phase);
      const flutter = glow.kind === 'fungus' ? 0
        : Math.sin(elapsed * (glow.speed * 1.81) + glow.phase * 2.3) * 0.07;
      const strength = glow.kind === 'fungus' ? 0.24
        : glow.kind === 'candle' ? 0.22 : 0.16;
      glow.graphic.setAlpha(0.57 + pulse * strength + flutter);
    }
    const frame = Math.floor(elapsed * 15);
    if (water && frame !== waterFrame) {
      waterFrame = frame;
      water.clear();
      for (const [fallIndex, fall] of waterfalls.entries()) {
        const streams = Math.max(5, Math.floor(fall.width / 4));
        for (let index = 0; index < streams; index += 1) {
          const x = fall.x + 2 + ((index * 11 + fallIndex * 3) % (fall.width - 4));
          const length = 9 + (index % 4) * 4;
          const travel = fall.height + length;
          const offset = (index * 0.173 + fallIndex * 0.29) % 1;
          const y = fall.y + ((elapsed * (fall.speed + index % 3 * 5) + offset * travel) % travel) - length;
          const top = Math.max(fall.y, y);
          const bottom = Math.min(fall.y + fall.height, y + length);
          if (bottom <= top) continue;
          water.fillStyle(index % 3 === 0 ? 0xd3f4ff : 0x82c8e5, index % 3 === 0 ? 0.32 : 0.18);
          water.fillRect(x, top, index % 4 === 0 ? 3 : 2, bottom - top);
        }
        for (let index = 0; index < 5; index += 1) {
          const phase = elapsed * 3.5 + index * 1.7 + fallIndex;
          const x = fall.x + fall.width * (0.14 + index * 0.18) + Math.sin(phase) * 3;
          const y = fall.y + fall.height - 3 + Math.sin(phase * 1.4) * 2;
          water.fillStyle(0xc9f2ff, 0.14 + (Math.sin(phase) + 1) * 0.09);
          water.fillRect(x, y, 3, 2);
        }
      }
      for (const [surfaceIndex, surface] of waterSurfaces.entries()) {
        for (let index = 0; index < 7; index += 1) {
          const width = 8 + index % 4 * 4;
          const range = surface.width - width - 6;
          const x = surface.x + 3 + ((elapsed * surface.speed
            + index * 23 + surfaceIndex * 17) % range);
          const y = surface.y + 3 + ((index * 11 + surfaceIndex * 5) % (surface.height - 6));
          const shimmer = Math.sin(elapsed * (1.7 + index * 0.13) + index * 1.3);
          water.fillStyle(index % 3 === 0 ? 0xd6f6ff : 0x8ad2e8, 0.12 + (shimmer + 1) * 0.06);
          water.fillRect(x, y, width, index % 3 === 0 ? 2 : 1);
        }
        for (let index = 0; index < 3; index += 1) {
          const progress = (elapsed * 0.43 + index * 0.37 + surfaceIndex * 0.19) % 1;
          const spread = 3 + progress * 11;
          const center = surface.x + surface.width * (0.28 + index * 0.22);
          const y = surface.y + surface.height * (0.4 + index * 0.18);
          water.fillStyle(0xc9f2ff, Math.sin(Math.PI * progress) * 0.2);
          water.fillRect(center - spread, y, 5, 1);
          water.fillRect(center + spread - 5, y, 5, 1);
        }
      }
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
