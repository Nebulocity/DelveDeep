// PixelLab artwork is cosmetic; combat damage and warning positions stay in BattleScene.
import { SLIME_ABILITY_EFFECTS, SLIME_GLOB_PROJECTILE } from '../data/slimeAbilityEffects.js';
import { visibleUnitBounds } from './AbilityEffect.js';

const FADE_MS = 400;

// Keep the short cleanup list ready and remove every cosmetic image on scene shutdown.
function prepare(scene) {
  if (scene.slimeAbilityEffectsCleanupInstalled) return;
  scene.slimeAbilityEffects = [];
  scene.slimeTelegraphFades = [];
  scene.slimeGlobFlights = [];
  scene.slimeAbilityEffectsCleanupInstalled = true;

  scene.events.once('shutdown', () => {
    clearSlimeAbilityEffects(scene);
    scene.slimeAbilityEffectsCleanupInstalled = false;
  });
}

// Tear down images immediately when leaving combat or replaying old combat history.
export function clearSlimeAbilityEffects(scene) {
  for (const flight of scene.slimeGlobFlights ?? []) flight.image.destroy();
  for (const effect of scene.slimeAbilityEffects ?? []) effect.image.destroy();
  for (const fade of scene.slimeTelegraphFades ?? []) {
    fade.telegraph.warning?.destroy();
    fade.telegraph.inner?.destroy();
  }
  scene.slimeAbilityEffects = [];
  scene.slimeTelegraphFades = [];
  scene.slimeGlobFlights = [];
}

// Use visible body bounds, excluding transparent sprite padding, for mouth and chest anchors.
function bodyPoint(scene, unit, heightFraction) {
  const bounds = visibleUnitBounds(scene, unit);
  return { x: (bounds.left + bounds.right) / 2,
    y: bounds.top + (bounds.bottom - bounds.top) * heightFraction };
}

// A normal glob follows its target's chest; the boss glob lands on its fixed warning center.
function globDestination(scene, flight) {
  return flight.center
    ? scene.battlefield.arenaToScreen(flight.center.arenaX, flight.center.arenaY)
    : bodyPoint(scene, flight.target, 0.55);
}

// Launch during the existing cast, so the lob arrives at the scheduled damage time.
export function startSlimeGlobFlight(scene, attacker, target, ability, action, center = null) {
  if (ability?.name !== 'Toxic Glob' || !action || !attacker.alive
    || (!center && (!target?.alive || target.stealthed))
    || !scene.textures?.exists?.(SLIME_GLOB_PROJECTILE.key)
    || scene.game.backgroundProgress?.isReplaying || scene.idleSimulating || scene.battleOver) return false;

  prepare(scene);
  if (scene.slimeGlobFlights.some(flight => flight.action === action)) return true;

  const from = bodyPoint(scene, attacker, 0.65);
  const image = scene.add.image(from.x, from.y, SLIME_GLOB_PROJECTILE.key, 0)
    .setOrigin(0.5).setDisplaySize(42, 48).setDepth(4000);
  const flight = { image, attacker, target, action, center, from,
    elapsed: Math.max(0, (scene.time?.now ?? action.startAt) - action.startAt), fadeElapsed: null };
  const to = globDestination(scene, flight);

  // This height is in screen pixels. Longer throws rise farther, with a readable 70-220 px lift.
  flight.arcHeight = Math.max(70, Math.min(220, Math.hypot(to.x - from.x, to.y - from.y) * 0.28));
  scene.slimeGlobFlights.push(flight);
  drawGlobFlight(scene, flight);
  return true;
}

// Place the projectile on a parabola: 4*t*(1-t) is zero at either end and one halfway.
function drawGlobFlight(scene, flight) {
  const progress = Math.max(0, Math.min(1,
    ((scene.time?.now ?? flight.action.startAt) - flight.action.startAt) / Math.max(1, flight.action.duration)));
  const to = globDestination(scene, flight);
  const x = flight.from.x + (to.x - flight.from.x) * progress;
  const y = flight.from.y + (to.y - flight.from.y) * progress
    - 4 * flight.arcHeight * progress * (1 - progress);
  flight.image.setPosition(x, y);
}

// The hit handler calls this before finishing the action, aligning touchdown with damage.
export function landSlimeGlobFlight(scene, attacker, action) {
  for (const flight of scene.slimeGlobFlights ?? []) {
    if (flight.attacker !== attacker || flight.action !== action || flight.fadeElapsed !== null) continue;

    const to = globDestination(scene, flight);
    flight.image.setPosition(to.x, to.y);
    flight.fadeElapsed = 0;
  }
}

// Rebuild cosmetic flight from existing saved actions/events, without adding save fields.
function restoreGlobFlights(scene) {
  for (const event of scene.battleEvents ?? []) {
    const data = event.data;
    if (data?.kind !== 'enemyAbility' && data?.kind !== 'groundSlam') continue;

    const attacker = scene.enemies?.find(unit => unit.id === data.unitId);
    const action = attacker?.pendingAction;
    if (!action || action.startAt !== data.actionStartAt) continue;

    const ability = data.kind === 'groundSlam' ? data.ability : attacker.abilities?.[data.key];
    const target = scene.partyUnits?.find(unit => unit.id === data.targetId);
    if (ability?.name === 'Toxic Glob' && (target || data.center)) {
      startSlimeGlobFlight(scene, attacker, target, ability, action, data.center ?? null);
    }
  }
}

