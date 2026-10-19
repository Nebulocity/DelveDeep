import { WORLD_WIDTH, WORLD_HEIGHT, WORLD_LAYOUT_ID } from './illustratedWorldMap.js';

// Artwork anchors are surveyed in the illustration's native 1672 by 941 pixels.
// These decorative positions do not change destination nodes or traced roads.
const position = (x, y) => ({ x: x * WORLD_WIDTH / 1672, y: y * WORLD_HEIGHT / 941 });
const quarryFire = (id, x, y, width, height, startFrame) => ({
  id, regionId: 'pineshire-reach', layer: 'environment', ...position(x, y),
  key: 'pineshire-quarry-flame', originX: 0.5, originY: 0.96,
  width, height, scale: 1, alpha: 0.88,
  animation: { type: 'frames', frames: Array.from({ length: 16 }, (_, frame) => frame),
    frameRate: 16, loop: true, startFrame },
  frame: 0
});

// Pixel positions share the current route graph's 3840 by 2160 image space.
// Atlas placement stays unset until adjoining geography has an approved reference.
export const REGIONAL_MAPS = Object.freeze({
  'pineshire-reach': {
    id: 'pineshire-reach', layoutId: WORLD_LAYOUT_ID,
    width: WORLD_WIDTH, height: WORLD_HEIGHT, atlasPlacement: null,
    assets: [{ type: 'spritesheet', key: 'pineshire-quarry-flame',
      url: new URL('../assets/world-map/pineshire-environment/quarry-flame.png', import.meta.url).href,
      config: { frameWidth: 128, frameHeight: 128, endFrame: 15 } }],
    legacyAmbience: { smoke: false, portal: false,
      excludeFires: [[738, 480], [826, 431], [878, 439]] },
    layers: {
      terrain: [{ id: 'pineshire-illustration', key: 'world-pineshire-final', x: 0, y: 0,
        width: WORLD_WIDTH, height: WORLD_HEIGHT }],
      routes: [], landmarks: [], foreground: [],
      environment: [
        quarryFire('quarry-entrance-fire', 738, 480, 32, 48, 0),
        quarryFire('quarry-upper-fire', 826, 431, 22, 34, 5),
        quarryFire('quarry-crane-fire', 878, 439, 22, 34, 11)
      ],
      overlays: []
    },

    // Disabled art requests are deliberately excluded from rendering and loading.
    // Smoke needs a clean plate; the portal needs an opaque, registered interior loop.
    pendingArtwork: [
      { id: 'pineshire-west-chimney', regionId: 'pineshire-reach', layer: 'environment',
        enabled: false, ...position(155, 621), key: 'pineshire-chimney-smoke',
        originX: 0.5, originY: 0.96, width: 72, height: 116, scale: 1, alpha: 0.28,
        animation: { type: 'drift', loop: true },
        motion: { duration: 7200, driftX: 16, driftY: -38, scaleTo: 1.18, phase: 0, fade: true } },
      { id: 'pineshire-east-chimney', regionId: 'pineshire-reach', layer: 'environment',
        enabled: false, ...position(344, 608), key: 'pineshire-chimney-smoke',
        originX: 0.5, originY: 0.96, width: 64, height: 108, scale: 1, alpha: 0.24,
        animation: { type: 'drift', loop: true },
        motion: { duration: 8100, driftX: 20, driftY: -34, scaleTo: 1.15, phase: 0.43, fade: true } },
      { id: 'murmuring-abyss-interior', regionId: 'pineshire-reach', layer: 'environment',
        enabled: false, ...position(1523, 633), key: 'pineshire-void-interior',
        originX: 0.5, originY: 0.5, width: 148, height: 210, scale: 1, alpha: 1,
        animation: { type: 'frames', frames: [], frameRate: 20, loop: true } }
    ]
  }
});

// Bands below the existing location labels and party keep new scenery decorative.
// Screen controls use a separate camera and never belong to these world layers.
export const REGION_LAYER_DEPTHS = Object.freeze({
  terrain: 0, routes: 10, landmarks: 30, foreground: 120, environment: 80, overlays: 140
});
