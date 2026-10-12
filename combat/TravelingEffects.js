import { rangedTravelProfile } from '../data/rangedTravelEffects.js';
import { RANGED_DELIVERY_SHEETS } from '../data/rangedDelivery.js';

const FADE_MS = 400;

// Arena positions are ground coordinates. Aim at the visible sprite's chest rather
// than the floor; local sprite offsets and container scale include perspective.
function point(scene, unit, ground = false) {
  const floor = scene.battlefield.arenaToScreen(unit.arenaX, unit.arenaY);
  const sprite = unit.spriteVisual?.image;
  const scale = Math.abs(unit.container?.scaleY ?? 1);
  return { x: ground || !sprite?.width ? floor.x
    : floor.x + (sprite.x + (0.5 - sprite.originX) * sprite.width * Math.abs(sprite.scaleX))
      * Math.abs(unit.container?.scaleX ?? scale), y: ground ? floor.y : sprite?.height
    ? floor.y + (sprite.y + (0.45 - sprite.originY) * sprite.height * Math.abs(sprite.scaleY)) * scale
    : floor.y - 65 * scale, depth: 100 + floor.y };
}

// Contact art shares this exact chest anchor, so arrival and impact line up.
export { point as travelingEffectPoint };

// Flight uses the final part of the existing windup, so contact and gameplay damage
// keep their authored timestamp. A long preparation does not make a slow projectile.
export function startTravelingEffect(scene, caster, target, ability, action = null, profile = null) {
  profile ??= rangedTravelProfile(caster, ability);
  if (profile && target?.groundDestination) profile = { ...profile, ground: true };
  
  // Slime Cave already supplies an authored PixelLab glob flight in its own module.
  // Let that module own the lob and splash rather than drawing a second projectile.
  if (ability.name === 'Toxic Glob' && scene.textures?.exists?.('slime-ability-glob-flight')) return false;
  if (!profile || !target || caster === target || !scene.add?.graphics || scene.idleSimulating
    || scene.game.backgroundProgress?.isReplaying || scene.battleOver) return false;
  const effects = scene.travelingEffects ??= [];
  if (action && effects.some(effect => effect.action === action && effect.caster === caster)) return true;
  if (!scene.travelingEffectsCleanupInstalled) {
    scene.travelingEffectsCleanupInstalled = true;
    scene.events.once('shutdown', () => {
      clearTravelingEffects(scene);
      scene.travelingEffectsCleanupInstalled = false;
    });
  }
  const duration = Math.max(1, action?.duration ?? 360);
  const travelMs = Math.min(duration, 520);
  const elapsed = action ? Math.max(0, (scene.time?.now ?? action.startAt) - action.startAt) : 0;
  const effect = { caster, target, ability, action, profile, duration, travelMs, elapsed,
    delay: duration - travelMs, from: point(scene, caster), to: point(scene, target, profile.ground),
    graphics: scene.add.graphics(), fadeElapsed: null, progress: 0, launched: elapsed >= duration - travelMs };

  // Named missile profiles share finished sheets. Other delivery types retain
  // their graphics, including growing beams, tethers, whips and thrown flasks.
  const sheetName = profile.type === 'rock' ? 'stone' : profile.type === 'glob' ? 'bolt' : profile.type;
  const sheet = RANGED_DELIVERY_SHEETS.find(entry => entry.name === sheetName);
  if (sheet && !profile.volley && scene.textures?.exists?.(sheet.key) && scene.add.image) {
    effect.sheet = sheet;
    effect.image = scene.add.image(effect.from.x, effect.from.y, sheet.key, 0)
      .setOrigin(0.5).setScale(sheetName === 'stone' ? 0.35 : 1.8).setTint(profile.color);
    scene.textures.get(sheet.key).setFilter(1);
  }
  effects.push(effect);
  drawTravelingEffect(effect);
  return true;
}

