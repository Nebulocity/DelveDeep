// Finished PixelLab sheets run at 20 frames per second. Trimmed front/rear clips keep
// their original first-frame offset and foot anchor so all layers stay synchronized.
export const TELEPORT_EFFECT_SHEETS = [
  {"name": "static", "width": 144, "height": 160, "start": 0, "frames": 32, "anchor": [72, 145]},
  {"name": "moon", "width": 128, "height": 128, "start": 0, "frames": 32, "anchor": [64, 64]},
  {"name": "neutral", "width": 176, "height": 152, "start": 0, "frames": 32, "anchor": [88, 76]},
  {"name": "beam", "width": 256, "height": 72, "start": 0, "frames": 32, "anchor": [14, 36]},
  {"name": "portal-behind", "width": 66, "height": 125, "start": 2, "frames": 29, "anchor": [33, 124]},
  {"name": "portal-front", "width": 33, "height": 125, "start": 2, "frames": 28, "anchor": [28, 124]},
  {"name": "collapse", "width": 168, "height": 176, "start": 0, "frames": 32, "anchor": [84, 100]},
  {"name": "blast-behind", "width": 131, "height": 99, "start": 1, "frames": 29, "anchor": [67, 45]},
  {"name": "blast-front", "width": 84, "height": 90, "start": 3, "frames": 26, "anchor": [41, 55]}
];

// Vite bundles these fixed paths for web and Android without authoring services.
const urls = {
  "static": new URL('../assets/effects/teleport/static.png', import.meta.url).href,
  "moon": new URL('../assets/effects/teleport/moon.png', import.meta.url).href,
  "neutral": new URL('../assets/effects/teleport/neutral.png', import.meta.url).href,
  "beam": new URL('../assets/effects/teleport/beam.png', import.meta.url).href,
  "portal-behind": new URL('../assets/effects/teleport/portal-behind.png', import.meta.url).href,
  "portal-front": new URL('../assets/effects/teleport/portal-front.png', import.meta.url).href,
  "collapse": new URL('../assets/effects/teleport/collapse.png', import.meta.url).href,
  "blast-behind": new URL('../assets/effects/teleport/blast-behind.png', import.meta.url).href,
  "blast-front": new URL('../assets/effects/teleport/blast-front.png', import.meta.url).href
};

export function preloadTeleportEffects(scene) {
  for (const sheet of TELEPORT_EFFECT_SHEETS) {
    const key = 'teleport-' + sheet.name;
    if (scene.textures.exists(key)) continue;
    scene.load.spritesheet(key, urls[sheet.name], {
      frameWidth: sheet.width, frameHeight: sheet.height, endFrame: sheet.frames - 1
    });
  }
}
