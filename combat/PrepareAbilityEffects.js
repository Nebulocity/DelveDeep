// Prepare art follows existing saved statuses without changing bonuses or saves.

import { shieldSphereScale } from '../data/shieldSphereEffects.js';

const FADE_MS = 400;
export const PREPARE_EFFECT_SHEETS = [
  { name: 'arcane-focus', abilityId: 'ability_v2_generic_magical_arcane_focus', width: 48, height: 48 },
  { name: 'quick-casting', abilityId: 'ability_v2_generic_magical_quick_casting', width: 48, height: 48 },
  { name: 'combat-footwork', abilityId: 'ability_v2_generic_physical_combat_footwork', width: 64, height: 32 },
  { name: 'ready-weapon', abilityId: 'ability_v2_generic_physical_ready_weapon', width: 48, height: 48 }
].map(sheet => ({ ...sheet, key: 'prepare-' + sheet.name,
  url: new URL(`../assets/effects/generic-prepare/${sheet.name}.png`, import.meta.url).href }));

// Each Oathwarden motif follows the saved record that actually grants its benefit.
export const OATHWARDEN_PREPARE_EFFECT_SHEETS = [
  { name: 'oath-of-the-supplicant', abilityId: 'ability_v2_oathwarden_oath_of_the_supplicant', width: 128, height: 112, originX: 64, originY: 80, fps: 20, oneShotMs: 1600 },
  { name: 'steadfast-focus', abilityId: 'ability_v2_oathwarden_steadfast_focus', width: 128, height: 128, fps: 20 },
  { name: 'vow-of-readiness', abilityId: 'ability_v2_oathwarden_vow_of_readiness', width: 96, height: 112, originX: 48, originY: 98, fps: 20 },
  { name: 'vow-of-retaliation', abilityId: 'ability_v2_oathwarden_vow_of_retaliation', width: 96, height: 96, fps: 20 }
].map(sheet => ({ ...sheet, key: 'oathwarden-prepare-' + sheet.name,
  url: new URL(`../assets/effects/oathwarden-prepare/${sheet.name}.png`, import.meta.url).href }));

// Gladiator's one-shot casts and saved preparations use their own PixelLab sheets.
export const GLADIATOR_PREPARE_EFFECT_SHEETS = [
  { name: 'reequip', abilityId: 'ability_v2_gladiator_reequip', width: 34, height: 46,
    originX: 16, originY: 24, fps: 15, oneShotMs: 2133, opacity: 0.9 },
  { name: 'tactical-reset', abilityId: 'ability_v2_gladiator_tactical_reset', width: 138, height: 54,
    originX: 69, originY: 27, fps: 16, oneShotMs: 1600, loop: true, groundSigil: true, opacity: 0.52 },
  { name: 'rallying-cry', abilityId: 'ability_v2_gladiator_rallying_cry', width: 51, height: 71,
    originX: 24, originY: 46, fps: 16, footAnchor: true, opacity: 0.82 },
  { name: 'combat-readiness', abilityId: 'ability_v2_gladiator_combat_readiness', width: 96, height: 96,
    fps: 20, opacity: 0.78, sphere: true,
    rearKey: 'gladiator-prepare-combat-readiness-rear',
    rearUrl: new URL('../assets/effects/shield-spheres/readiness/rear.png', import.meta.url).href,
    url: new URL('../assets/effects/shield-spheres/readiness/front.png', import.meta.url).href }
].map(sheet => ({ ...sheet, key: 'gladiator-prepare-' + sheet.name,
  url: sheet.url ?? new URL(`../assets/effects/gladiator-prepare/${sheet.name}.png`, import.meta.url).href }));

const ALL_PREPARE_EFFECT_SHEETS = [
  ...PREPARE_EFFECT_SHEETS, ...OATHWARDEN_PREPARE_EFFECT_SHEETS, ...GLADIATOR_PREPARE_EFFECT_SHEETS
];

// Finished transparent PixelLab sheets contain 32 frames, played at 24 FPS below.
export function preloadPrepareAbilityEffects(scene) {
  for (const sheet of ALL_PREPARE_EFFECT_SHEETS) {
    if (!scene.textures.exists(sheet.key)) scene.load.spritesheet(sheet.key, sheet.url, {
      frameWidth: sheet.width, frameHeight: sheet.height, endFrame: 31
    });

    // The sphere's rear film needs its own texture to sit behind the body.
    if (sheet.rearKey && !scene.textures.exists(sheet.rearKey)) scene.load.spritesheet(sheet.rearKey, sheet.rearUrl, {
      frameWidth: sheet.width, frameHeight: sheet.height, endFrame: 31
    });
  }
}

