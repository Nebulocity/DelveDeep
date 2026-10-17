// Small pixel motifs sit beside the body or around the feet, leaving faces and weapons clear.
// Their lifetimes come from existing saved statuses, so visuals never change combat or saves.

import { preloadAssaultAbilityEffects, createAssaultAbilityEffect, updateAssaultAbilityEffects, clearAssaultAbilityEffects } from './AssaultAbilityEffects.js';
import { isBarmaidIntercept } from '../data/barmaidAbilityEffects.js';

const PREFIX = 'ability_v2_generic_physical_';
const FADE_MS = 400;
export const PHYSICAL_EFFECT_SHEETS = [
  { name: 'protection', width: 48, height: 48 },
  { name: 'disarm', width: 48, height: 48 },
  { name: 'hamstring', width: 64, height: 32 }
].map(sheet => ({ ...sheet, key: 'physical-' + sheet.name,
  url: new URL(`../assets/effects/generic-physical/${sheet.name}.png`, import.meta.url).href }));

// Finished PixelLab sheets ship with the game; there are no runtime service calls.
export function preloadPhysicalAbilityEffects(scene) {
  preloadAssaultAbilityEffects(scene);
  for (const sheet of PHYSICAL_EFFECT_SHEETS) {
    if (!scene.textures.exists(sheet.key)) scene.load.spritesheet(sheet.key, sheet.url, {
      frameWidth: sheet.width, frameHeight: sheet.height, endFrame: 31
    });
  }
}

const TYPES = ['disarm', 'hamstring', 'hold_the_line', 'interpose'];

// Read the actual effect rather than a separate cosmetic timer. Cleanse, interception,
// expiry and death can all end a visual early, including after a saved battle resumes.
export function physicalEffectActive(scene, target, type) {
  if (!target.alive || scene.battleOver) return false;
  const now = scene.time?.now ?? 0;
  if (type === 'disarm') return target.status?.replacementDisarmUntil > now;
  if (type === 'interpose') {
    const guard = target.status?.replacementIntercept;

    // A live Cover the Regulars cast has its own tray cue. Source-less records
    // restored from saves still use this shared protection badge until recast.
    if (isBarmaidIntercept(guard)) return false;
    const owner = scene.partyUnits?.find(unit => unit.id === guard?.ownerId);
    return guard?.until > now && Boolean(owner?.alive);
  }
  return target.status?.replacementEffects?.some(effect => effect.key === `${PREFIX}${type}:${type === 'hamstring' ? 'harmful' : 'beneficial'}` && effect.until > now) ?? false;
}

// Keep one motif per recipient and status. Refreshing a skill reuses its drawing;
// returning during its fade brings it back without stacking transparent remnants.
function ensureEffect(scene, target, type, brief = false, caster = null) {
  const effects = scene.physicalAbilityEffects ??= [];
  let effect = effects.find(entry => entry.target === target && entry.type === type && entry.brief === brief);
  if (effect) {
    if (caster) effect.caster = caster;
    if (brief) effect.elapsed = 0;
    effect.fadeElapsed = null;
    return;
  }
  const key = 'physical-' + (type === 'disarm' || type === 'hamstring' ? type : 'protection');
  if (!scene.textures.exists(key)) return;
  scene.textures.get(key).setFilter(1);
  effect = { target, caster, type, brief, elapsed: 0, fadeElapsed: null, image: scene.add.image(0, 0, key, 0) };
  effects.push(effect);
}

// Interpose has a short matching caster cue. Persistent recipient art is rebuilt
// from status records during update, including reload, without replaying this cue.
export function createPhysicalAbilityEffect(scene, caster, target, ability, recipients = [target]) {
  if (createAssaultAbilityEffect(scene, caster, target, ability, recipients)) return true;
  const type = ability.id?.startsWith(PREFIX) ? ability.id.slice(PREFIX.length) : null;
  if (!TYPES.includes(type)) return false;
  const recipient = type === 'hold_the_line' ? caster : target;
  if (physicalEffectActive(scene, recipient, type)) ensureEffect(scene, recipient, type, false, caster);
  if (type === 'interpose') ensureEffect(scene, caster, type, true);
  return true;
}

