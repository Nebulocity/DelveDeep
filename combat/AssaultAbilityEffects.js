// Physical strikes use small transparent sheets and the same combat time as statuses.
// These drawings never change damage, movement, ability IDs or saved battle records.

const PREFIX = 'ability_v2_generic_physical_';
const FPS = 24;
const FRAMES = 32;
const FADE_MS = 400;
const STRIKES = ['charge', 'cleave', 'kick', 'lacerate'];

// Tell damage feedback when authored art replaces the ordinary white melee pulse.
export function hasAssaultAbilityEffect(ability) {
  return ability.id?.startsWith(PREFIX) && STRIKES.includes(ability.id.slice(PREFIX.length));
}

export const ASSAULT_EFFECT_SHEETS = [
  { name: 'charge-trail', width: 85, height: 39, x: 60, y: 20 },
  { name: 'charge-impact', width: 39, height: 34, x: 16, y: 16 },
  { name: 'cleave', width: 49, height: 45, x: 22, y: 27 },
  { name: 'kick', width: 28, height: 23, x: 13, y: 11 },
  { name: 'lacerate', width: 26, height: 29, x: 12, y: 16 }
].map(sheet => ({ ...sheet, key: 'physical-' + sheet.name,
  url: new URL(`../assets/effects/generic-physical/${sheet.name}.png`, import.meta.url).href }));

// The pivot is the exported hit point in artwork pixels, measured from the top left.
// Loading finished PNGs keeps PixelLab and its credentials out of the shipped game.
export function preloadAssaultAbilityEffects(scene) {
  for (const sheet of ASSAULT_EFFECT_SHEETS) {
    if (!scene.textures.exists(sheet.key)) scene.load.spritesheet(sheet.key, sheet.url, {
      frameWidth: sheet.width, frameHeight: sheet.height, endFrame: FRAMES - 1
    });
  }
}

// Only current periodic damage keeps Lacerate's small side cue alive. This also reads
// restored saves and ends on cleanse, the last damage tick, death or victory.
function lacerateActive(scene, target) {
  return target.alive && !scene.battleOver && target.status?.replacementPeriodic?.some(tick =>
    tick.ability?.id === PREFIX + 'lacerate' && tick.kind === 'damage'
    && tick.remaining > 0 && tick.until > (scene.time?.now ?? 0));
}

// Each strike may hit several recipients, but a trail or status has only one drawing.
function addEffect(scene, caster, target, type, source = null) {
  const effects = scene.physicalAssaultEffects ??= [];
  const persistent = type === 'charge-trail' || type === 'lacerate-status';
  const existing = persistent && effects.find(effect => effect.type === type && effect.target === target && effect.source === source);
  if (existing) {
    existing.fadeElapsed = null;
    return existing;
  }
  const name = type === 'charge' ? 'charge-impact' : type === 'lacerate-status' ? 'lacerate' : type;
  const sheet = ASSAULT_EFFECT_SHEETS.find(entry => entry.name === name);
  if (!sheet || !scene.textures.exists(sheet.key)) return null;
  scene.textures.get(sheet.key).setFilter(1);
  const image = scene.add.image(0, 0, sheet.key, 0).setOrigin(sheet.x / sheet.width, sheet.y / sheet.height);
  const effect = { caster, target, type, source, sheet, image, elapsed: 0, fadeElapsed: null, angle: 0 };
  effects.push(effect);
  return effect;
}

// The resolver supplies actual landed recipients, so dodged direct hits have no spark.
// Lacerate is applied periodic damage rather than a second immediate attack.
export function createAssaultAbilityEffect(scene, caster, target, ability, recipients) {
  const type = ability.id?.startsWith(PREFIX) ? ability.id.slice(PREFIX.length) : null;
  if (!STRIKES.includes(type)) return false;
  for (const recipient of new Set(recipients ?? [target])) {
    if (recipient) addEffect(scene, caster, recipient, type);
  }
  return true;
}