// One-use bonuses leave preparations when the next qualifying action commits.
// Footwork's movement bonus lasts independently of its consumed windup bonus,
// so its ankle art follows the full beneficial movement record instead.
export function prepareEffectActive(scene, target, sheet) {
  if (!target.alive || scene.battleOver) return false;
  const now = scene.time?.now ?? 0;
  if (sheet.name === 'combat-footwork') {
    return target.status?.replacementEffects?.some(record =>
      record.key === `${sheet.abilityId}:beneficial` && record.until > now) ?? false;
  }
  if (sheet.name === 'steadfast-focus') {
    return target.status?.replacementEffects?.some(record =>
      record.key === `${sheet.abilityId}:beneficial` && record.until > now) ?? false;
  }
  if (sheet.name === 'vow-of-readiness') {
    return target.status?.replacementEffects?.some(record =>
      record.key === `${sheet.abilityId}:beneficial` && record.until > now) ?? false;
  }
  if (sheet.name === 'vow-of-retaliation') {
    return target.status?.replacementReactions?.some(record =>
      record.ability?.id === sheet.abilityId && record.until > now) ?? false;
  }
  if (sheet.name === 'combat-readiness') {
    return target.status?.replacementFreeItem?.until > now;
  }
  return target.status?.replacementPreparations?.some(record =>
    record.ability?.id === sheet.abilityId && record.until > now) ?? false;
}

// Refresh reuses a drawing even during its fade, preventing stacked remnants.
// Reading statuses each update also restores current art after reload or catch-up.
function ensureEffect(scene, target, sheet) {
  const effects = scene.prepareAbilityEffects ??= [];
  const existing = effects.find(effect => effect.target === target && effect.sheet === sheet);
  if (existing) {
    existing.fadeElapsed = null;
    return;
  }
  if (!scene.textures.exists(sheet.key) || sheet.rearKey && !scene.textures.exists(sheet.rearKey)) return;
  scene.textures.get(sheet.key).setFilter(1);
  if (sheet.rearKey) scene.textures.get(sheet.rearKey).setFilter(1);
  effects.push({ target, sheet, elapsed: 0, fadeElapsed: null,
    rearImage: sheet.rearKey ? scene.add.image(0, 0, sheet.rearKey, 0) : null,
    image: scene.add.image(0, 0, sheet.key, 0) });
}

// Ability records choose the caster or each ally; the current AI opponent never sets placement.
export function createPrepareAbilityEffect(scene, caster, ability, recipients = [caster]) {
  const sheet = ALL_PREPARE_EFFECT_SHEETS.find(entry => entry.abilityId === ability.id);
  if (!sheet) return false;

  // Potion charges have no timed status record, so play their cast art directly.
  if (sheet.oneShotMs) {
    if (scene.textures.exists(sheet.key)) {
      const effects = scene.prepareAbilityEffects ??= [];
      const existing = effects.find(effect => effect.target === caster && effect.sheet === sheet);
      if (!existing) {
        scene.textures.get(sheet.key).setFilter(1);
        effects.push({ target: caster, sheet, elapsed: 0, fadeElapsed: null, oneShot: true,
          image: scene.add.image(0, 0, sheet.key, 0) });
      }
    }
    return true;
  }
  for (const target of recipients) {
    if (prepareEffectActive(scene, target, sheet)) ensureEffect(scene, target, sheet);
  }
  return true;
}

