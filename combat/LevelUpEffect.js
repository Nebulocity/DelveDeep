// Level-up feedback is cosmetic: roster progression still owns XP and saved levels.
import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { visibleUnitBounds } from './AbilityEffect.js';

export const LEVEL_UP_DURATION_MS = 4000;
const FADE_MS = 800;

// Release both drawings when playback ends, during catch-up, or on scene shutdown.
export function clearLevelUpEffects(scene) {
  for (const effect of scene.levelUpEffects ?? []) {
    effect.label.destroy();
    effect.sparkles.destroy();
  }
  scene.levelUpEffects = [];
}

// Keep one readable celebration per character, even if a reward grants several levels.
export function createLevelUpEffect(scene, unit) {
  if (!unit || scene.idleSimulating || scene.game.backgroundProgress?.isReplaying) return false;
  scene.levelUpEffects ??= [];
  const existing = scene.levelUpEffects.find(effect => effect.unit === unit);
  if (existing) {
    existing.startedAt = scene.time.now;
    return true;
  }

  // Canvas coordinates use the same logical pixels as combat text. Depth 4201 puts
  // the label above damage numbers while keeping banners and modal controls in front.
  const label = scene.add.text(0, 0, 'LEVEL UP!', {
    fontFamily: UI_FONT_FAMILIES.sans,
    fontSize: fontPx('display51'),
    fontStyle: UI_FONT_WEIGHTS.bold,
    color: '#ffd45a',
    stroke: '#4a2908',
    strokeThickness: 6,
    shadow: { offsetX: 0, offsetY: 0, color: '#d88b16', blur: 10, fill: true }
  }).setOrigin(0.5).setDepth(4201).setName('level-up-text');
  const sparkles = scene.add.graphics().setDepth(4202).setName('level-up-sparkles');
  scene.levelUpEffects.push({ unit, label, sparkles, startedAt: scene.time.now });
  updateLevelUpEffects(scene);
  return true;
}

// Follow the idle silhouette rather than transparent sprite padding. All animation
// uses combat milliseconds, so Pause freezes the rise, twinkles, and final fade.
export function updateLevelUpEffects(scene) {
  if (scene.idleSimulating || scene.game.backgroundProgress?.isReplaying) {
    clearLevelUpEffects(scene);
    return;
  }
  const remaining = [];
  for (const effect of scene.levelUpEffects ?? []) {
    const elapsed = Math.max(0, scene.time.now - effect.startedAt);
    if (elapsed >= LEVEL_UP_DURATION_MS || effect.unit.container?.active === false) {
      effect.label.destroy();
      effect.sparkles.destroy();
      continue;
    }

    // Hold full brightness for 3.2 seconds, then fade over the final 800 ms.
    // The 36-pixel rise is deliberately small so the words stay close to their owner.
    const alpha = Math.min(1, (LEVEL_UP_DURATION_MS - elapsed) / FADE_MS);
    const bounds = visibleUnitBounds(scene, effect.unit);
    const halfWidth = effect.label.width / 2 + 26;
    const x = Math.max(halfWidth, Math.min(scene.scale.width - halfWidth, (bounds.left + bounds.right) / 2));
    // The walkable floor begins much lower than the usable screen. Leave room above
    // that floor for feedback, but keep stars below the centered tactics controls.
    const minY = (scene.battleLayout?.buttonY ?? 178) + (scene.battleLayout?.buttonHeight ?? 80) / 2 + 48;
    let y = Math.max(minY, bounds.top - 42 - 36 * elapsed / LEVEL_UP_DURATION_MS);

    // Neighbors can level together in a tight formation. Raise overlapping labels
    // into another 90-pixel row rather than shrinking the phone-readable lettering.
    let overlap;
    while ((overlap = remaining.find(other =>
      Math.abs(x - other.label.x) < (effect.label.width + other.label.width) / 2 + 20
      && Math.abs(y - other.label.y) < 90)) && overlap.label.y - 90 >= minY) {
      y = overlap.label.y - 90;
    }
    effect.label.setPosition(x, y).setAlpha(alpha);
    effect.sparkles.clear().setAlpha(alpha);

    // Eight small four-point stars twinkle at staggered phases around the words.
    // Fixed phases avoid consuming the seeded random sequence used by combat rewards.
    for (let index = 0; index < 8; index++) {
      const phase = elapsed / 700 + index * 0.83;
      const brightness = (Math.sin(phase * Math.PI * 2) + 1) / 2;
      const angle = index * Math.PI / 4;
      const sx = x + Math.cos(angle) * halfWidth;
      const sy = y + Math.sin(angle) * 34 - Math.sin(phase) * 5;
      const radius = 3 + brightness * 5;
      effect.sparkles.fillStyle(index % 2 ? 0xfff3bc : 0xffc83d, 0.25 + brightness * 0.75);
      effect.sparkles.fillPoints([
        { x: sx, y: sy - radius }, { x: sx + 2, y: sy - 2 },
        { x: sx + radius, y: sy }, { x: sx + 2, y: sy + 2 },
        { x: sx, y: sy + radius }, { x: sx - 2, y: sy + 2 },
        { x: sx - radius, y: sy }, { x: sx - 2, y: sy - 2 }
      ], true);
    }
    remaining.push(effect);
  }
  scene.levelUpEffects = remaining;
}
