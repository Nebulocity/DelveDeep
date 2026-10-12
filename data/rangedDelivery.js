// Finished PixelLab missile artwork complements the shared travel renderer.
// Delivery choices remain in rangedTravelEffects.js, independent of numeric range.
export const RANGED_DELIVERY_SHEETS = ['arrow', 'bolt', 'lance'].map(name => ({
  name, key: 'delivery-' + name, width: 48, height: 24, frames: 32, fps: 24,
  url: new URL(`../assets/effects/ranged-delivery/${name}.png`, import.meta.url).href
}));
RANGED_DELIVERY_SHEETS.push({ name: 'stone', key: 'delivery-stone', width: 256, height: 256,
  frames: 5, fps: 1000 / 75,
  url: new URL('../assets/enemies/old-quarry/effects/rockProjectile.png', import.meta.url).href });

// Load finished sheets only. No art service or credentials are used by the game.
export function preloadRangedDelivery(scene) {
  for (const sheet of RANGED_DELIVERY_SHEETS) {
    if (!scene.textures.exists(sheet.key)) scene.load.spritesheet(sheet.key, sheet.url, {
      frameWidth: sheet.width, frameHeight: sheet.height, endFrame: sheet.frames - 1
    });
  }
}
