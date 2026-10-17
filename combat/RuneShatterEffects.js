// Split the visible rune frame at its saved position. Fragments are cosmetic and
// use combat elapsed time, so they cannot change recipients or gameplay effects.
export function shatterRuneEffect(scene, effect) {
  if (scene.idleSimulating || scene.game?.backgroundProgress?.isReplaying || scene.battleOver) return;
  const fragments = [];
  for (const { clip, image } of effect.pieces) {

    // Crops preserve their offsets inside the frame, so the nine pieces initially
    // reconstruct the gemstone. Travel distances are art pixels scaled like the rune.
    for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
      const left = Math.floor(column * clip.width / 3);
      const top = Math.floor(row * clip.height / 3);
      const width = Math.floor((column + 1) * clip.width / 3) - left;
      const height = Math.floor((row + 1) * clip.height / 3) - top;
      const shard = scene.add.image(image.x, image.y, clip.key, image.frame.name)
        .setOrigin(0).setScale(image.scaleX, image.scaleY)
        .setCrop(left, top, width, height).setDepth(image.depth).setAlpha(image.alpha);
      fragments.push({ image: shard, x: image.x, y: image.y, alpha: image.alpha,
        dx: (column - 1) * 65 * image.scaleX,
        dy: (row - 1) * 55 * image.scaleY, drop: 85 * image.scaleY });
    }
    image.destroy();
  }
  effect.zone?.destroy();
  (scene.runeShatterEffects ??= []).push({ elapsed: 0, fragments });
}

export function updateRuneShatterEffects(scene, delta) {
  const remaining = [];
  for (const effect of scene.runeShatterEffects ?? []) {
    if (!scene.combatPaused) effect.elapsed += Math.max(0, delta);
    const progress = Math.min(1, effect.elapsed / 400);
    if (progress >= 1) {
      for (const fragment of effect.fragments) fragment.image.destroy();
      continue;
    }
    for (const fragment of effect.fragments) {
      fragment.image.setPosition(fragment.x + fragment.dx * progress,
        fragment.y + fragment.dy * progress + fragment.drop * progress * progress)
        .setAlpha(fragment.alpha * (1 - progress));
    }
    remaining.push(effect);
  }
  scene.runeShatterEffects = remaining;
}

export function clearRuneShatterEffects(scene) {
  for (const effect of scene.runeShatterEffects ?? []) {
    for (const fragment of effect.fragments) fragment.image.destroy();
  }
  scene.runeShatterEffects = [];
}
