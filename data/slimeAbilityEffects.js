// PixelLab sheets for the Slime Cave's four authored monster abilities.
export const SLIME_ABILITY_EFFECTS = {
  'Slime Slam': {
    key: 'slime-ability-slam', file: 'slime-slam.png', frameWidth: 60, frameHeight: 56,
    frames: 32, fps: 18, fadeMs: 400
  },
  'Crushing Slime Slam': {
    key: 'slime-ability-crushing-slam', file: 'crushing-slime-slam.png', frameWidth: 170, frameHeight: 72,
    frames: 32, fps: 18, fadeMs: 400
  },
  'Toxic Glob': {
    key: 'slime-ability-toxic-glob', file: 'toxic-glob-splash.png', frameWidth: 48, frameHeight: 43,
    frames: 32, fps: 18, fadeMs: 400
  },
  Consume: {
    key: 'slime-ability-consume', file: 'consume.png', frameWidth: 268, frameHeight: 106,
    frames: 32, fps: 18, fadeMs: 400
  }
};

// The exported projectile is already cropped into place. The game supplies its travel.
export const SLIME_GLOB_PROJECTILE = {
  key: 'slime-ability-glob-flight', file: 'toxic-glob-projectile.png',
  frameWidth: 7, frameHeight: 8, frames: 32, fps: 18, fadeMs: 400
};

// Load these small atlases only when a Slime Cave battle is opened.
export function preloadSlimeAbilityEffects(scene) {
  for (const effect of [...Object.values(SLIME_ABILITY_EFFECTS), SLIME_GLOB_PROJECTILE]) {
    scene.load.spritesheet(effect.key,
      new URL(`../assets/effects/monster-slime-cave/${effect.file}`, import.meta.url).href,
      { frameWidth: effect.frameWidth, frameHeight: effect.frameHeight, endFrame: effect.frames - 1 });
  }
}
