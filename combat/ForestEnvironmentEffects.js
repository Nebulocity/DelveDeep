// These are cosmetic environment effects. Region coordinates belong to the original
// artwork and use the same offset + coordinate * scale transform as the floor. Timers and
// tweens animate the display; cleanup removes them on scene shutdown. Cosmetic random
// choices must stay separate from the battle's saved random stream.

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

// Draw one tiny ember texture for the forest fire particles.
function drawEmber(scene, size) {
  const ember = scene.add.graphics();
  ember.fillStyle(0xffa345);
  ember.fillRect(0, 0, size, size);
  ember.fillStyle(0xffe19a);

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  ember.fillRect(0, 0, Math.max(1, size - 1), 1);
  return ember;
}

// Create local forest firelight and embers using artwork coordinates and shared cleanup.
export function createForestEnvironmentEffects(scene, config, transform) {
  if (!config) return null;
  const objects = [];
  const fires = [];
  const embers = [];
  let elapsed = 0;
  const position = (x, y) => ({ x: transform.x + x * transform.scale,
    y: transform.y + y * transform.scale });

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  for (const [index, fire] of (config.fires ?? []).entries()) {
    const p = position(fire.x, fire.y);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const graphic = drawFireGlow(scene, fire.radius).setPosition(p.x, p.y)
      .setScale(transform.scale).setDepth(-960);
    objects.push(graphic);
    fires.push({ graphic, strength: fire.strength ?? 1, phase: index * 1.73 });
  }

  for (const [sourceIndex, source] of (config.embers ?? []).entries()) {
    for (let index = 0; index < source.count; index += 1) {

      // The condition before ? chooses the first value when true and the value after :
      // when false. % gives the remainder. With a nonnegative index and positive list
      // length, it wraps the index back to the start of the list.
      const graphic = drawEmber(scene, index % 3 === 0 ? 3 : 2)
        .setScale(transform.scale).setDepth(-950);
      objects.push(graphic);
      embers.push({ graphic, source, phase: (index * 0.37 + sourceIndex * 0.23) % 1,
        sway: index * 1.9 + sourceIndex, speed: 0.55 + index % 4 * 0.11 });
    }
  }

  const update = (_time, delta) => {
    if (scene.combatPaused) return;

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    elapsed += Math.min(delta, 100) / 1000;
    for (const fire of fires) {

      // Angles are radians. cos(angle) gives the horizontal part of a circle; sin(angle)
      // gives the vertical part. Multiplying by a radius turns those fractions into
      // offsets.
      const flicker = Math.sin(elapsed * 8.3 + fire.phase) * 0.12
        + Math.sin(elapsed * 13.7 + fire.phase * 2) * 0.06;
      fire.graphic.setAlpha((0.55 + flicker) * fire.strength);
    }

    for (const ember of embers) {

      // % gives the remainder. With a nonnegative index and positive list length, it wraps
      // the index back to the start of the list.
      const progress = (elapsed * ember.speed + ember.phase) % 1;
      const x = ember.source.x + Math.sin(progress * 6 + ember.sway) * ember.source.spread * progress;
      const y = ember.source.y - progress * ember.source.rise;
      const p = position(x, y);
      ember.graphic.setPosition(p.x, p.y).setAlpha(Math.sin(Math.PI * progress) * 0.8);
    }
  };

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  scene.events.on('update', update);

  // once registers a callback that removes itself after the first matching event.
  scene.events.once('shutdown', () => {
    scene.events.off('update', update);
    objects.forEach(object => object.destroy());
  });
  update(0, 0);

  return { objects };
}