// Project Charge's actual direction onto the screen, where artwork faces right.
// Freeze that direction during fading so a canceled charge cannot flip its old trail.
function drawEffect(scene, effect, getBounds) {
  const { target, caster, type, sheet, image } = effect;
  const bounds = getBounds(scene, target);
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const ownerId = target.status?.replacementPeriodic?.find(tick => tick.ability?.id === PREFIX + 'lacerate')?.ownerId;
  const sizingCaster = caster ?? scene.partyUnits?.find(unit => unit.id === ownerId) ?? scene.partyUnits?.[0];

  // Impact size comes from the adventurer; placement still follows the victim.
  const sizeBounds = target.isEnemy && sizingCaster && !sizingCaster.isEnemy ? getBounds(scene, sizingCaster) : bounds;
  const sizeWidth = sizeBounds.right - sizeBounds.left;
  const sizeHeight = sizeBounds.bottom - sizeBounds.top;
  const trail = type === 'charge-trail';
  const status = type === 'lacerate-status';
  const size = Math.max(status ? 0.65 : 0.9, Math.min(3,
    (trail ? sizeWidth * 1.6 : status ? sizeHeight * 0.24 : sizeHeight * 0.65) / sheet.width));
  let x = (bounds.left + bounds.right) / 2;
  let y = bounds.top + height * 0.62;
  if (trail) {
    if (effect.fadeElapsed === null) {
      const start = scene.battlefield.arenaToScreen(effect.source.startX, effect.source.startY);
      const end = scene.battlefield.arenaToScreen(effect.source.point.x, effect.source.point.y);
      effect.angle = Math.atan2(end.y - start.y, end.x - start.x);
    }

    // The pivot sits just behind the body; the longer tail extends farther backward.
    x -= Math.cos(effect.angle) * width * 0.3;
    y -= Math.sin(effect.angle) * width * 0.3;
  } else if (status) {
    x = bounds.right + 8 * size;
    y = bounds.top + height * 0.7;
  } else {
    const casterBounds = getBounds(scene, caster);
    image.setFlipX((casterBounds.left + casterBounds.right) / 2 > x);
  }

  // A strike starts its opacity fade before the sheet's transparent end frames.
  // A stopped loop keeps its last visible frame, making cancellation fade smoothly.
  const loop = trail || status;
  const frame = Math.floor(effect.elapsed * FPS / 1000);
  if (effect.fadeElapsed === null || !loop) image.setFrame(loop ? frame % (status ? 24 : FRAMES) : Math.min(FRAMES - 1, frame));
  image.setPosition(x, y).setScale(size).setRotation(trail ? effect.angle : 0)
    .setDepth((target.container?.depth ?? 100 + bounds.bottom) + (trail ? -1 : 1))
    .setAlpha((trail ? 0.72 : status ? 0.55 : 0.85) * (1 - (effect.fadeElapsed ?? 0) / FADE_MS));
}

// Discover live charge movement rather than adding another gameplay callback. Saved
// active charges rebuild their trails; historical simulation never enters this update.
export function updateAssaultAbilityEffects(scene, delta, getBounds) {
  if (!scene.battleOver) {
    for (const target of [...(scene.partyUnits ?? []), ...(scene.enemies ?? [])]) {
      if (target.alive && target.charge?.ability?.id === PREFIX + 'charge') {
        addEffect(scene, target, target, 'charge-trail', target.charge);
      }
      if (lacerateActive(scene, target)) addEffect(scene, target, target, 'lacerate-status');
    }
  }
  const step = scene.combatPaused ? 0 : Math.max(0, delta);
  scene.physicalAssaultEffects = (scene.physicalAssaultEffects ?? []).filter(effect => {
    effect.elapsed += step;
    const holdMs = effect.type === 'kick' || effect.type === 'lacerate' ? 500 : 700;
    const active = effect.target.alive && !scene.battleOver && (effect.type === 'charge-trail'
      ? effect.target.charge === effect.source : effect.type === 'lacerate-status'
        ? lacerateActive(scene, effect.target) : effect.elapsed < holdMs);
    if (!active) {

      // A slow frame crossing the hold spends only leftover milliseconds on fading.
      const oneShot = effect.type !== 'charge-trail' && effect.type !== 'lacerate-status';
      const fadeStep = effect.fadeElapsed === null && oneShot && effect.target.alive && !scene.battleOver
        ? Math.min(step, Math.max(0, effect.elapsed - holdMs)) : step;
      effect.fadeElapsed = (effect.fadeElapsed ?? 0) + fadeStep;
    }
    if (effect.fadeElapsed >= FADE_MS) {
      effect.image.destroy();
      return false;
    }
    drawEffect(scene, effect, getBounds);
    return true;
  });
}

// Scene shutdown and replay can immediately release every cosmetic drawing.
export function clearAssaultAbilityEffects(scene) {
  for (const effect of scene.physicalAssaultEffects ?? []) effect.image.destroy();
  scene.physicalAssaultEffects = [];
}
