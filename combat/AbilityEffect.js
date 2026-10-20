// Cosmetic playback uses elapsed combat milliseconds rather than wall time.
// Damage still resolves in ClassAbilitySystem, including saved and background battles.

import { findAbilityEffect } from '../data/abilityEffects.js';
import { shieldSphereScale } from '../data/shieldSphereEffects.js';
import { ADJACENT_DISTANCE } from '../config/combatRanges.js';
import { MAGICAL_PROTECTION_EFFECTS, magicalProtectionStatusActive } from '../data/magicalProtectionEffects.js';
import { MAGICAL_ASSAULT_EFFECTS } from '../data/magicalAssaultEffects.js';
import { OATHWARDEN_ASSAULT_EFFECTS } from '../data/oathwardenAssaultEffects.js';
import { GLADIATOR_ASSAULT_EFFECTS } from '../data/gladiatorAssaultEffects.js';
import { DAWNWARDEN_ASSAULT_EFFECTS } from '../data/dawnwardenAssaultEffects.js';
import { OATHWARDEN_PROTECT_EFFECTS } from '../data/oathwardenProtectEffects.js';
import { GLADIATOR_PROTECT_EFFECTS } from '../data/gladiatorProtectEffects.js';
import { GENERIC_RESTORE_EFFECTS } from '../data/genericRestoreEffects.js';
import { GROVEKEEPER_EFFECTS } from '../data/grovekeeperEffects.js';
import { RANGER_ABILITY_EFFECTS } from '../data/rangerAbilityEffects.js';
import { BARBARIAN_ABILITY_EFFECTS } from '../data/barbarianAbilityEffects.js';
import { BARMAID_ABILITY_EFFECTS } from '../data/barmaidAbilityEffects.js';
import { DAWNPRIEST_EFFECTS } from '../data/dawnpriestEffects.js';
import { UMBRAMANCER_EFFECTS } from '../data/umbramancerEffects.js';
import { RUNEDANCER_EFFECTS } from '../data/runedancerEffects.js';
import { updateUmbralDecoyEffects, clearUmbralDecoyEffects } from './UmbralDecoyEffects.js';
import { createPhysicalAbilityEffect, updatePhysicalAbilityEffects, clearPhysicalAbilityEffects } from './PhysicalAbilityEffects.js';
import { createPrepareAbilityEffect, updatePrepareAbilityEffects, clearPrepareAbilityEffects } from './PrepareAbilityEffects.js';
import { startTravelingEffect, finishTravelingEffect, clearTravelingEffects, updateTravelingEffects } from './TravelingEffects.js';
import { shatterRuneEffect, updateRuneShatterEffects, clearRuneShatterEffects } from './RuneShatterEffects.js';

// Each pack may read its own saved status. Assault skills use secondary modifiers;
// protection packs keep their existing lock and primary-modifier checks.
function effectStatusActive(target, definition, now, wave) {
  const checkStatus = definition.statusActive ?? magicalProtectionStatusActive;
  return checkStatus(target, definition, now, wave);
}

