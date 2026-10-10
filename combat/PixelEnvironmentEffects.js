// These are cosmetic environment effects. Region coordinates belong to the original
// artwork and use the same offset + coordinate * scale transform as the floor. Timers and
// tweens animate the display; cleanup removes them on scene shutdown. Cosmetic random
// choices must stay separate from the battle's saved random stream.

function drawCrystalGlow(scene, color, size) {
  const graphic = scene.add.graphics();
  graphic.fillStyle(color, 0.07);
  graphic.fillRect(-size * 13, -size * 7, size * 26, size * 14);
  graphic.fillStyle(color, 0.16);
  graphic.fillRect(-size * 8, -size * 4, size * 16, size * 8);
  graphic.fillStyle(color, 0.5);
  graphic.fillRect(-size * 5, -size, size * 10, size * 2);

  graphic.fillRect(-size, -size * 5, size * 2, size * 10);
  graphic.fillStyle(0xffffff, 0.9);
  graphic.fillRect(-size, -size, size * 2, size * 2);

  return graphic;
}

// Draw the tiny bubble texture used by the cave pool particle effects.
function drawBubble(scene, color, size) {
  const graphic = scene.add.graphics();
  graphic.fillStyle(color, 0.9);
  graphic.fillRect(0, 0, size * 3, size);
  graphic.fillRect(0, size, size, size * 2);
  graphic.fillRect(size * 2, size, size, size * 2);
  graphic.fillRect(0, size * 3, size * 3, size);
  graphic.fillStyle(0xffffff, 0.75);

  graphic.fillRect(size, size, size, size);
  return graphic;
}

// Draw a low, wide ripple texture for the cave pool surface.
function drawRipple(scene, color, width) {
  const graphic = scene.add.graphics();
  graphic.fillStyle(color, 0.75);
  graphic.fillRect(-width / 2, 0, width, 3);
  graphic.fillRect(-width / 2 + 6, -4, width - 12, 2);
  graphic.fillStyle(0xeaff9f, 0.65);
  graphic.fillRect(-width / 4, -7, width / 2, 2);

  return graphic;
}

// Draw the small water-current texture used by the localized pool effect.
function drawCurrent(scene, color, width) {
  const graphic = scene.add.graphics();
  graphic.fillStyle(0xe9ff8f, 0.75);
  graphic.fillRect(-width / 2, 0, width * 0.42, 3);
  graphic.fillRect(width * 0.02, -4, width * 0.38, 3);
  graphic.fillStyle(color, 0.8);
  graphic.fillRect(-width * 0.2, 5, width * 0.5, 3);

  return graphic;
}

// Draw a localized slime patch over the configured rock surface.
function drawSlime(scene, color, width, height) {
  const graphic = scene.add.graphics();
  graphic.fillStyle(0x172716, 0.85);
  graphic.fillRect(-width * 0.45, 0, width * 0.65, 5);
  graphic.fillRect(-width * 0.32, 4, width * 0.72, 7);
  graphic.fillRect(-width * 0.17, 9, width * 0.38, 4);
  graphic.fillRect(-width * 0.13, 12, width * 0.23, height * 0.72);
  graphic.fillRect(-width * 0.08, 11 + height * 0.68, width * 0.13, 3);

  graphic.fillStyle(color, 0.82);
  graphic.fillRect(-width * 0.42, 1, width * 0.55, 3);
  graphic.fillRect(-width * 0.27, 4, width * 0.59, 5);
  graphic.fillRect(-width * 0.12, 9, width * 0.28, 4);
  graphic.fillRect(-width * 0.09, 12, width * 0.16, height * 0.69);
  graphic.fillStyle(0xb7d96d, 0.52);
  graphic.fillRect(-width * 0.23, 4, width * 0.2, 2);

  graphic.fillRect(-width * 0.06, 13, 2, height * 0.38);
  return graphic;
}

