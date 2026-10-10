// Cosmetic playback uses elapsed combat milliseconds rather than wall time.
// Damage still resolves in ClassAbilitySystem, including saved and background battles.

import { findAbilityEffect } from '../data/abilityEffects.js';
import { ADJACENT_DISTANCE } from '../config/combatRanges.js';

// Destroy each piece and release references when playback ends or the scene shuts down.
export function clearAbilityEffects(scene) {
  for (const effect of scene.abilityEffects ?? []) {
    for (const piece of effect.pieces) piece.image.destroy();
    effect.zone?.destroy();
  }
  for (const telegraph of scene.abilityTelegraphs ?? []) telegraph.zone.destroy();
  scene.abilityEffects = [];
  scene.abilityTelegraphs = [];
}

// Both cast warnings and arrow playback share one scene cleanup listener.
function prepareEffects(scene) {
  if (scene.abilityEffectsCleanupInstalled) return;
  scene.abilityEffects = scene.abilityEffects ?? [];
  scene.abilityTelegraphs = scene.abilityTelegraphs ?? [];
  scene.abilityEffectsCleanupInstalled = true;

  // Reset both lists so a restarted BattleScene installs a fresh listener.
  scene.events.once('shutdown', () => {
    clearAbilityEffects(scene);
    scene.abilityEffects = null;
    scene.abilityTelegraphs = null;
    scene.abilityEffectsCleanupInstalled = false;
  });
}

// Keep the effect specific to Ranger Volley and skip historical background drawing.
function canDrawVolley(scene, caster, ability) {
  return caster.className === 'Ranger' && ability.name === 'Volley'
    && !scene.game.backgroundProgress?.isReplaying && !scene.idleSimulating && !scene.battleOver;
}

// Art never runs during historical simulation and never changes the combat model.
function canDraw(scene) {
  return !scene.game.backgroundProgress?.isReplaying && !scene.idleSimulating && !scene.battleOver;
}

// Project the actual circular damage radius onto the floor using the same convention
// as enemy area warnings. The Ranger's numeric color is a Phaser RGB color value.
function createZone(scene, caster, target, ability) {
  const origin = scene.battlefield.arenaToScreen(target.arenaX, target.arenaY);
  const radii = scene.battlefield.getGroundEllipseRadii(
    (ability.zone ?? 2) * ADJACENT_DISTANCE, target.arenaY
  );
  const color = caster.color ?? 0x15803d;
  return scene.add.ellipse(origin.x, origin.y, radii.width * 2, radii.height * 2, color, 0.25)
    .setStrokeStyle(7, color, 0.95).setDepth(40 + origin.y);
}

// Start flights or the Volley warning at cast start. Both follow the current target
// during windup; this presentation never registers a hazard with the movement AI.
export function createAbilityTelegraph(scene, caster, target, ability, action) {
  const projectile = findAbilityEffect(caster, ability, true);
  if (projectile && canDraw(scene)) {
    return startEffect(scene, caster, target, ability, projectile, action);
  }
  if (!canDrawVolley(scene, caster, ability)) return false;
  prepareEffects(scene);
  scene.abilityTelegraphs.push({ caster, target, ability, action,
    zone: createZone(scene, caster, target, ability) });
  return true;
}

// Match the exact cast object so an old callback cannot remove a newer cast's warning.
export function clearAbilityTelegraph(scene, caster, action) {
  if (!scene.abilityEffects && !scene.abilityTelegraphs) return;
  scene.abilityEffects = (scene.abilityEffects ?? []).filter(effect => {
    if (effect.caster !== caster || effect.action !== action) return true;
    for (const piece of effect.pieces) piece.image.destroy();
    return false;
  });
  scene.abilityTelegraphs = (scene.abilityTelegraphs ?? []).filter(telegraph => {
    if (telegraph.caster !== caster || telegraph.action !== action) return true;
    telegraph.zone.destroy();
    return false;
  });
}

// Start resolved artwork. Only Volley keeps its existing colored damage zone.
export function createAbilityEffect(scene, caster, target, ability, recipients = [target]) {
  const definition = findAbilityEffect(caster, ability);
  if (!definition || !canDraw(scene)) return false;
  return startEffect(scene, caster, target, ability, definition, null, recipients);
}