// Fit exported artwork to the visible body, excluding transparent sprite padding.
// Each 32-frame loop plays at 24 FPS; elapsed combat milliseconds also drive fading.
function drawEffect(scene, effect, bounds, getBounds) {
  const { target, type, image } = effect;
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const hamstring = type === 'hamstring';
  const protection = type === 'hold_the_line' || type === 'interpose';

  // Harmful cues keep their target anchor but use their adventurer's dimensions.
  // Older source-less disarms use a party member rather than a monster's size.
  const ownerId = target.status?.replacementEffects?.find(record => record.key === `${PREFIX}${type}:harmful`)?.ownerId;
  const caster = effect.caster ?? scene.partyUnits?.find(unit => unit.id === ownerId) ?? scene.partyUnits?.[0];
  const sizeBounds = !protection && target.isEnemy && caster && !caster.isEnemy ? getBounds(scene, caster) : bounds;
  const sizeWidth = sizeBounds.right - sizeBounds.left;
  const sizeHeight = sizeBounds.bottom - sizeBounds.top;

  // Side sheets are 48 pixels tall, including clear padding. Their canvas uses
  // 55% of body height; ankle bands instead span 115% of body width. Small-unit
  // minimums keep the icons visible on phones and maximums limit boss-size art.
  const size = hamstring ? Math.max(0.65, Math.min(3, sizeWidth * 1.15 / 64))
    : protection ? Math.min(3.2, width / 48, height * 0.55 / 48)
      : Math.max(1.2, Math.min(3.2, sizeHeight * 0.55 / 48));
  // Protection badges sit within their owner's lower silhouette. Keeping the
  // whole badge inside these bounds prevents it from hovering over a nearby ally.
  const x = hamstring ? (bounds.left + bounds.right) / 2
    : protection ? bounds.right - 24 * size : bounds.right + 15 * size;
  const y = hamstring ? bounds.bottom - height * 0.08 : bounds.top + height * 0.62;
  image.setPosition(x, y).setScale(size).setDepth((target.container?.depth ?? 100 + bounds.bottom) + 1);
  image.setFrame(Math.floor(effect.elapsed * 24 / 1000) % 32);
  image.setAlpha(0.9 * (1 - (effect.fadeElapsed ?? 0) / FADE_MS));
}

// Cosmetic time advances only with combat. Ended effects remain for a 400 ms fade,
// following the recipient while transparent, then release their Phaser drawing.
export function updatePhysicalAbilityEffects(scene, delta, getBounds) {
  updateAssaultAbilityEffects(scene, delta, getBounds);
  if (!scene.battleOver) {
    for (const target of [...(scene.partyUnits ?? []), ...(scene.enemies ?? [])]) {
      for (const type of TYPES) if (physicalEffectActive(scene, target, type)) ensureEffect(scene, target, type);
    }
  }
  const step = scene.combatPaused ? 0 : Math.max(0, delta);
  scene.physicalAbilityEffects = (scene.physicalAbilityEffects ?? []).filter(effect => {
    effect.elapsed += step;
    const active = effect.brief ? effect.target.alive && !scene.battleOver && effect.elapsed < 450
      : physicalEffectActive(scene, effect.target, effect.type);
    if (!active) {

      // A frame crossing the cue's 450 ms hold spends only its leftover time on
      // fading. This keeps slow frames from shortening the intended presentation.
      const fadeStep = effect.brief && effect.fadeElapsed === null && effect.target.alive && !scene.battleOver
        ? Math.min(step, Math.max(0, effect.elapsed - 450)) : step;
      effect.fadeElapsed = (effect.fadeElapsed ?? 0) + fadeStep;
    }
    if (effect.fadeElapsed >= FADE_MS) {
      effect.image.destroy();
      return false;
    }
    drawEffect(scene, effect, getBounds(scene, effect.target), getBounds);
    return true;
  });
}

// Shutdown and historical replay remove the entire presentation, including faded
// drawings. Statuses remain intact and rebuild only their current recipient art.
export function clearPhysicalAbilityEffects(scene) {
  clearAssaultAbilityEffects(scene);
  for (const effect of scene.physicalAbilityEffects ?? []) effect.image.destroy();
  scene.physicalAbilityEffects = [];
}
