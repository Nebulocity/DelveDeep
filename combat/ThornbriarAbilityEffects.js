// Finished PixelLab impacts replace the simple enemy sketches. Cast warnings keep
// their original drawings, while the game's targeting and hit timing stay intact.
import { startTravelingEffect, travelingEffectPoint } from './TravelingEffects.js';
import { THORNBRIAR_ABILITY_EFFECTS } from '../data/thornbriarAbilityEffects.js';
import { visibleUnitBounds } from './AbilityEffect.js';

const FADE_MS = 400;

const SKILL_COLORS = {
  'Whip Lash': 0x9bc53d,
  'Bramble Shroud': 0x6f8f2f,
  'Briar Bolt': 0xb5dc50,
  'Mace Sweep': 0xc58b42,
  'Intimidating Stomp': 0xdaa45b,
  Belch: 0x82a83b
};

// The mouth sits about 22% down the visible silhouette, excluding transparent padding.
function belchHeadPoint(scene, attacker) {
  const bounds = visibleUnitBounds(scene, attacker);
  return { x: (bounds.left + bounds.right) / 2,
    y: bounds.top + (bounds.bottom - bounds.top) * 0.22 };
}

// Draw one named monster effect at a progress point between 0 and 1.
function drawSkill(graphics, effect, progress) {

  // Belch comes from Rongar's head during both windup and impact. Its gameplay area
  // keeps the captured ground center; only this cloud follows the caster's mouth.
  if (effect.name === 'Belch') {
    const head = belchHeadPoint(effect.scene, effect.attacker);
    effect.x = effect.endX = head.x;
    effect.y = effect.endY = head.y;
    effect.image?.setPosition(head.x, head.y);
  }
  const { name, x, y, endX, endY, color } = effect;
  const eased = progress * progress * (3 - 2 * progress);
  const radius = 16 + eased * 54;
  const angle = -1.15 + progress * 2.3;

  graphics.clear();

  // Impacts use authored frames; graphics remain only for cast cues or lightweight
  // renderer-free combat fixtures that have no textures or image objects.
  if (effect.image) {
    const frame = Math.min(31, Math.floor(progress * 32));
    effect.image.setFrame(frame);
    graphics.setVisible(false);
    if (effect.sheet.headAtCaster) {

      // Keep the mouth cloud in front of Rongar even after he walks past the party.
      effect.image.setDepth((effect.attacker.container?.depth ?? 100 + y) + 1);
    } else if (!effect.sheet.area) {
      const bounds = visibleUnitBounds(effect.scene, effect.target);
      const destination = effect.sheet.groundAtFeet
        ? { x: (bounds.left + bounds.right) / 2, y: bounds.bottom }
        : travelingEffectPoint(effect.scene, effect.target);
      effect.image.setPosition(destination.x, destination.y)
        .setDepth((effect.target.container?.depth ?? 100 + bounds.bottom) + 1);
    } else {

      // Fixed area art stays at its warning center but draws over nearby bodies.
      const depth = Math.max(100 + effect.endY,
        ...(effect.scene.partyUnits ?? []).map(unit => unit.container?.depth ?? 0)) + 1;
      effect.image.setDepth(depth);
    }
    return;
  }
  graphics.fillStyle(color, 0.14);
  graphics.lineStyle(5, color, 0.9);

  if (name === 'Briar Bolt') {

    // Flight belongs to the shared travel system. This is just the contact burst.
    graphics.fillStyle(0xe5f7a1, 0.82);
    graphics.fillCircle(endX, endY, 7 + eased * 12);
    graphics.lineStyle(4, color, 0.8);
    graphics.strokeCircle(endX, endY, 12 + eased * 24);
    return;
  }

  if (name === 'Whip Lash' || name === 'Mace Sweep') {
    const gathering = name === 'Mace Sweep' && effect.mode === 'cast';
    const centerX = gathering ? x : endX;
    const centerY = gathering ? y : endY;
    const startAngle = angle - 0.95;
    const endAngle = Math.min(angle + 0.9, startAngle + 1.9);

    // A segmented arc keeps the swipe light and readable over the character art.
    for (let segment = 0; segment < 9; segment += 1) {
      const from = startAngle + (endAngle - startAngle) * segment / 9;
      const to = startAngle + (endAngle - startAngle) * (segment + 1) / 9;
      graphics.lineStyle(name === 'Mace Sweep' ? 9 : 5, color, 0.2 + segment * 0.075);
      graphics.lineBetween(
        centerX + Math.cos(from) * 53, centerY + Math.sin(from) * 30,
        centerX + Math.cos(to) * 53, centerY + Math.sin(to) * 30
      );
    }
    return;
  }

  if (name === 'Bramble Shroud') {
    // Paired loops and short thorns make a brief bramble burst instead of a solid blob.
    graphics.lineStyle(4, color, 0.8);
    graphics.strokeEllipse(endX, endY - 16, 66 + eased * 24, 38 + eased * 14);
    graphics.strokeEllipse(endX, endY - 16, 42 + eased * 18, 58 + eased * 14);
    for (let thorn = 0; thorn < 8; thorn += 1) {
      const thornAngle = thorn * Math.PI / 4 + progress * 0.5;
      const thornX = endX + Math.cos(thornAngle) * 34;
      const thornY = endY - 16 + Math.sin(thornAngle) * 20;
      graphics.fillTriangle(thornX, thornY - 7, thornX + 4, thornY + 4, thornX - 4, thornY + 4);
    }
    return;
  }

  if (name === 'Intimidating Stomp' || name === 'Belch') {
    graphics.lineStyle(name === 'Belch' ? 8 : 6, color, 0.86);
    graphics.strokeEllipse(x, y, radius * 2, radius * 0.76);

    if (name === 'Intimidating Stomp') {
      for (let root = 0; root < 8; root += 1) {
        const rootAngle = root * Math.PI / 4;
        const rootX = x + Math.cos(rootAngle) * radius;
        const rootY = y + Math.sin(rootAngle) * radius * 0.38;
        graphics.fillTriangle(rootX, rootY - 11, rootX + 7, rootY + 5, rootX - 7, rootY + 5);
      }
    } else {
      graphics.fillStyle(color, 0.16);
      graphics.fillEllipse(x, y - 36, 105 + eased * 38, 60 + eased * 20);
      graphics.fillCircle(x - 28, y - 56, 10);
      graphics.fillCircle(x + 14, y - 64, 8);
      graphics.fillCircle(x + 40, y - 43, 6);
    }
  }
}