// Sprite images have a local origin inside a scaled unit container. Convert that
// rectangle to screen pixels, excluding known top padding, to fit surrounding art.
function unitBounds(scene, unit) {
  const origin = scene.battlefield.arenaToScreen(unit.arenaX, unit.arenaY);
  const image = unit.spriteVisual?.image;
  const perspective = unit.container?.scaleX ?? scene.battlefield.getUnitScale?.(unit.arenaY) ?? 1;
  if (!image) {
    const width = (unit.bodyRadius ?? 45) * 2 * perspective;
    return { left: origin.x - width / 2, right: origin.x + width / 2,
      top: origin.y - 140 * perspective, bottom: origin.y + 20 * perspective };
  }
  const scaleX = Math.abs(image.scaleX), scaleY = Math.abs(image.scaleY);
  const topPadding = unit.spriteVisual.definition.topFrameY ?? 0;
  const left = origin.x + (image.x - image.originX * image.width * scaleX) * perspective;
  const top = origin.y + (image.y - (image.originY * image.height - topPadding) * scaleY) * perspective;
  return { left, right: left + image.width * scaleX * perspective,
    top, bottom: origin.y + (image.y + (1 - image.originY) * image.height * scaleY) * perspective };
}

// Keep an area fixed at its impact point. Its initial rectangle includes the resolved
// recipients' sprites, while its draw depth stays above them for the full animation.
function fitCoverage(scene, effect) {
  const clips = effect.definition.clips;
  const left = Math.min(...clips.map(clip => clip.x));
  const right = Math.max(...clips.map(clip => clip.x + clip.width));
  const top = Math.min(...clips.map(clip => clip.y));
  const bottom = Math.max(...clips.map(clip => clip.y + clip.height));
  for (const unit of effect.recipients) {
    const bounds = unitBounds(scene, unit);
    effect.scaleX = Math.max(effect.scaleX, Math.ceil((effect.origin.x - bounds.left) / Math.max(1, -left)),
      Math.ceil((bounds.right - effect.origin.x) / Math.max(1, right)));
    effect.scaleY = Math.max(effect.scaleY, Math.ceil((effect.origin.y - bounds.top) / Math.max(1, -top)),
      Math.ceil((bounds.bottom - effect.origin.y) / Math.max(1, bottom)));
  }
}

// The Ward sheet is a ring centered on its origin. Stretch its interior around the
// target's full sprite with a little breathing room, rather than centering on feet.
function fitWard(scene, effect) {
  const bounds = unitBounds(scene, effect.target);
  const clip = effect.definition.clips[0];
  effect.origin = { ...effect.origin, x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2 };

  // Eight artwork pixels account for the ring thickness; the remaining interior
  // must enclose the sprite. This requested stretch permits fractional scaling.
  effect.scaleX = (bounds.right - bounds.left) * 1.35 / (clip.width - 8);
  effect.scaleY = (bounds.bottom - bounds.top) * 1.25 / (clip.height - 8);
}

