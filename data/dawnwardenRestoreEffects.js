// Finished PixelLab sheets use 32 frames at 20 FPS, or 1.6 seconds per animation.
// Stable ability IDs keep these cosmetic effects separate from saved gameplay.

const effects = [
  { slug: 'renewing-light', abilityName: 'Renewing Light', suffix: 'renewing_light',
    width: 80, height: 112, x: -40, y: -92, opacity: 0.55, groundAtFeet: true },
  { slug: 'devotion', abilityName: 'Devotion', suffix: 'devotion',
    width: 128, height: 128, x: -64, y: -64, opacity: 0.75,
    artworkBounds: { left: -35, right: 35, top: -35, bottom: 35 } },
  { slug: 'cleansing-radiance', abilityName: 'Cleansing Radiance', suffix: 'cleansing_radiance',
    width: 77, height: 49, x: -40, y: -26, opacity: 0.85 },
  { slug: 'dawns-guidance', abilityName: "Dawn's Guidance", suffix: 'dawn_s_guidance',
    width: 112, height: 64, x: -56, y: -40, opacity: 0.8, groundAtFeet: true,
    targetSize: 2.4 }
];

export const DAWNWARDEN_RESTORE_EFFECTS = effects.map(effect => ({
  ...effect,
  id: 'dawnwarden-restore-' + effect.slug,
  className: 'Dawnwarden',
  abilityId: 'ability_v2_dawnwarden_' + effect.suffix,
  frames: 32,
  frameMs: 50,
  fitTarget: true,
  followTarget: true,
  singleTargetArtwork: true,
  targetSize: effect.targetSize ?? 1.45,
  groundWidth: effect.width,

  // The final eight frames fade over 400 combat milliseconds. All four abilities
  // resolve immediately, so no cosmetic timer is stored in an encounter save.
  holdMs: 1200,
  fadeMs: 400,
  clips: [{
    name: 'whole',
    key: 'dawnwarden-restore-' + effect.slug,
    width: effect.width,
    height: effect.height,
    frames: 32,
    start: 0,
    x: effect.x,
    y: effect.y,
    depth: 'front',
    loop: false,
    url: new URL('../assets/effects/dawnwarden-restore/' + effect.slug + '.png', import.meta.url).href
  }]
}));