// Destroy each piece and release references when playback ends or the scene shuts down.
export function clearAbilityEffects(scene) {
  clearRuneShatterEffects(scene);
  clearUmbralDecoyEffects(scene);
  clearTravelingEffects(scene);
  clearPhysicalAbilityEffects(scene);
  clearPrepareAbilityEffects(scene);
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
  const traveling = canDraw(scene) && startTravelingEffect(scene, caster, target, ability, action);
  if (traveling && !canDrawVolley(scene, caster, ability)) return true;
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
  finishTravelingEffect(scene, caster, action);
  if (!scene.abilityEffects && !scene.abilityTelegraphs) return;
  scene.abilityEffects = (scene.abilityEffects ?? []).filter(effect => {
    if (effect.caster !== caster || effect.action !== action) return true;

    // Authored arrows and bolts leave a paused 400 ms fading remnant at their last
    // flight point, instead of being deleted by the cast's cleanup callback.
    if (effect.definition.projectile) {
      if (effect.caster.alive && effect.target.alive && effect.caster.pendingAction === effect.action
        && (scene.time?.now ?? 0) >= (effect.action?.startAt ?? Infinity) + effect.duration) {
        effect.elapsed = effect.duration;
        drawFlight(scene, effect);
      }
      effect.retiredFlight = true;
      effect.fadeElapsed = 0;
      return true;
    }
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
  if (canDraw(scene) && createPrepareAbilityEffect(scene, caster, ability, recipients)) {
    prepareEffects(scene);
    return true;
  }
  if (canDraw(scene) && ability.id?.startsWith('ability_v2_generic_physical_')) {
    prepareEffects(scene);
    if (createPhysicalAbilityEffect(scene, caster, target, ability, recipients)) return true;
  }
  const definition = findAbilityEffect(caster, ability);
  if (!definition || !canDraw(scene)) return false;
  if (definition.perRecipient) {
    let started = false;

    // Set removes duplicate recipients. Each cloud keeps its own impact position,
    // so distant victims never inflate the cloud on a normal-sized creature.
    for (const recipient of new Set(recipients)) {
      started = startEffect(scene, caster, recipient, ability, definition, null, [recipient]) || started;
    }
    return started;
  }
  return startEffect(scene, caster, target, ability, definition, null, recipients);
}

// Cache the visible rectangle of each idle frame. Transparent sheet padding is not
// part of a creature's body, and reading pixels again every update would be wasteful.
const visibleFrames = new WeakMap();

// Measure an idle silhouette at this unit's projected position. Idle metadata gives
// a steady body size even when the current attack frame contains extended weapons.
export function visibleUnitBounds(scene, unit) {
  const visual = unit.spriteVisual;
  const image = visual?.image;
  const idle = visual?.definition.clips?.idle;
  const idleFrame = idle?.[visual.motion?.direction]?.frames[0] ?? idle?.south?.frames[0];
  const frame = idleFrame ? scene.textures.getFrame?.(idleFrame.key, idleFrame.frame) : image?.frame;
  if (!image || !frame?.source?.image || typeof document === 'undefined') return unitBounds(scene, unit);

  let bounds = visibleFrames.get(frame);
  if (!bounds) {

    // Copy just one sheet cell into a small canvas. Alpha above 16 excludes almost
    // invisible fringe pixels; all coordinates here are original artwork pixels.
    const canvas = document.createElement('canvas');
    canvas.width = frame.cutWidth;
    canvas.height = frame.cutHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
      0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] <= 16) continue;
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y + 1);
      }
    }
    bounds = right > left ? { left, top, right, bottom } : null;
    if (!bounds) return unitBounds(scene, unit);
    visibleFrames.set(frame, bounds);
  }

  // Use the stable idle silhouette and authored scale, so attack poses and sprite
  // squashes cannot make a persistent mark or healing column pulse in size.
  const origin = scene.battlefield.arenaToScreen(unit.arenaX, unit.arenaY);
  const perspective = Math.abs(unit.container?.scaleX ?? scene.battlefield.getUnitScale?.(unit.arenaY) ?? 1);
  const scale = visual.definition.scale * perspective;
  const flipped = idleFrame?.flipX ?? image.flipX;
  const anchorX = idleFrame?.originX ?? image.originX;
  const originX = idleFrame && flipped ? 1 - anchorX : anchorX;
  const originY = idleFrame?.originY ?? image.originY;
  const footY = (visual.definition.footY ?? 0) * perspective;

  // Mirrored facings also mirror the opaque rectangle and its anchor, matching
  // UnitSprite's flip handling without changing the cached source measurements.
  const left = flipped ? frame.cutWidth - bounds.right : bounds.left;
  const right = flipped ? frame.cutWidth - bounds.left : bounds.right;
  return { left: origin.x + (left - originX * frame.cutWidth) * scale,
    right: origin.x + (right - originX * frame.cutWidth) * scale,
    top: origin.y + footY + (bounds.top - originY * frame.cutHeight) * scale,
    bottom: origin.y + footY + (bounds.bottom - originY * frame.cutHeight) * scale };
}

