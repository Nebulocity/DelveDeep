import { WORLD_WIDTH, WORLD_HEIGHT, WORLD_LAYOUT_ID } from './illustratedWorldMap.js';

// Pixel positions share the current route graph's 3840 by 2160 image space.
// Atlas placement stays unset until adjoining geography has an approved reference.
export const REGIONAL_MAPS = Object.freeze({
  'pineshire-reach': {
    id: 'pineshire-reach', layoutId: WORLD_LAYOUT_ID,
    width: WORLD_WIDTH, height: WORLD_HEIGHT, atlasPlacement: null,
    layers: {
      terrain: [{ id: 'pineshire-illustration', key: 'world-pineshire-final', x: 0, y: 0,
        width: WORLD_WIDTH, height: WORLD_HEIGHT }],
      routes: [], landmarks: [], foreground: [], environment: [], overlays: []
    }
  }
});

// Bands below the existing location labels and party keep new scenery decorative.
// Screen controls use a separate camera and never belong to these world layers.
export const REGION_LAYER_DEPTHS = Object.freeze({
  terrain: 0, routes: 10, landmarks: 30, foreground: 120, environment: 80, overlays: 140
});