// A parabola lifts thrown objects above the straight path and lands at exactly the
// target. The derivative gives arrows and stones the angle of their current motion.
export function travelPose(from, to, progress, profile) {
  const p = Math.max(0, Math.min(1, progress));
  const dx = to.x - from.x, dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const height = profile.arc ? Math.min(170, Math.max(35, distance * 0.25)) : 0;
  const bend = profile.curve ? Math.min(55, distance * 0.12) : 0;
  const offset = bend * Math.sin(Math.PI * p);
  return { x: from.x + dx * p + (distance ? -dy / distance * offset : 0),
    y: from.y + dy * p - 4 * height * p * (1 - p) + (distance ? dx / distance * offset : 0),
    angle: Math.atan2(dy - 4 * height * (1 - 2 * p)
      + (distance ? dx / distance * bend * Math.PI * Math.cos(Math.PI * p) : 0),
    dx + (distance ? -dy / distance * bend * Math.PI * Math.cos(Math.PI * p) : 0)) };
}

// Small original drawings complement the existing PixelLab impact sheets. Rotation
// follows the flight tangent so leftward arrows and descending lobs point correctly.
function drawTravelingEffect(effect) {
  const { graphics, profile, from, to } = effect;
  const progress = Math.max(0, Math.min(1, (effect.elapsed - effect.delay) / effect.travelMs));
  if (effect.fadeElapsed === null) effect.progress = progress;
  const pose = travelPose(from, to, effect.progress, profile);
  effect.pose = pose;
  graphics.clear().setVisible(effect.elapsed >= effect.delay)
    .setAlpha(1 - (effect.fadeElapsed ?? 0) / FADE_MS)
    .setDepth(from.depth + (to.depth - from.depth) * effect.progress + 1);
  if (effect.image) {

    // Native artwork faces east. Rotate it along the same tangent used by the
    // original drawings; 24 FPS animation and opacity use paused combat time.
    effect.image.setPosition(pose.x, pose.y).setRotation(pose.angle)
      .setFrame(Math.floor(effect.elapsed * effect.sheet.fps / 1000) % effect.sheet.frames)
      .setVisible(effect.elapsed >= effect.delay).setAlpha(1 - (effect.fadeElapsed ?? 0) / FADE_MS)
      .setDepth(from.depth + (to.depth - from.depth) * effect.progress + 1);
    graphics.setVisible(false);
    return;
  }
  const tipX = Math.cos(pose.angle), tipY = Math.sin(pose.angle);
  const color = profile.color;
  if (['beam', 'tether', 'whip'].includes(profile.type)) {
    graphics.lineStyle(profile.type === 'beam' ? 7 : 4, color, 0.8).beginPath().moveTo(from.x, from.y);
    for (let step = 1; step <= 20; step++) {
      const p = effect.progress * step / 20;
      const sway = profile.type === 'whip' ? Math.sin(p * Math.PI * 3) * 14 * (1 - effect.progress) : 0;
      graphics.lineTo(from.x + (to.x - from.x) * p, from.y + (to.y - from.y) * p + sway);
    }
    graphics.strokePath();
    if (profile.type === 'beam') graphics.lineStyle(2, 0xffffff, 0.9).lineBetween(from.x, from.y, pose.x, pose.y);
    return;
  }
  const count = profile.volley ? 3 : 1;
  for (let index = 0; index < count; index++) {
    const shift = (index - (count - 1) / 2) * 15;
    const x = pose.x - tipY * shift, y = pose.y + tipX * shift;
    if (profile.type === 'arrow') {
      graphics.lineStyle(3, 0x92774d, 1).lineBetween(x - tipX * 22, y - tipY * 22, x, y);
      graphics.fillStyle(color, 1).fillTriangle(x + tipX * 7, y + tipY * 7,
        x - tipX * 3 - tipY * 5, y - tipY * 3 + tipX * 5,
        x - tipX * 3 + tipY * 5, y - tipY * 3 - tipX * 5);
      graphics.lineStyle(3, color, 1).lineBetween(x - tipX * 19 - tipY * 5,
        y - tipY * 19 + tipX * 5, x - tipX * 14, y - tipY * 14);
    } else {
      const radius = profile.type === 'rock' ? 10 : profile.type === 'flask' ? 7 : 6;
      graphics.lineStyle(4, color, 0.35).lineBetween(x - tipX * 26, y - tipY * 26, x, y);
      graphics.fillStyle(color, 1).fillCircle(x, y, radius);
      graphics.fillStyle(0xffffff, 0.65).fillCircle(x - 2, y - 2, radius * 0.4);
      if (profile.type === 'flask') graphics.fillStyle(0x70482d, 1).fillRect(x - 3, y - 12, 6, 5);
    }
  }
}

