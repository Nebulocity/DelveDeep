function position(transform, x, y) {
  return { x: transform.x + x * transform.scale,
    y: transform.y + y * transform.scale };
}

function createCloud(scene, width, height) {
  const graphic = scene.add.graphics();
  graphic.fillStyle(0x160d2b, 0.52);
  graphic.fillEllipse(0, 0, width, height);
  graphic.fillEllipse(-width * 0.27, height * 0.15, width * 0.7, height * 0.72);
  graphic.fillEllipse(width * 0.26, -height * 0.13, width * 0.61, height * 0.83);
  graphic.fillStyle(0x9940d6, 0.13);
  graphic.fillEllipse(0, height * 0.28, width * 0.8, height * 0.27);
  return graphic;
}

function createFlame(scene, size) {
  const graphic = scene.add.graphics();
  graphic.fillStyle(0x7021b8, 0.17);
  graphic.fillEllipse(0, -size * 0.45, size * 2.2, size * 2.5);
  graphic.fillStyle(0x4f119d, 0.85);
  graphic.fillTriangle(-size * 0.42, 0, 0, -size * 1.9, size * 0.38, 0);
  graphic.fillTriangle(-size * 0.65, 0, -size * 0.25, -size * 1.23, 0, 0);
  graphic.fillTriangle(0, 0, size * 0.3, -size * 1.42, size * 0.67, 0);
  graphic.fillStyle(0xb146f7, 0.88);
  graphic.fillTriangle(-size * 0.29, 0, size * 0.05, -size * 1.37, size * 0.31, 0);
  graphic.fillStyle(0xf0b6ff, 0.9);
  graphic.fillTriangle(-size * 0.11, 0, size * 0.08, -size * 0.71, size * 0.17, 0);
  return graphic;
}

function createSpark(scene, size) {
  const graphic = scene.add.graphics();
  graphic.fillStyle(0xc76bff, 0.86);
  graphic.fillRect(0, 0, size, size);
  graphic.fillStyle(0xf5d8ff, 0.85);
  graphic.fillRect(0, 0, Math.max(1, size - 1), 1);
  return graphic;
}

function drawBolt(graphic, bolt, seed) {
  graphic.clear();
  const steps = 8;
  const points = [];
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const offset = step === 0 || step === steps ? 0
      : Math.sin(seed * 19.3 + step * 8.7) * (12 + (step % 3) * 5);
    points.push({ x: bolt.startX + (bolt.endX - bolt.startX) * progress + offset,
      y: bolt.startY + (bolt.endY - bolt.startY) * progress });
  }
  for (const [width, color, alpha] of [[13, 0x8738d4, 0.23],
    [5, 0xc272ff, 0.8], [2, 0xf5dcff, 1]]) {
    graphic.lineStyle(width, color, alpha);
    graphic.beginPath();
    graphic.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) graphic.lineTo(point.x, point.y);
    graphic.strokePath();
  }
  const branch = points[4];
  graphic.lineStyle(3, 0xb863ff, 0.8);
  graphic.lineBetween(branch.x, branch.y, branch.x + Math.sin(seed * 7) * 39,
    branch.y + 46);
}