// Fit the whole effect proportionally inside a modest rectangle around the visible
// body. Fractional scale lets small creatures receive small effects even below 1x.
function fitTarget(scene, effect) {
  const bounds = visibleUnitBounds(scene, effect.target);
  const sizeBounds = effect.casterSizeBounds ?? bounds;
  const clips = effect.definition.clips;

  // Optional measured bounds exclude transparent sheet padding when fitting small
  // Restore icons. These are artwork pixels relative to the exported origin.
  const left = effect.definition.artworkBounds?.left ?? Math.min(...clips.map(clip => clip.x));
  const right = effect.definition.artworkBounds?.right ?? Math.max(...clips.map(clip => clip.x + clip.width));
  const top = effect.definition.artworkBounds?.top ?? Math.min(...clips.map(clip => clip.y));
  const bottom = effect.definition.artworkBounds?.bottom ?? Math.max(...clips.map(clip => clip.y + clip.height));
  const margin = effect.definition.targetSize ?? 1.25;
  const scale = Math.min((sizeBounds.right - sizeBounds.left) * margin / (right - left),
    (sizeBounds.bottom - sizeBounds.top) * margin / (bottom - top));
  effect.scale = effect.scaleX = effect.scaleY = scale;

  // Center hits on the body rather than at the feet. Healing columns keep their
  // exported ground anchor, so their bases remain beneath the recipient.
  effect.origin.x = (bounds.left + bounds.right) / 2;
  effect.origin.y = effect.definition.healing || effect.definition.groundAtFeet ? bounds.bottom - bottom * scale
    : (bounds.top + bounds.bottom) / 2 - (top + bottom) * scale / 2;
  effect.origin.x -= (left + right) * scale / 2;

  // A named anchor is a fraction of the visible body's height: 0 is the head,
  // 1 is the feet, and 0.58 is the waist. Sheet offsets stay relative to that point.
  if (Number.isFinite(effect.definition.targetAnchorY)) {
    effect.origin.y = bounds.top + (bounds.bottom - bounds.top) * effect.definition.targetAnchorY;
  }
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
  if (effect.casterSizeBounds) return;
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

// Center both sphere layers on the recipient and keep their scale equal on both
// axes. Enclosing the silhouette's diagonal preserves a sphere instead of an oval.
function fitWard(scene, effect) {
  const bounds = visibleUnitBounds(scene, effect.target);
  effect.origin = { ...effect.origin, x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2 };
  effect.scaleX = effect.scaleY = shieldSphereScale(bounds);
}

// Offensive artwork uses its caster's body size. Placed gemstones and gameplay
// floor fields retain their sizing; warning geometry remains independent of impacts.
function startEffect(scene, caster, target, ability, definition, action = null, recipients = [target]) {

  // Brambles belongs to its owner's saved zone, but its art stays on the captured
  // ground point. Walking targets and later caster movement cannot drag the field.
  if (definition.groundZone && Number.isFinite(caster.arenaX)) target = caster;
  const groundRecord = definition.groundZone ? target.status?.replacementZones?.find(record =>
    record.ability?.id === definition.abilityId && record.until > (scene.time?.now ?? 0)
      && record.wave === scene.currentWaveIndex) : null;
  if (definition.groundZone && !groundRecord) return false;

  // The aura belongs to its caster even when the AI selected a nearby ally.
  if ((definition.floorAura || definition.targetCaster) && Number.isFinite(caster.arenaX)) target = caster;
  if (!definition.clips.every(clip => scene.textures.exists(clip.key))) return false;
  if (definition.persistentStatus) {
    if (!effectStatusActive(target, definition, scene.time?.now ?? 0, scene.currentWaveIndex)) return false;

    // Refresh the running ring without adding duplicate artwork or resetting its
    // animation. A status reapplied during its fade restores normal opacity.
    const current = scene.abilityEffects?.find(effect => effect.target === target
      && effect.definition === definition && !effect.retiredGround);
    if (current) {
      if (groundRecord && (current.anchor.arenaX !== groundRecord.point.arenaX
        || current.anchor.arenaY !== groundRecord.point.arenaY)) {

        // A replacement field leaves a fading remnant at its old ground point.
        // Start the new field below rather than teleporting the old drawing.
        current.retiredGround = true;
        current.fadeElapsed = 0;
      } else {
        if (groundRecord) current.anchor = groundRecord.point;
        current.fadeElapsed = null;
        return true;
      }
    }
  }
  const anchor = groundRecord ? groundRecord.point : definition.recipientAnchor ? target : ability.replacement ? ability.anchor === 'Caster' ? caster : target
    : ability.radius && !definition.fitTarget ? caster : target;
  const origin = scene.battlefield.arenaToScreen(anchor.arenaX, anchor.arenaY);
  const radius = definition.singleTargetArtwork ? null : ability.replacement && ability.shape === 'Circle'
    ? ability.radius / ADJACENT_DISTANCE : ability.zone ?? ability.radius ?? ability.splash;
  const diameter = (radius ? 2 * radius * ADJACENT_DISTANCE : 200)
    * origin.widthAtDepth / scene.battlefield.logicalWidth;
  const offensive = !caster.isEnemy && !definition.healing && !RUNEDANCER_EFFECTS.includes(definition)
    && !['heal', 'mana', 'refill'].includes(definition.vfxPhase)
    && !(definition.groundZone && definition.groundFootprint) && !definition.floorAura
    && (target.isEnemy || recipients.some(unit => unit?.isEnemy) || /enem/i.test(ability.targetLabel ?? ''));

  // Restored statuses may supply only a class name. Recover the saved owner first,
  // then use a matching adventurer for old records that did not retain a source.
  const records = [...(target.status?.replacementEffects ?? []), ...(target.status?.replacementPeriodic ?? []),
    ...(target.status?.replacementReactions ?? [])];
  const ownerId = records.find(record => record.ability?.id === definition.abilityId
    || record.key?.startsWith(definition.abilityId + ':'))?.ownerId;
  const sizingCaster = caster.spriteVisual || Number.isFinite(caster.arenaX) ? caster
    : scene.partyUnits?.find(unit => unit.id === ownerId)
      ?? scene.partyUnits?.find(unit => unit.className === caster.className) ?? scene.partyUnits?.[0];
  const casterSizeBounds = offensive && sizingCaster ? visibleUnitBounds(scene, sizingCaster) : null;
  const clipsWidth = Math.max(...definition.clips.map(clip => clip.x + clip.width))
    - Math.min(...definition.clips.map(clip => clip.x));
  const clipsHeight = Math.max(...definition.clips.map(clip => clip.y + clip.height))
    - Math.min(...definition.clips.map(clip => clip.y));
  const scale = casterSizeBounds
    ? Math.min((casterSizeBounds.right - casterSizeBounds.left) / clipsWidth,
      (casterSizeBounds.bottom - casterSizeBounds.top) / clipsHeight) * (definition.targetSize ?? 1.25)
    : Math.max(1, Math.round(diameter * (definition.sizeMultiplier ?? 1) / definition.groundWidth));
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
    if (clip.tint != null) image.setTint(clip.tint);

    // Crop coordinates are pixels inside each sheet cell and follow frame changes.
    // Keeping the original cell size preserves the floating marker's placement.
    if (clip.crop) image.setCrop(clip.crop.x, clip.crop.y, clip.crop.width, clip.crop.height);
    return { clip, image };
  });
  const effect = { definition, caster, target, anchor, recipients, action, origin, scale, casterSizeBounds,
    groundRadius: groundRecord?.ability.radius ?? definition.groundFootprint?.arenaRadius,
    scaleX: scale * (definition.widthStretch ?? 1), scaleY: scale, pieces, elapsed: 0,
    duration: definition.untilDeath || definition.followShield || definition.persistentStatus ? Infinity
      : action?.duration ?? (definition.holdMs ?? definition.frames * definition.frameMs) + (definition.fadeMs ?? 0),
    flightStart: action ? scene.battlefield.arenaToScreen(caster.arenaX, caster.arenaY) : null,
    zone: definition.id === 'volley' ? createZone(scene, caster, target, ability) : null };
  scene.abilityEffects.push(effect);
  if (definition.fitTarget) fitTarget(scene, effect);
  else if (definition.coverUnits) fitCoverage(scene, effect);

  // Apply small cosmetic reductions after fitting. Rounding beforehand can erase
  // a 15% adjustment; uniform scaling preserves the art's shape and gameplay radius.
  effect.scaleX *= definition.artworkScale ?? 1;
  effect.scaleY *= definition.artworkScale ?? 1;
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
  const fadeAge = effect.fadeElapsed ?? (effect.definition.persistentStatus ? 0
    : effect.elapsed - effect.definition.holdMs);
  const fadeProgress = effect.definition.fadeMs
    ? Math.max(0, Math.min(1, fadeAge / effect.definition.fadeMs)) : 0;
  for (const { clip, image } of effect.pieces) {
    const age = frame - clip.start;
    const localFrame = clip.loop && age >= 0 ? age % clip.frames
      : clip.holdLastFrame && age >= clip.frames ? clip.frames - 1 : age;
    const visible = localFrame >= 0 && localFrame < clip.frames;
    image.setVisible(visible);
    if (!visible) continue;

    // Offsets place the supplied parts around one origin. Volley's travel is baked
    // into its frames; only separate projectile packs receive additional flight motion.

    // Ground cracks keep the floor's flattened projection. Upright light uses
    // uniform scale so its height rises through bodies instead of lying on the floor.
    const scaleY = clip.upright ? effect.scaleX : effect.scaleY;
    image.setAlpha((effect.definition.opacity ?? 1) * (clip.opacity ?? 1) * (1 - fadeProgress))
      .setScale(effect.scaleX, scaleY).setFrame(localFrame).setPosition(
      effect.origin.x + clip.x * effect.scaleX,
      effect.origin.y + clip.y * scaleY
    );

    // An ellipse's upper half is farther from the viewer. Move the crop boundary
    // with the rising ring, in sheet pixels, so the body hides only that far half.
    // Both images keep the same origin, animation frame and fade opacity.
    if (clip.wrapHalf) {
      const progress = localFrame / Math.max(1, clip.frames - 1);
      const split = Math.round(clip.splitY.from + (clip.splitY.to - clip.splitY.from) * progress);
      const top = clip.wrapHalf === 'behind' ? 0 : split;
      const height = clip.wrapHalf === 'behind' ? split : clip.height - split;
      image.setCrop(0, top, clip.width, height);
    }
  }
}