// Resolution retires a flight at its endpoint. Interruptions leave it at its current
// point and fade there, so canceled shots never pretend to hit their former targets.
export function finishTravelingEffect(scene, caster, action) {
  for (const effect of scene.travelingEffects ?? []) {
    if (effect.caster !== caster || action && effect.action !== action || effect.fadeElapsed !== null) continue;
    if (effect.caster.alive && effect.target.alive !== false && effect.caster.pendingAction === effect.action
      && (scene.time?.now ?? 0) >= (effect.action?.startAt ?? Infinity) + effect.duration) {
      effect.elapsed = effect.duration;
      effect.progress = 1;
      effect.to = point(scene, effect.target, effect.profile.ground);
    }
    effect.fadeElapsed = 0;
    drawTravelingEffect(effect);
  }
}

// Only cosmetic elapsed time advances here. Damage, healing, accuracy and action
// scheduling remain in their existing combat systems, including saved encounters.
export function updateTravelingEffects(scene, delta, replaying = false) {
  if (replaying || scene.idleSimulating || scene.game.backgroundProgress?.isReplaying) {
    clearTravelingEffects(scene);
    return;
  }
  const step = scene.combatPaused ? 0 : Math.max(0, delta);

  // Reconnect saved pending casts through existing event unit IDs. No projectile
  // data is saved, and completed historical casts never create new drawings.
  if (!scene.battleOver) {
    const units = [...(scene.partyUnits ?? []), ...(scene.enemies ?? [])];
    for (const event of scene.battleEvents ?? []) {
      const data = event.data;
      const caster = units.find(unit => unit.id === data?.unitId);
      const action = caster?.pendingAction;
      if (!action || action.startAt !== data.actionStartAt || !caster.alive) continue;
      const target = data.center ? { ...data.center, alive: true, groundDestination: true } : units.find(unit => unit.id === data.targetId);
      if (!target || target.alive === false) continue;
      const ability = data.kind === 'attack' ? { name: 'Attack', attackType: data.attackType }
        : data.kind === 'heal' ? { name: 'Mend', recipient: target }
        : data.ability ?? caster.abilities?.[data.key];
      if (ability) startTravelingEffect(scene, caster, target, ability, action);
    }
  }
  scene.travelingEffects = (scene.travelingEffects ?? []).filter(effect => {
    if (effect.fadeElapsed === null && (scene.battleOver || !effect.caster.alive
      || !effect.target.alive || effect.action && effect.caster.pendingAction !== effect.action)) {
      finishTravelingEffect(scene, effect.caster, effect.action);
    }
    if (effect.fadeElapsed !== null) effect.fadeElapsed += step;
    else {
      effect.elapsed = Math.min(effect.duration, effect.elapsed + step);

      // The release follows the caster during preparation. After launch it stays
      // fixed, so walking cannot drag an airborne arrow or thrown object.
      if (!effect.launched) {
        effect.from = point(scene, effect.caster);
        effect.launched = effect.elapsed >= effect.delay;
      }
      effect.to = point(scene, effect.target, effect.profile.ground);
      if (effect.elapsed >= effect.duration) {
        effect.progress = 1;
        effect.fadeElapsed = 0;
      }
    }
    if (effect.fadeElapsed >= FADE_MS) {
      effect.graphics.destroy();
      effect.image?.destroy();
      return false;
    }
    drawTravelingEffect(effect);
    return true;
  });
}

// Shutdown and historical replay release drawings immediately rather than fading
// effects from a battle the player can no longer see.
export function clearTravelingEffects(scene) {
  for (const effect of scene.travelingEffects ?? []) {
    effect.graphics.destroy();
    effect.image?.destroy();
  }
  scene.travelingEffects = [];
}
