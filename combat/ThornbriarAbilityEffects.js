// Thornbriar's monster skills use small original Phaser drawings, so no image service
// or generated asset is needed when a battle runs.
import { startTravelingEffect, travelingEffectPoint } from './TravelingEffects.js';

const FADE_MS = 400;

const SKILL_COLORS = {
  'Whip Lash': 0x9bc53d,
  'Bramble Shroud': 0x6f8f2f,
  'Briar Bolt': 0xb5dc50,
  'Mace Sweep': 0xc58b42,
  'Intimidating Stomp': 0xdaa45b,
  Belch: 0x82a83b
};

// Draw one named monster effect at a progress point between 0 and 1.
function drawSkill(graphics, effect, progress) {
  const { name, x, y, endX, endY, color } = effect;
  const eased = progress * progress * (3 - 2 * progress);
  const radius = 16 + eased * 54;
  const angle = -1.15 + progress * 2.3;

  graphics.clear();
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
  const source = scene.battlefield.arenaToScreen(attacker.arenaX, attacker.arenaY);
  const destination = center ?? travelingEffectPoint(scene, target);
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
    attacker,
    action: mode === 'cast' ? attacker.pendingAction : null,
    fadeAt: null,
    stoppedProgress: 1
  };

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
      || effect.action && effect.attacker.pendingAction !== effect.action)) {
      effect.fadeAt = scene.time.now;
      effect.stoppedProgress = Math.min(1, elapsed / effect.duration);
    }
    if (effect.fadeAt === null && elapsed >= effect.duration) {
      effect.fadeAt = effect.startedAt + effect.duration;
    }

    if (effect.fadeAt === null) {
      effect.graphics.setAlpha(1);
      drawSkill(effect.graphics, effect, elapsed / effect.duration);
      return true;
    }

    const fade = Math.max(0, scene.time.now - effect.fadeAt) / FADE_MS;
    if (fade >= 1) {
      effect.graphics.destroy();
      return false;
    }

    // Lower the whole drawing smoothly during the final 400 combat milliseconds.
    drawSkill(effect.graphics, effect, effect.stoppedProgress);
    effect.graphics.setAlpha(1 - fade);
    return true;
  });
}

// Remove artwork immediately during shutdown, replay, or a new encounter.
export function clearThornbriarAbilityEffects(scene) {
  for (const effect of scene.thornbriarEffects ?? []) effect.graphics.destroy();
  scene.thornbriarEffects = [];
}