export function createVoidEnvironmentEffects(scene, config, transform) {
  if (!config) return null;
  const objects = [];
  const add = (graphic, x, y, depth) => {
    const p = position(transform, x, y);
    graphic.setPosition(p.x, p.y).setScale(transform.scale).setDepth(depth);
    objects.push(graphic);
    return graphic;
  };
  const portal = config.portal;
  const aura = scene.add.graphics();
  aura.fillStyle(0x9e36f4, 0.055);
  aura.fillEllipse(0, 0, portal.radiusX * 2.5, portal.radiusY * 2.5);
  aura.lineStyle(8, 0xba55ff, 0.22);
  aura.strokeEllipse(0, 0, portal.radiusX * 2.02, portal.radiusY * 2.02);
  add(aura, portal.x, portal.y, -984);

  const motes = Array.from({ length: portal.particles }, (_, index) => ({
    graphic: add(createSpark(scene, index % 5 === 0 ? 4 : 2), portal.x, portal.y, -970),
    phase: index / portal.particles * Math.PI * 2,
    orbit: 0.79 + (index % 4) * 0.065
  }));
  const clouds = config.clouds.map(cloud => {
    const dx = cloud.x - portal.x;
    const dy = cloud.y - portal.y;
    const orbit = Math.hypot(dx / 320, dy / 130);
    return { ...cloud, orbit, angle: Math.atan2(dy / 130, dx / 320),
      graphic: add(createCloud(scene, cloud.width, cloud.height),
        cloud.x, cloud.y, -968) };
  });
  const flames = config.flames.map((flame, index) => ({
    ...flame, phase: index * 1.61,
    graphic: add(createFlame(scene, flame.size), flame.x, flame.y, -950),
    embers: Array.from({ length: 4 }, (_, mote) =>
      add(createSpark(scene, mote % 2 ? 2 : 3), flame.x, flame.y, -947))
  }));
  const bolts = config.lightning.map((bolt, index) => ({
    ...bolt, index, cycle: -1,
    graphic: add(scene.add.graphics(), 0, 0, -940)
  }));
  let elapsed = 0;

  const update = (_time, delta) => {
    if (scene.combatPaused) return;
    elapsed += Math.min(delta, 100) / 1000;
    aura.setAlpha(0.62 + Math.sin(elapsed * 2.2) * 0.24);
    for (const mote of motes) {
      const angle = mote.phase + elapsed * (0.35 + mote.orbit * 0.2);
      const radius = mote.orbit + Math.sin(elapsed * 2.1 + mote.phase * 3) * 0.03;
      const p = position(transform, portal.x + Math.cos(angle) * portal.radiusX * radius,
        portal.y + Math.sin(angle) * portal.radiusY * radius);
      mote.graphic.setPosition(p.x, p.y)
        .setAlpha(0.3 + (Math.sin(elapsed * 4 + mote.phase * 7) + 1) * 0.31);
    }
    for (const cloud of clouds) {
      const angle = cloud.angle + elapsed * 0.14;
      const p = position(transform,
        portal.x + Math.cos(angle) * 320 * cloud.orbit,
        portal.y + Math.sin(angle) * 130 * cloud.orbit);
      cloud.graphic.setPosition(p.x, p.y)
        .setAlpha(0.47 + Math.sin(elapsed * 0.8 + cloud.phase) * 0.13);
    }
    for (const flame of flames) {
      const flicker = Math.sin(elapsed * 11 + flame.phase) * 0.11
        + Math.sin(elapsed * 17 + flame.phase * 2) * 0.06;
      flame.graphic.setScale(transform.scale * (1 + flicker * 0.4),
        transform.scale * (1 + flicker)).setAlpha(0.75 + flicker);
      flame.embers.forEach((ember, index) => {
        const progress = (elapsed * (0.6 + index * 0.09) + index * 0.27 + flame.phase) % 1;
        const p = position(transform,
          flame.x + Math.sin(progress * 7 + index * 2) * flame.size * 0.45,
          flame.y - progress * flame.size * 2.8);
        ember.setPosition(p.x, p.y).setAlpha(Math.sin(Math.PI * progress) * 0.83);
      });
    }
    for (const bolt of bolts) {
      const local = elapsed + bolt.index * 0.79;
      const cycle = Math.floor(local / 2.7);
      const flash = local % 2.7;
      if (cycle !== bolt.cycle) {
        bolt.cycle = cycle;
        drawBolt(bolt.graphic, bolt, cycle + bolt.index * 17);
      }
      bolt.graphic.setAlpha(flash < 0.09 ? 1 : flash < 0.16 ? 0.35 : 0);
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