// Area art uses the actual radius; individual hits use a 200-unit visual footprint.
// All scaling stays whole-number to preserve the supplied pixel edges.
function startEffect(scene, caster, target, ability, definition, action = null, recipients = [target]) {
  if (!definition.clips.every(clip => scene.textures.exists(clip.key))) return false;
  const anchor = ability.radius ? caster : target;
  const origin = scene.battlefield.arenaToScreen(anchor.arenaX, anchor.arenaY);
  const radius = definition.singleTargetArtwork ? null : ability.zone ?? ability.radius ?? ability.splash;
  const diameter = (radius ? 2 * radius * ADJACENT_DISTANCE : 200)
    * origin.widthAtDepth / scene.battlefield.logicalWidth;
  const scale = Math.max(1, Math.round(diameter * (definition.sizeMultiplier ?? 1) / definition.groundWidth));
  prepareEffects(scene);

  // Reapplying a mark replaces its artwork instead of stacking identical rings.
  if (definition.untilDeath || definition.followShield) {
    scene.abilityEffects = scene.abilityEffects.filter(effect => {
      if (effect.definition.id !== definition.id || effect.target !== target) return true;
      for (const piece of effect.pieces) piece.image.destroy();
      return false;
    });
  }

  // Units draw at 100 + their foot y. Arrows sit just behind the origin and
  // ground impacts just ahead. Foreground scenery keeps its existing occlusion.
  const pieces = definition.clips.map(clip => {
    scene.textures.get(clip.key).setFilter(1);
    const image = scene.add.image(0, 0, clip.key, 0).setOrigin(0).setScale(scale)
      .setDepth(100 + origin.y + (clip.depth === 'behind' ? -1 : 1));
    return { clip, image };
  });
  const effect = { definition, caster, target, anchor, recipients, action, origin, scale,
    scaleX: scale * (definition.widthStretch ?? 1), scaleY: scale, pieces, elapsed: 0,
    duration: definition.untilDeath || definition.followShield ? Infinity
      : action?.duration ?? (definition.holdMs ?? definition.frames * definition.frameMs) + (definition.fadeMs ?? 0),
    flightStart: action ? scene.battlefield.arenaToScreen(caster.arenaX, caster.arenaY) : null,
    zone: definition.id === 'volley' ? createZone(scene, caster, target, ability) : null };
  scene.abilityEffects.push(effect);
  if (definition.coverUnits) fitCoverage(scene, effect);
  if (definition.surroundTarget) fitWard(scene, effect);
  updateEffectDepth(scene, effect);
  drawEffect(effect);
  if (action) drawFlight(scene, effect);
  return true;
}

// Each piece starts on its exported frame with a top-left offset from the origin.
function drawEffect(effect) {
  const frame = effect.action && !effect.pieces[0].clip.loop
    ? Math.floor(Math.min(1, effect.elapsed / effect.duration) * (effect.pieces[0].clip.frames - 1))
    : Math.floor(effect.elapsed / effect.definition.frameMs);

  // Healing columns stay fully visible for 1,500 combat milliseconds, then fade
  // over 400 more. Clamp the fraction to 0..1 so earlier frames retain full opacity.
  // The same paused elapsed time drives frames and fading, with no wall-clock tween.
  const fadeProgress = effect.definition.fadeMs
    ? Math.max(0, Math.min(1, (effect.elapsed - effect.definition.holdMs) / effect.definition.fadeMs)) : 0;
  for (const { clip, image } of effect.pieces) {
    const age = frame - clip.start;
    const localFrame = clip.loop && age >= 0 ? age % clip.frames : age;
    const visible = localFrame >= 0 && localFrame < clip.frames;
    image.setVisible(visible);
    if (!visible) continue;

    // Offsets place the supplied parts around one origin. Volley's travel is baked
    // into its frames; only separate projectile packs receive additional flight motion.
    image.setAlpha(1 - fadeProgress).setScale(effect.scaleX, effect.scaleY).setFrame(localFrame).setPosition(
      effect.origin.x + clip.x * effect.scaleX,
      effect.origin.y + clip.y * effect.scaleY
    );
  }
}

// Front layers use the foremost recipient's unit depth. Updating depth does not move
// fixed area art and keeps it over affected units whose positions change afterward.
function updateEffectDepth(scene, effect) {
  if (!effect.definition.coverUnits && !effect.definition.followTarget) return;
  const units = effect.definition.coverUnits ? effect.recipients : [effect.anchor];
  const depth = Math.max(...units.map(unit => unit.container?.depth
    ?? 100 + scene.battlefield.arenaToScreen(unit.arenaX, unit.arenaY).y)) + 1;
  for (const piece of effect.pieces) piece.image.setDepth(depth);
}