// Front layers use the foremost recipient's unit depth. Updating depth does not move
// fixed area art and keeps it over affected units whose positions change afterward.
function updateEffectDepth(scene, effect) {

  // Match authored ground artwork to the real floor projection. Sheet radius is in
  // artwork pixels; arena radius is in combat units. This does not change targeting.
  if (effect.definition.groundFootprint && !effect.casterSizeBounds) {
    const footprint = effect.definition.groundFootprint;
    const radii = scene.battlefield.getGroundEllipseRadii(effect.groundRadius, effect.anchor.arenaY);
    effect.scaleX = radii.width / footprint.radius;
    effect.scaleY = radii.height / (footprint.radius * footprint.squash);
  }

  // Aura rings keep their floor footprint. The sheet has a 39-pixel radius and a 0.5
  // squash; fit both axes to the real healing radius projected onto this floor.
  if (effect.definition.floorAura) {
    const record = effect.target.status?.replacementZones?.find(zone => zone.ability.id === effect.definition.abilityId);
    const radii = scene.battlefield.getGroundEllipseRadii(record?.ability.radius ?? 240, effect.target.arenaY);
    effect.scaleX = radii.width / 39;
    effect.scaleY = radii.height / 19.5;

    // Continue into the shared wrapping depth so the sprite hides the far arc,
    // while the near arc crosses in front, just as it does for Spellward.
  }
  if (!effect.definition.coverUnits && !effect.definition.followTarget) return;
  const units = effect.definition.coverUnits ? effect.recipients : [effect.anchor];
  const depth = Math.max(...units.map(unit => unit.container?.depth
    ?? 100 + scene.battlefield.arenaToScreen(unit.arenaX, unit.arenaY).y)) + 1;
  for (const piece of effect.pieces) {

    // Normally depth is one step above the body. Wrapped far halves sit one step
    // below it, allowing the character silhouette to occlude the rear arc.
    const behind = !effect.definition.coverUnits
      && (piece.clip.depth === 'behind' || piece.clip.wrapHalf === 'behind');
    piece.image.setDepth(behind ? depth - 2 : depth);
  }
}