// Start a short charge or strike drawing at battlefield screen coordinates.
export function startThornbriarAbilityEffect(scene, attacker, target, ability, mode = 'cast', center = null) {
  if (!scene.isThornbriarHollow || scene.idleSimulating
    || scene.game.backgroundProgress?.isReplaying || scene.battleOver) return false;
  const color = SKILL_COLORS[ability.name];
  if (!color) return false;

  // Traveling thorns arrive during the existing windup as a straight bolt or
  // extending whip. Bramble Shroud stays at its recipient instead of being thrown.
  if (mode === 'cast' && ['Whip Lash', 'Briar Bolt'].includes(ability.name)) {
    return startTravelingEffect(scene, attacker, target, ability, attacker.pendingAction);
  }

  scene.thornbriarEffects ??= [];

  // Area strikes use their captured ground center. Direct impacts use the same
  // chest point as the traveling effect, rather than flashing at the target's feet.
  const sheet = THORNBRIAR_ABILITY_EFFECTS[ability.name];
  const source = sheet?.headAtCaster ? belchHeadPoint(scene, attacker)
    : scene.battlefield.arenaToScreen(attacker.arenaX, attacker.arenaY);
  const destination = sheet?.headAtCaster ? source : center ?? travelingEffectPoint(scene, target);
  const graphics = scene.add.graphics().setDepth(48 + destination.y);
  const duration = mode === 'cast' ? Math.max(180, ability.windup ?? ability.telegraph ?? 400) : 560;
  const effect = {
    name: ability.name,
    mode,
    x: source.x,
    y: source.y,
    endX: destination.x,
    endY: destination.y,
    color,
    startedAt: scene.time.now,
    duration,
    graphics,
    scene,
    attacker,
    action: mode === 'cast' ? attacker.pendingAction : null,
    fadeAt: null,
    stoppedProgress: 1
  };

  if (mode === 'impact' && sheet && scene.add.image && scene.textures?.exists?.(sheet.key)) {
    const bounds = visibleUnitBounds(scene, sheet.headAtCaster ? attacker : target);
    const height = bounds.bottom - bounds.top;
    const width = bounds.right - bounds.left;
    const radii = sheet.area && scene.battlefield.getGroundEllipseRadii?.(ability.radius ?? 145, target.arenaY);

    // Head clouds fit the caster's silhouette instead of stretching across the floor.
    const scale = sheet.headAtCaster ? Math.max(width * 1.5, height * 0.85) / sheet.width
      : sheet.area ? (radii?.width ?? 140) * 2 / sheet.width
      : sheet.groundAtFeet ? height * 1.15 / 84 : Math.max(width, height) * 1.05 / Math.max(sheet.width, sheet.height);
    scene.textures.get(sheet.key).setFilter(1);
    effect.sheet = sheet;
    effect.scene = scene;
    effect.target = target;
    effect.duration = 1600;
    effect.image = scene.add.image(destination.x, destination.y, sheet.key, 0)
      .setOrigin(0.5, sheet.anchorY / sheet.height).setScale(scale)
      .setAlpha(sheet.opacity ?? 0.9)
      .setDepth((target.container?.depth ?? 100 + bounds.bottom) + 1);
  }

  scene.thornbriarEffects.push(effect);
  drawSkill(graphics, effect, 0);
  return true;
}