// Optional status fields are already part of battle snapshots. Recreate persistent
// art after reload or background catch-up without replaying old casts or damage.
function restorePersistentEffects(scene) {
  const now = scene.time?.now ?? 0;
  const units = [...(scene.partyUnits ?? []), ...(scene.enemies ?? [])];
  for (const target of units) {
    if (!target.alive) continue;
    const requests = [];
    if (target.status?.huntersMarkVisual) {
      requests.push([{ className: 'Ranger' }, { name: "Hunter's Mark" }]);
    }
    if (target.status?.sunlitWardVisualUntil > now && target.status.temporaryHp > 0) {
      requests.push([{ className: 'Dawnwarden' }, { name: 'Sunlit Ward',
        duration: target.status.sunlitWardVisualUntil - now }]);
    }
    for (const [caster, ability] of requests) {
      if (scene.abilityEffects?.some(effect => effect.target === target && effect.definition.abilityName === ability.name)) continue;
      createAbilityEffect(scene, caster, target, ability);
    }
  }
}

// Flights track the target over the already scheduled windup. Pivot around the supplied
// artwork origin so rotation points the arrow/orb along its screen-space travel line.
function drawFlight(scene, effect) {
  const end = scene.battlefield.arenaToScreen(effect.target.arenaX, effect.target.arenaY);
  const start = effect.flightStart;
  const progress = Math.min(1, effect.elapsed / effect.duration);
  const dx = end.x - start.x, dy = end.y - start.y;

  // Aim at the body, 65 logical units above the feet. Perspective converts that
  // height to screen pixels independently of the effect's artwork scale.
  const lift = 65 * end.widthAtDepth / scene.battlefield.logicalWidth;
  for (const { clip, image } of effect.pieces) {
    image.setOrigin(-clip.x / clip.width, -clip.y / clip.height)
      .setPosition(start.x + dx * progress, start.y + dy * progress - lift)
      .setRotation(Math.atan2(dy, dx)).setDepth(101 + start.y + dy * progress);
  }
}

// Pause freezes movement and frames. Catch-up drops historical cosmetic effects.
export function updateAbilityEffects(scene, delta, replaying = false) {
  if (replaying) {
    if (scene.abilityEffects?.length || scene.abilityTelegraphs?.length) clearAbilityEffects(scene);
    return;
  }
  if (canDraw(scene)) restorePersistentEffects(scene);
  if (!scene.abilityEffects?.length && !scene.abilityTelegraphs?.length) return;

  // Canceled, interrupted or defeated casts lose their warnings on the next frame,
  // even while paused. Successful casts replace the warning with the impact zone.
  scene.abilityTelegraphs = (scene.abilityTelegraphs ?? []).filter(telegraph => {
    const { caster, target, ability, action, zone } = telegraph;
    if (!caster.alive || !target.alive || caster.pendingAction !== action || scene.battleOver) {
      zone.destroy();
      return false;
    }
    const origin = scene.battlefield.arenaToScreen(target.arenaX, target.arenaY);
    const radii = scene.battlefield.getGroundEllipseRadii(
      (ability.zone ?? 2) * ADJACENT_DISTANCE, target.arenaY
    );
    zone.setPosition(origin.x, origin.y).setDisplaySize(radii.width * 2, radii.height * 2)
      .setDepth(40 + origin.y);
    return true;
  });

  const remaining = [];
  for (const effect of scene.abilityEffects) {
    if (!scene.combatPaused) effect.elapsed += Math.max(0, delta);
    const canceledFlight = effect.action && (!effect.caster.alive || !effect.target.alive
      || effect.caster.pendingAction !== effect.action);
    const endedMark = effect.definition.untilDeath && !effect.target.alive;
    const endedWard = effect.definition.followShield && (!effect.target.alive
      || !(effect.target.status?.temporaryHp > 0)
      || (scene.time?.now ?? 0) >= (effect.target.status?.sunlitWardVisualUntil ?? 0));
    if (effect.elapsed >= effect.duration || canceledFlight || endedMark || endedWard || scene.battleOver) {
      for (const piece of effect.pieces) piece.image.destroy();
      effect.zone?.destroy();
    } else {
      if (effect.definition.followTarget) {
        effect.origin = scene.battlefield.arenaToScreen(effect.anchor.arenaX, effect.anchor.arenaY);
        if (effect.definition.surroundTarget) fitWard(scene, effect);
      }
      updateEffectDepth(scene, effect);
      drawEffect(effect);
      if (effect.action) drawFlight(scene, effect);
      remaining.push(effect);
    }
  }
  scene.abilityEffects = remaining;
}