// Play one authored sheet at an arena point, fitting ground attacks to their warning size.
export function playSlimeAbilityEffect(scene, abilityName, point, radius = 0) {
  const definition = SLIME_ABILITY_EFFECTS[abilityName];
  if (!definition || !scene.textures?.exists?.(definition.key)
    || scene.game.backgroundProgress?.isReplaying || scene.idleSimulating || scene.battleOver) return false;

  prepare(scene);

  // Arena coordinates project onto the same floor position used by damage circles.
  const position = abilityName === 'Toxic Glob' && radius === 0
    ? bodyPoint(scene, point, 0.55) : scene.battlefield.arenaToScreen(point.arenaX, point.arenaY);
  const depth = abilityName === 'Toxic Glob' ? 4000 : 45 + position.y;
  const image = scene.add.image(position.x, position.y, definition.key, 0)
    .setOrigin(0.5, abilityName === 'Toxic Glob' ? 20 / 43 : 0.5)
    .setDepth(depth);

  if (radius > 0) {
    const ellipse = scene.battlefield.getGroundEllipseRadii(radius, point.arenaY);
    image.setDisplaySize(ellipse.width * 2, ellipse.height * 2);
  } else {
    image.setDisplaySize(definition.frameWidth * 1.6, definition.frameHeight * 1.6);
  }

  scene.slimeAbilityEffects.push({ image, definition, elapsed: 0, position });
  return true;
}

// Retire Slime Cave warnings from hazard checks first, then fade their drawings on combat time.
export function fadeSlimeTelegraph(scene, telegraph) {
  if (!SLIME_ABILITY_EFFECTS[telegraph.ability?.name]) return false;

  prepare(scene);
  if (!scene.slimeTelegraphFades.some(fade => fade.telegraph === telegraph)) {
    scene.slimeTelegraphFades.push({ telegraph, elapsed: 0,
      warningAlpha: telegraph.warning?.alpha ?? 1, innerAlpha: telegraph.inner?.alpha ?? 1 });
  }
  return true;
}

// Advance sprite frames and opacity only while combat time is moving.
export function updateSlimeAbilityEffects(scene, delta) {
  if (scene.game.backgroundProgress?.isReplaying || scene.idleSimulating) {
    clearSlimeAbilityEffects(scene);
    return;
  }

  const elapsedDelta = scene.combatPaused ? 0 : Math.max(0, delta);
  restoreGlobFlights(scene);

  // Interrupted throws freeze where they are and fade. Landed throws fade beside the splash.
  scene.slimeGlobFlights = (scene.slimeGlobFlights ?? []).filter(flight => {
    flight.elapsed += elapsedDelta;
    if (flight.fadeElapsed === null && (!flight.attacker.alive || scene.battleOver
      || flight.attacker.pendingAction !== flight.action
      || (!flight.center && (!flight.target.alive || flight.target.stealthed)))) {
      flight.fadeElapsed = 0;
    }
    if (flight.fadeElapsed === null) drawGlobFlight(scene, flight);
    else flight.fadeElapsed += elapsedDelta;

    // Frame speed stays at 18 FPS; flight time follows the monster's real cast duration.
    flight.image.setFrame(Math.floor(flight.elapsed * SLIME_GLOB_PROJECTILE.fps / 1000)
      % SLIME_GLOB_PROJECTILE.frames).setAlpha(1 - (flight.fadeElapsed ?? 0) / FADE_MS);
    if (flight.fadeElapsed >= FADE_MS) {
      flight.image.destroy();
      return false;
    }
    return true;
  });

  // Slime Cave warning rings grow on combat time, so Pause freezes their fill.
  for (const telegraph of scene.activeTelegraphs ?? []) {
    if (!SLIME_ABILITY_EFFECTS[telegraph.ability?.name]) continue;

    telegraph.visualElapsed = (telegraph.visualElapsed ?? 0) + elapsedDelta;
    const progress = Math.min(1, telegraph.visualElapsed / Math.max(1, telegraph.duration));
    const ellipse = scene.battlefield.getGroundEllipseRadii(telegraph.radius, telegraph.arenaY);
    telegraph.inner?.setDisplaySize(Math.max(32, ellipse.width * 2 * progress),
      Math.max(16, ellipse.height * 2 * progress)).setAlpha(0.35 - progress * 0.27);
  }

  // A one-shot lasts exactly as long as its 32 frames, then uses its last 400 ms to fade.
  scene.slimeAbilityEffects = (scene.slimeAbilityEffects ?? []).filter(effect => {
    effect.elapsed += elapsedDelta;
    const duration = effect.definition.frames * 1000 / effect.definition.fps;
    const frame = Math.min(effect.definition.frames - 1,
      Math.floor(effect.elapsed / duration * effect.definition.frames));
    const fadeStart = Math.max(0, duration - effect.definition.fadeMs);
    const alpha = effect.elapsed <= fadeStart ? 1
      : Math.max(0, 1 - (effect.elapsed - fadeStart) / effect.definition.fadeMs);

    effect.image.setFrame(frame).setAlpha(alpha);
    if (effect.elapsed >= duration) {
      effect.image.destroy();
      return false;
    }
    return true;
  });

  // Warning circles stop being hazards at once but their artwork remains visible briefly.
  scene.slimeTelegraphFades = (scene.slimeTelegraphFades ?? []).filter(fade => {
    fade.elapsed += elapsedDelta;
    const alpha = Math.max(0, 1 - fade.elapsed / FADE_MS);
    fade.telegraph.warning?.setAlpha(fade.warningAlpha * alpha);
    fade.telegraph.inner?.setAlpha(fade.innerAlpha * alpha);
    if (fade.elapsed >= FADE_MS) {
      fade.telegraph.warning?.destroy();
      fade.telegraph.inner?.destroy();
      return false;
    }
    return true;
  });
}