// Fit visible sprite bounds rather than transparent padding. Side motifs sit
// at distinct heights so Focus and Quick Casting can coexist. Ground sigils
// use their exported foot anchors; size limits keep other art readable.
function drawEffect(effect, bounds) {
  const { target, sheet, image } = effect;
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const oathwarden = sheet.key.startsWith('oathwarden-prepare-');
  const footwork = sheet.name === 'combat-footwork';
  const groundSigil = sheet.name === 'oath-of-the-supplicant' || sheet.name === 'vow-of-readiness';
  const focused = sheet.name === 'steadfast-focus';
  const gladiator = sheet.key.startsWith('gladiator-prepare-');
  const size = gladiator
    ? sheet.groundSigil ? Math.max(0.8, Math.min(2.2, width * 2.2 / sheet.width))
      : sheet.name === 'combat-readiness' ? Math.max(0.9, Math.min(2, height * 0.62 / sheet.height))
        : Math.max(0.8, Math.min(1.8, height * 0.68 / sheet.height))
    : oathwarden
    ? groundSigil ? Math.max(0.8, Math.min(2.2, width * 1.1 / sheet.width))
      : focused ? Math.max(0.42, Math.min(0.85, height * 0.48 / sheet.height))
        : Math.max(0.75, Math.min(1.35, height * 0.72 / sheet.height))
    : footwork ? Math.max(0.8, Math.min(3, width * 1.3 / sheet.width))
      : Math.max(1.3, Math.min(3.2, height * 0.65 / sheet.height));
  const readyWeapon = sheet.name === 'ready-weapon';
  const x = gladiator || oathwarden && groundSigil ? (bounds.left + bounds.right) / 2
    : focused ? bounds.right + 20 * size
      : oathwarden ? (bounds.left + bounds.right) / 2
        : footwork ? (bounds.left + bounds.right) / 2
    : readyWeapon ? bounds.right + 20 * size : bounds.left - 20 * size;
  const y = gladiator && sheet.groundSigil || oathwarden && groundSigil ? bounds.bottom
    : gladiator && sheet.footAnchor ? bounds.bottom
      : gladiator ? bounds.top + height * 0.55
    : focused ? bounds.top + height * 0.32
      : oathwarden ? bounds.top + height * 0.5
    : footwork ? bounds.bottom - height * 0.05
    : bounds.top + height * (sheet.name === 'quick-casting' ? 0.72 : 0.22);
  image.setOrigin((sheet.originX ?? sheet.width / 2) / sheet.width,
    (sheet.originY ?? sheet.height / 2) / sheet.height);
  image.setPosition(x, y).setScale(size).setDepth((target.container?.depth ?? 100 + bounds.bottom) + 1);

  // Combat milliseconds select each sheet's frames at its authored speed.
  // Opacity shares that clock, so pausing freezes both the loop and its fade.
  const frame = Math.floor(effect.elapsed * (sheet.fps ?? 24) / 1000);
  image.setFrame(sheet.oneShotMs && !sheet.loop ? Math.min(31, frame) : frame % 32);
  image.setAlpha((sheet.opacity ?? 0.9) * (1 - (effect.fadeElapsed ?? 0) / FADE_MS));

  // A sphere shares its center, circular scale, frame and fade between layers.
  // The character's unit depth separates the rear film from the front reflections.
  if (sheet.sphere) {
    const sphereSize = shieldSphereScale(bounds);
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;
    const depth = target.container?.depth ?? 100 + bounds.bottom;
    image.setPosition(centerX, centerY).setScale(sphereSize);
    effect.rearImage.setPosition(centerX, centerY).setScale(sphereSize)
      .setDepth(depth - 1).setFrame(frame % 32)
      .setAlpha((sheet.opacity ?? 0.9) * (1 - (effect.fadeElapsed ?? 0) / FADE_MS));
  }
}

// Consumption, expiry, death and battle end start a 400 ms fade. Artwork keeps
// following its recipient until that fade finishes and releases the Phaser image.
export function updatePrepareAbilityEffects(scene, delta, getBounds) {
  for (const target of scene.partyUnits ?? []) {
    for (const sheet of ALL_PREPARE_EFFECT_SHEETS) {
      if (prepareEffectActive(scene, target, sheet)) ensureEffect(scene, target, sheet);
    }
  }
  const step = scene.combatPaused ? 0 : Math.max(0, delta);
  scene.prepareAbilityEffects = (scene.prepareAbilityEffects ?? []).filter(effect => {
    effect.elapsed += step;

    // Let the refill finish its 32 frames, then fade it with the paused combat clock.
    if (effect.oneShot) {
      if (effect.elapsed >= effect.sheet.oneShotMs) effect.fadeElapsed = effect.elapsed - effect.sheet.oneShotMs;
      else if (effect.fadeElapsed !== null || scene.battleOver || !effect.target.alive) {
        effect.fadeElapsed = (effect.fadeElapsed ?? 0) + step;
      }
    } else if (!effect.oneShot && !prepareEffectActive(scene, effect.target, effect.sheet)) {
      effect.fadeElapsed = (effect.fadeElapsed ?? 0) + step;
    }
    if (effect.fadeElapsed >= FADE_MS) {
      effect.image.destroy();
      effect.rearImage?.destroy();
      return false;
    }
    drawEffect(effect, getBounds(scene, effect.target));
    return true;
  });
}

// Historical replay and shutdown may immediately remove art. Saved statuses
// remain untouched and recreate only their current drawing on live update.
export function clearPrepareAbilityEffects(scene) {
  for (const effect of scene.prepareAbilityEffects ?? []) {
    effect.image.destroy();
    effect.rearImage?.destroy();
  }
  scene.prepareAbilityEffects = [];
}