// Optional status fields are already part of battle snapshots. Recreate persistent
// art after reload or background catch-up without replaying old casts or damage.
function restorePersistentEffects(scene) {
  const now = scene.time?.now ?? 0;
  const units = [...(scene.partyUnits ?? []), ...(scene.enemies ?? []), ...(scene.abilityDecoys ?? [])];
  for (const target of units) {
    if (!target.alive) continue;
    const requests = [];
    for (const definition of [...MAGICAL_PROTECTION_EFFECTS, ...MAGICAL_ASSAULT_EFFECTS,
      ...OATHWARDEN_ASSAULT_EFFECTS, ...GLADIATOR_ASSAULT_EFFECTS, ...DAWNWARDEN_ASSAULT_EFFECTS,
      ...OATHWARDEN_PROTECT_EFFECTS, ...GLADIATOR_PROTECT_EFFECTS, ...GENERIC_RESTORE_EFFECTS,
      ...GROVEKEEPER_EFFECTS, ...RANGER_ABILITY_EFFECTS, ...DAWNPRIEST_EFFECTS,
      ...BARBARIAN_ABILITY_EFFECTS, ...BARMAID_ABILITY_EFFECTS, ...UMBRAMANCER_EFFECTS, ...RUNEDANCER_EFFECTS]) {
      if (definition.persistentStatus && definition.restoreFromStatus !== false
        && effectStatusActive(target, definition, now, scene.currentWaveIndex)) {
        requests.push([{ className: definition.className }, { id: definition.abilityId,
          name: definition.abilityName, vfxPhase: definition.vfxPhase }]);
      }
    }
    if (target.status?.huntersMarkVisual && !(scene.partyUnits ?? []).some(unit =>
      Object.values(unit.abilities ?? {}).some(ability => ability.id === 'ability_v2_ranger_hunter_s_mark'))) {
      requests.push([{ className: 'Ranger' }, { name: "Hunter's Mark" }]);
    }
    if (target.status?.sunlitWardVisualUntil > now && target.status.temporaryHp > 0) {
      requests.push([{ className: 'Dawnwarden' }, { name: 'Sunlit Ward',
        duration: target.status.sunlitWardVisualUntil - now }]);
    }
    for (const [caster, ability] of requests) {
      if (scene.abilityEffects?.some(effect => effect.target === target
        && effect.definition.abilityName === ability.name && effect.definition.vfxPhase === ability.vfxPhase)) continue;
      createAbilityEffect(scene, caster, target, ability);
    }
  }
}

