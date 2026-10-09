// Void casts share the supplied Wisp bolt sheet; the Keeper also flashes a violet beam.
// These effects are visual only: the
// scheduled combat hit keeps its existing timing and does not wait for this flight.

// Find the sprite's chest or magical core in screen pixels, including perspective.
// A circle-only fallback uses the established 65-pixel lift above the unit's feet.
function projectilePoint(unit) {
  const image = unit.spriteVisual?.image;
  if (!image?.height) return { x: unit.x, y: unit.y - 65 };

  // Sprite coordinates are local to the unit container. The container's scale applies
  // perspective, so multiply the local offset before adding the projected foot point.
  // 0.45 places the effect slightly above the center of the full sprite cell.
  return {
    x: unit.x + (image.x + (0.5 - image.originX) * image.width * image.scaleX)
      * (unit.container?.scaleX ?? 1),
    y: unit.y + (image.y + (0.45 - image.originY) * image.height * image.scaleY)
      * (unit.container?.scaleY ?? 1)
  };
}

// Start a bolt when this enemy has accepted projectile metadata and loaded textures.
export function createVoidProjectile(scene, attacker, target, kind = 'bolt') {
  const effect = attacker.spriteVisual?.definition.projectile;
  if (!effect || !scene.textures.exists(effect.key)) return false;

  // Screen y points downward. atan2 gives the angle from the east-facing artwork to
  // the target in radians, so the same sheet can fly in any battlefield direction.
  const from = projectilePoint(attacker);
  const to = projectilePoint(target);
  const image = kind === 'beam'
    ? scene.add.graphics().setDepth(4000)
    : scene.add.image(from.x, from.y, effect.key, 0)
      .setOrigin(0.5).setScale(0.32).setDepth(4000)
      .setRotation(Math.atan2(to.y - from.y, to.x - from.x));
  if (kind !== 'beam') scene.textures.get(effect.key).setFilter(1);

  // Phaser destroys scene display objects on shutdown. Clear our extra references
  // too, so a restarted battle cannot retain an old flight or its target positions.
  if (!scene.voidProjectiles) {
    scene.voidProjectiles = [];
    scene.events.once('shutdown', () => {
      for (const bolt of scene.voidProjectiles ?? []) bolt.image.destroy();
      scene.voidProjectiles = null;
    });
  }

  // Fit every bolt pose into the established 180 ms flight. The standalone sheet's
  // frame interval is slower for previewing; combat should show its entire loop here.
  const duration = 180;
  scene.voidProjectiles.push({ image, effect, kind, from, to, elapsed: 0,
    duration, frameMs: duration / effect.columns });
  return true;
}

// Use combat frame time in milliseconds so Pause freezes both flight and frame.
export function updateVoidProjectiles(scene, delta, replaying = false) {
  if (!scene.voidProjectiles) return;
  const remaining = [];
  for (const bolt of scene.voidProjectiles) {

    // Historical background effects are discarded when real combat catches up.
    if (replaying || scene.battleOver || !bolt.image.active) {
      bolt.image.destroy();
      continue;
    }
    if (!scene.combatPaused) bolt.elapsed += Math.max(0, delta);
    if (bolt.elapsed >= bolt.duration) {
      bolt.image.destroy();
      continue;
    }

    // Linear interpolation moves only the image between captured screen positions.
    // Its complete accepted sequence plays once during this short flight.
    const progress = bolt.elapsed / bolt.duration;
    if (bolt.kind === 'beam') {

      // The sheet shows the Keeper casting. This brief line connects its core to the
      // chosen target and narrows as it fades. It never adds beam-area damage or hits.
      bolt.image.clear()
        .lineStyle(12 * (1 - progress * 0.7), 0xa855f7, 1 - progress * 0.7)
        .lineBetween(bolt.from.x, bolt.from.y, bolt.to.x, bolt.to.y)
        .lineStyle(3, 0xf5dcff, 1 - progress)
        .lineBetween(bolt.from.x, bolt.from.y, bolt.to.x, bolt.to.y);
      remaining.push(bolt);
      continue;
    }
    const frame = Math.min(bolt.effect.columns - 1, Math.floor(bolt.elapsed / bolt.frameMs));
    bolt.image.setTexture(bolt.effect.key, frame).setPosition(
      bolt.from.x + (bolt.to.x - bolt.from.x) * progress,
      bolt.from.y + (bolt.to.y - bolt.from.y) * progress
    );
    remaining.push(bolt);
  }
  scene.voidProjectiles = remaining;
}
