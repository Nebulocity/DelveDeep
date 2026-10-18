import { REGION_LAYER_DEPTHS } from '../data/regionalMaps.js';

// Optional asset descriptors use { type, key, url, data, config }. Existing Boot
// textures are reused; only future approved layer files need loader declarations.
export function preloadRegionalMap(scene, definition) {
  for (const asset of definition.assets ?? []) {
    if (scene.textures.exists(asset.key)) continue;
    if (asset.type === 'atlas') scene.load.atlas(asset.key, asset.url, asset.data);
    else if (asset.type === 'spritesheet') scene.load.spritesheet(asset.key, asset.url, asset.config);
    else scene.load.image(asset.key, asset.url);
  }
}

export class RegionalMapRenderer {
  constructor(scene, definition) {
    this.scene = scene;
    this.definition = definition;
    this.layers = {};
    this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    for (const [name, depth] of Object.entries(REGION_LAYER_DEPTHS)) {
      const layer = scene.add.container(0, 0).setDepth(depth).setName(`regional-map-${name}`);
      this.layers[name] = layer;
      for (const art of definition.layers[name] ?? []) this.addArtwork(name, art);
    }
    scene.events.once('shutdown', () => this.destroy());
  }

  // Local pixels match nodePoint/mapPoint. Cropped art keeps its authored offset,
  // and sprite animation never alters gameplay coordinates, routes or timing.
  addArtwork(layerName, art) {
    const { scene } = this;
    const layer = this.layers[layerName];
    const object = art.animation
      ? scene.add.sprite(art.x ?? 0, art.y ?? 0, art.key, art.frame)
      : scene.add.image(art.x ?? 0, art.y ?? 0, art.key, art.frame);
    object.setOrigin(art.originX ?? 0, art.originY ?? 0).setAlpha(art.alpha ?? 1).setName(art.id);
    if (art.width && art.height) object.setDisplaySize(art.width, art.height);
    layer.add(object);
    if (art.animation && !this.reducedMotion) {
      const key = `regional-${this.definition.id}-${art.id}`;
      if (!scene.anims.exists(key)) scene.anims.create({ key,
        frames: art.animation.frames.map(frame => ({ key: art.key, frame })),
        frameRate: art.animation.frameRate ?? 20, repeat: art.animation.repeat ?? -1
      });
      object.play(key);
    }
    return object;
  }

  destroy() {
    Object.values(this.layers).forEach(layer => layer.destroy());
    this.layers = {};
  }
}
