// Cosmetic impact artwork never consumes the saved combat random sequence.
const DUST_DURATION_MS = 1400;
const RUMBLE_DURATION_MS = 320;

// Shutdown and historical replay may release artwork immediately.
export function clearBossLandingEffects(scene) {
  for (const effect of scene.bossLandingEffects ?? []) effect.dust.destroy();
  scene.bossLandingEffects = [];
  const rumble = scene.bossLandingRumble;
  if (rumble) scene.cameras.main.setScroll(rumble.x, rumble.y);
  scene.bossLandingRumble = null;
}

// Dust begins at the boss's feet, with a brief, low-amplitude screen rumble.
export function createBossLandingEffect(scene, enemy) {
  if (scene.idleSimulating || scene.game.backgroundProgress?.isReplaying) return;
  const camera = scene.cameras.main;
  const dust = scene.add.graphics().setDepth(enemy.container.depth + 1).setName('boss-landing-dust');
  scene.bossLandingEffects ??= [];
  scene.bossLandingEffects.push({ dust, x: enemy.x, y: enemy.y,
    scale: scene.battlefield.getUnitScale(enemy.arenaY), startedAt: scene.time.now });

  // Retain the original camera scroll if two bosses happen to land together.
  scene.bossLandingRumble ??= { x: camera.scrollX, y: camera.scrollY };
  scene.bossLandingRumble.startedAt = scene.time.now;
  updateBossLandingEffects(scene);
}

// Combat milliseconds control outward drift, upward lift, fade and camera movement.
// Pause freezes this clock. Drawn ellipses need no downloaded textures or service keys.
export function updateBossLandingEffects(scene) {
  if (scene.idleSimulating || scene.game.backgroundProgress?.isReplaying) {
    clearBossLandingEffects(scene);
    return;
  }
  const remaining = [];
  for (const effect of scene.bossLandingEffects ?? []) {
    const elapsed = Math.max(0, scene.time.now - effect.startedAt);
    if (elapsed >= DUST_DURATION_MS) {
      effect.dust.destroy();
      continue;
    }
    const progress = elapsed / DUST_DURATION_MS;
    const fade = Math.min(1, (DUST_DURATION_MS - elapsed) / 700);
    effect.dust.clear();

    // Twelve translucent puffs spread horizontally across the perspective floor and
    // rise gently. Alternating earth colors keep the boss silhouette easy to read.
    for (let index = 0; index < 12; index++) {
      const angle = index * Math.PI * 2 / 12;
      const distance = (16 + 115 * Math.sqrt(progress)) * effect.scale;
      const x = effect.x + Math.cos(angle) * distance;
      const y = effect.y + Math.sin(angle) * distance * 0.22 - progress * (22 + index % 3 * 8);
      const radius = (10 + progress * 15 + index % 3 * 3) * effect.scale;
      effect.dust.fillStyle(index % 2 ? 0xb7a184 : 0x887660, 0.24 * fade);
      effect.dust.fillEllipse(x, y, radius * 2, radius);
    }
    remaining.push(effect);
  }
  scene.bossLandingEffects = remaining;
  const rumble = scene.bossLandingRumble;
  if (!rumble) return;
  const elapsed = Math.max(0, scene.time.now - rumble.startedAt);
  const strength = Math.max(0, 1 - elapsed / RUMBLE_DURATION_MS) * 4;
  scene.cameras.main.setScroll(rumble.x + Math.sin(elapsed * 0.095) * strength,
    rumble.y + Math.sin(elapsed * 0.13) * strength * 0.6);
  if (elapsed >= RUMBLE_DURATION_MS) scene.bossLandingRumble = null;
}