// Flights track the target over the already scheduled windup. Pivot around the supplied
// artwork origin so rotation points the arrow/orb along its screen-space travel line.
function drawFlight(scene, effect) {
  fitTarget(scene, effect);
  const end = scene.battlefield.arenaToScreen(effect.target.arenaX, effect.target.arenaY);
  const start = effect.flightStart;
  const progress = Math.min(1, effect.elapsed / effect.duration);

  // Aim at the visible body center. A fixed lift above the feet misses short
  // creatures and lands too low on bosses; screen bounds already include perspective.
  const bounds = visibleUnitBounds(scene, effect.target);
  const endX = (bounds.left + bounds.right) / 2;
  const endY = (bounds.top + bounds.bottom) / 2;
  const launchY = start.y - 65 * start.widthAtDepth / scene.battlefield.logicalWidth;
  const dx = endX - start.x, dy = endY - launchY;
  for (const { clip, image } of effect.pieces) {
    image.setOrigin(-clip.x / clip.width, -clip.y / clip.height)
      .setScale(effect.scaleX, effect.scaleY)
      .setPosition(start.x + dx * progress, launchY + dy * progress)
      .setRotation(Math.atan2(dy, dx)).setDepth(101 + start.y + (end.y - start.y) * progress);
  }
}

// Pause freezes movement and frames. Catch-up drops historical cosmetic effects.
export function updateAbilityEffects(scene, delta, replaying = false) {
  updateTravelingEffects(scene, delta, replaying);
  if (replaying) {
    clearRuneShatterEffects(scene);
    clearUmbralDecoyEffects(scene);
    if (scene.abilityEffects?.length || scene.abilityTelegraphs?.length || scene.physicalAbilityEffects?.length || scene.physicalAssaultEffects?.length || scene.prepareAbilityEffects?.length) clearAbilityEffects(scene);
    return;
  }
  if (canDraw(scene)) restorePersistentEffects(scene);

  // Status art shares the same combat pause, replay and shutdown lifecycle as sheets.
  if (!scene.idleSimulating && !scene.game.backgroundProgress?.isReplaying) {
    updateUmbralDecoyEffects(scene, delta);
    if (scene.partyUnits?.length || scene.enemies?.length || scene.physicalAbilityEffects?.length || scene.prepareAbilityEffects?.length) prepareEffects(scene);
    updatePhysicalAbilityEffects(scene, delta, visibleUnitBounds);
    updatePrepareAbilityEffects(scene, delta, visibleUnitBounds);
    updateRuneShatterEffects(scene, delta);
  }
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
    if (!scene.combatPaused && !effect.retiredFlight) effect.elapsed += Math.max(0, delta);

    // Flights freeze their position once they land or are canceled. Their final
    // opacity still advances on combat time, with no hidden wall-clock tween.
    if (effect.definition.projectile) {
      const ended = scene.battleOver || !effect.caster.alive || !effect.target.alive
        || effect.caster.pendingAction !== effect.action || effect.elapsed >= effect.duration;
      if (ended && !effect.retiredFlight) {
        effect.retiredFlight = true;
        effect.fadeElapsed = 0;
      } else if (effect.retiredFlight && !scene.combatPaused) effect.fadeElapsed += Math.max(0, delta);
    }

    // A removed status leaves only cosmetic artwork for 400 combat milliseconds.
    // The timer freezes on pause, and restoring a saved active status recreates it.
    if (effect.definition.persistentStatus) {
      const activeGround = !effect.definition.groundZone || effect.target.status?.replacementZones?.some(record =>
        record.ability?.id === effect.definition.abilityId && record.point === effect.anchor);
      const active = !scene.battleOver && !effect.retiredGround && activeGround
        && effectStatusActive(effect.target, effect.definition, scene.time?.now ?? 0, scene.currentWaveIndex);
      if (active) effect.fadeElapsed = null;
      else if (effect.fadeElapsed == null) effect.fadeElapsed = 0;
      else if (!scene.combatPaused) effect.fadeElapsed += Math.max(0, delta);
    }

    // Brief magical effects also fade if the recipient dies or combat finishes.
    // Their regular final-frame fade continues to use elapsed combat time.
    if (effect.definition.abilityId && !effect.definition.persistentStatus
      && (!effect.target.alive || scene.battleOver)) {
      if (effect.fadeElapsed == null) effect.fadeElapsed = Math.max(0, effect.elapsed - effect.definition.holdMs);
      else if (!scene.combatPaused) effect.fadeElapsed += Math.max(0, delta);
    }
    const canceledFlight = effect.action && !effect.definition.projectile && (!effect.caster.alive || !effect.target.alive
      || effect.caster.pendingAction !== effect.action);
    const endedMark = effect.definition.untilDeath && !effect.target.alive;
    const endedWard = effect.definition.followShield && (!effect.target.alive
      || !(effect.target.status?.temporaryHp > 0)
      || scene.battleOver || (scene.time?.now ?? 0) >= (effect.target.status?.sunlitWardVisualUntil ?? 0));

    // Absorbed or expired wards keep their last loop while fading for 400 combat
    // milliseconds. Both sphere layers pause together and follow the recipient.
    if (endedWard) {
      if (effect.fadeElapsed == null) effect.fadeElapsed = 0;
      else if (!scene.combatPaused) effect.fadeElapsed += Math.max(0, delta);
    } else if (effect.definition.followShield) effect.fadeElapsed = null;

    // Every gemstone breaks from its current visible frame instead of fading whole.
    // Remove its main effect now so it cannot spawn another set of fragments.
    const runeEnded = effect.definition.persistentStatus ? effect.fadeElapsed != null
      : effect.fadeElapsed != null || effect.elapsed >= effect.definition.holdMs;
    if (effect.definition.shatterOnEnd && runeEnded && !scene.battleOver) {
      shatterRuneEffect(scene, effect);
      continue;
    }
    const fadedStatus = effect.fadeElapsed >= effect.definition.fadeMs;
    if (effect.elapsed >= effect.duration && !effect.definition.projectile || fadedStatus || canceledFlight || endedMark
      || scene.battleOver && !effect.definition.abilityId && !effect.definition.projectile && !effect.definition.followShield) {
      for (const piece of effect.pieces) piece.image.destroy();
      effect.zone?.destroy();
    } else {
      if (effect.definition.followTarget) {
        effect.origin = scene.battlefield.arenaToScreen(effect.anchor.arenaX, effect.anchor.arenaY);
        if (effect.definition.fitTarget) fitTarget(scene, effect);
        if (effect.definition.surroundTarget) fitWard(scene, effect);
      }
      updateEffectDepth(scene, effect);
      if (effect.retiredFlight) {

        // Retired flights keep their last screen position while their opacity fades.
        // Redrawing their sheet as a ground impact would make the remnant jump.
        for (const piece of effect.pieces) piece.image.setAlpha(1 - effect.fadeElapsed / effect.definition.fadeMs);
      } else {
        drawEffect(effect);
        if (effect.action) drawFlight(scene, effect);
      }
      remaining.push(effect);
    }
  }
  scene.abilityEffects = remaining;
}