// Advance and fade effects using combat time, which freezes when the battle is paused.
export function updateThornbriarAbilityEffects(scene) {
  if (scene.idleSimulating || scene.game.backgroundProgress?.isReplaying) {
    clearThornbriarAbilityEffects(scene);
    return;
  }
  const effects = scene.thornbriarEffects ?? [];
  scene.thornbriarEffects = effects.filter(effect => {
    const elapsed = Math.max(0, scene.time.now - effect.startedAt);

    // Interrupted casts and battle endings stop the drawing where it is, then fade.
    // Keeping the action object lets an old cast finish without touching a newer one.
    if (effect.fadeAt === null && (scene.battleOver || effect.attacker.alive === false
      || effect.image && effect.target.alive === false
      || effect.action && effect.attacker.pendingAction !== effect.action)) {
      effect.fadeAt = scene.time.now;
      effect.stoppedProgress = Math.min(1, elapsed / effect.duration);
      effect.fadeOpacity = (effect.sheet?.opacity ?? 0.9)
        * Math.max(0, Math.min(1, (effect.duration - elapsed) / FADE_MS));
    }

    // Authored one-shots spend their final eight frames fading, then finish.
    // Interrupted impacts instead freeze their current frame for the separate fade.
    if (effect.image && effect.fadeAt === null && elapsed >= effect.duration) {
      effect.image.destroy();
      effect.graphics.destroy();
      return false;
    }
    if (effect.fadeAt === null && elapsed >= effect.duration) {
      effect.fadeAt = effect.startedAt + effect.duration;
    }

    if (effect.fadeAt === null) {
      effect.graphics.setAlpha(1);
      effect.image?.setAlpha((effect.sheet.opacity ?? 0.9) * Math.max(0, Math.min(1, (effect.duration - elapsed) / FADE_MS)));
      drawSkill(effect.graphics, effect, elapsed / effect.duration);
      return true;
    }

    const fade = Math.max(0, scene.time.now - effect.fadeAt) / FADE_MS;
    if (fade >= 1) {
      effect.graphics.destroy();
      effect.image?.destroy();
      return false;
    }

    // Lower the whole drawing smoothly during the final 400 combat milliseconds.
    drawSkill(effect.graphics, effect, effect.stoppedProgress);
    effect.graphics.setAlpha(1 - fade);
    effect.image?.setAlpha((effect.fadeOpacity ?? effect.sheet.opacity ?? 0.9) * (1 - fade));
    return true;
  });
}

// Remove artwork immediately during shutdown, replay, or a new encounter.
export function clearThornbriarAbilityEffects(scene) {
  for (const effect of scene.thornbriarEffects ?? []) {
    effect.graphics.destroy();
    effect.image?.destroy();
  }
  scene.thornbriarEffects = [];
}