// Draw the mushroom glow texture used by its gentle ambient pulse.
function drawMushroomCap(scene, width) {
  const graphic = scene.add.graphics();
  graphic.fillStyle(0x271634);
  graphic.fillRect(-width / 2 - 2, -1, width + 4, 7);
  graphic.fillRect(-width * 0.38, -7, width * 0.76, 7);
  graphic.fillStyle(0xa64bc3);
  graphic.fillRect(-width / 2, 0, width, 4);
  graphic.fillRect(-width * 0.36, -6, width * 0.72, 6);

  graphic.fillStyle(0xe88df0);
  graphic.fillRect(-width * 0.22, -5, width * 0.4, 3);
  graphic.fillStyle(0xf5b7fa);
  graphic.fillRect(-width * 0.1, -6, width * 0.16, 2);

  return graphic;
}

// Draw one small spore texture for the mushroom particle effect.
function drawSpore(scene, color, size) {
  const graphic = scene.add.graphics();
  graphic.fillStyle(color);
  graphic.fillRect(0, 0, size, size);
  graphic.fillStyle(0xffffff, 0.65);

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  graphic.fillRect(0, 0, Math.max(1, size - 1), 1);
  return graphic;
}

// Create localized cave glows, pools, slime and mushroom ambience, returning their
// cleanup.
export function createPixelEnvironmentEffects(scene, config, transform) {
  if (!config) return null;
  const objects = [];
  const crystals = [];
  const bubbles = [];
  const ripples = [];
  const currents = [];
  const slimes = [];

  const mushrooms = [];
  let elapsed = 0;
  const position = (x, y) => ({ x: transform.x + x * transform.scale,
    y: transform.y + y * transform.scale });
  const add = (graphic, x, y, depth) => {
    const p = position(x, y);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    graphic.setPosition(p.x, p.y).setScale(transform.scale).setDepth(depth);
    objects.push(graphic);
    return graphic;
  };

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  for (const [index, crystal] of (config.crystals ?? []).entries()) {
    const graphic = add(drawCrystalGlow(scene, crystal.color, crystal.size ?? 2),
      crystal.x, crystal.y, -970);
    crystals.push({ graphic, phase: index * 1.9, speed: crystal.speed ?? 1.4 });
  }

  for (const [poolIndex, pool] of (config.pools ?? []).entries()) {
    const color = pool.color ?? 0xbaff4a;
    for (let index = 0; index < (pool.bubbles ?? 3); index += 1) {

      // The condition before ? chooses the first value when true and the value after :
      // when false. % gives the remainder. With a nonnegative index and positive list
      // length, it wraps the index back to the start of the list.
      const size = index % 3 === 0 ? 2 : 1;
      const graphic = add(drawBubble(scene, color, size), pool.x, pool.y, -965);
      bubbles.push({ graphic, x: pool.x + pool.width * (0.13 + 0.74 * ((index * 0.37 + poolIndex * 0.21) % 1)),
        y: pool.y + (index % 2) * 3, phase: index * 0.31 + poolIndex * 0.17,
        period: 1.8 + (index % 3) * 0.48, rise: 12 + (index % 3) * 6 });
    }

    for (let index = 0; index < 3; index += 1) {
      const x = pool.x + pool.width * (0.22 + index * 0.27);
      const y = pool.y + 3 + index % 2 * 4;

      // Math.min chooses the smallest value; pairing it with Math.max can keep a result
      // inside both a lower and an upper bound.
      const ripple = add(drawRipple(scene, color, Math.min(pool.width * 0.33, 46)), x, y, -966);
      ripples.push({ graphic: ripple, phase: poolIndex * 0.71 + index * 0.39 });
      const current = add(drawCurrent(scene, color, Math.min(pool.width * 0.28, 48)), x, y + 5, -967);
      currents.push({ graphic: current, x, y: y + 5, phase: poolIndex * 1.1 + index * 1.7 });
    }
  }

  for (const [index, slime] of (config.rockSlime ?? []).entries()) {
    const graphic = add(drawSlime(scene, slime.color ?? 0x96e832, slime.width, slime.height),
      slime.x, slime.y, slime.depth ?? -960);
    slimes.push({ graphic, phase: index * 1.4, speed: slime.speed ?? 1.2 });
  }

  for (const [index, mushroom] of (config.mushrooms ?? []).entries()) {
    const graphic = add(drawMushroomCap(scene, mushroom.width), mushroom.x, mushroom.y, -958);
    const spores = [];
    for (let particle = 0; particle < 6; particle += 1) {
      const spore = add(drawSpore(scene, particle % 2 ? 0xf7c8ff : 0xb365d9, particle % 3 ? 2 : 3),
        mushroom.x, mushroom.y, -957);
      spores.push(spore);
    }

    mushrooms.push({ graphic, spores, x: mushroom.x, y: mushroom.y,
      phase: index * 2.3, period: mushroom.period ?? 7.2 });
  }

  const update = (_time, delta) => {
    if (scene.combatPaused) return;

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    elapsed += Math.min(delta, 100) / 1000;
    for (const crystal of crystals) {

      // Angles are radians. cos(angle) gives the horizontal part of a circle; sin(angle)
      // gives the vertical part. Multiplying by a radius turns those fractions into
      // offsets.
      const pulse = Math.max(0, Math.sin(elapsed * crystal.speed + crystal.phase));
      crystal.graphic.setAlpha(0.3 + pulse * pulse * 0.68);
    }

    for (const bubble of bubbles) {

      // % gives the remainder. With a nonnegative index and positive list length, it wraps
      // the index back to the start of the list.
      const progress = (elapsed / bubble.period + bubble.phase) % 1;
      const p = position(bubble.x + Math.sin(progress * 5 + bubble.phase) * 3,
        bubble.y - progress * bubble.rise);
      bubble.graphic.setPosition(p.x, p.y);
      bubble.graphic.setAlpha(Math.sin(Math.PI * progress) * 0.85);
    }

    for (const ripple of ripples) {
      const progress = (elapsed * 0.55 + ripple.phase) % 1;
      ripple.graphic.setScale(transform.scale * (0.55 + progress * 0.85), transform.scale);
      ripple.graphic.setAlpha(Math.sin(Math.PI * progress) * 0.68);
    }

    for (const current of currents) {
      const drift = Math.sin(elapsed * 2.3 + current.phase);
      const p = position(current.x + drift * 8, current.y + Math.sin(elapsed * 1.7 + current.phase) * 2);
      current.graphic.setPosition(p.x, p.y);
      current.graphic.setAlpha(0.28 + (drift + 1) * 0.18);
    }

    for (const slime of slimes) {
      const pulse = Math.sin(elapsed * slime.speed + slime.phase);
      slime.graphic.setScale(transform.scale * (1 + pulse * 0.07),
        transform.scale * (1 + pulse * 0.18));
      slime.graphic.setAlpha(0.52 + (pulse + 1) * 0.14);
    }

    for (const mushroom of mushrooms) {
      const cycle = (elapsed + mushroom.phase) % mushroom.period;

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const spasm = cycle < 0.8 ? Math.sin(cycle / 0.8 * Math.PI) ** 2 : 0;
      mushroom.graphic.setScale(transform.scale * (1 - spasm * 0.18),
        transform.scale * (1 + spasm * 0.36));
      mushroom.graphic.setY(position(mushroom.x, mushroom.y - spasm * 3).y);
      mushroom.spores.forEach((spore, index) => {
        const progress = (cycle - 0.17 - index * 0.065) / 1.65;
        if (progress < 0 || progress > 1) {
          spore.setAlpha(0);
          return;
        }

        // Angles are radians. cos(angle) gives the horizontal part of a circle; sin(angle)
        // gives the vertical part. Multiplying by a radius turns those fractions into
        // offsets. % gives the remainder. With a nonnegative index and positive list
        // length, it wraps the index back to the start of the list.
        const p = position(mushroom.x + (index - 2.5) * 7 + Math.sin(progress * 8 + index) * 5,
          mushroom.y - 10 - progress * (30 + index % 3 * 8));
        spore.setPosition(p.x, p.y).setAlpha(Math.sin(Math.PI * progress) * 0.85);
      });
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
