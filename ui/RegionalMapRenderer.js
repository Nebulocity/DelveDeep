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
    this.effects = [];
    this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    for (const [name, depth] of Object.entries(REGION_LAYER_DEPTHS)) {
      const layer = scene.add.container(0, 0).setDepth(depth).setName(`regional-map-${name}`);
      this.layers[name] = layer;
      for (const art of definition.layers[name] ?? []) {
        if (art.enabled !== false) this.addArtwork(name, art);
      }
    }
    this.onUpdate = (_time, delta) => this.update(delta);
    this.onShutdown = () => this.destroy();
    scene.events.on('postupdate', this.onUpdate);
    scene.events.once('shutdown', this.onShutdown);
  }

  // Local pixels match nodePoint/mapPoint. Cropped art keeps its authored offset,
  // and sprite animation never alters gameplay coordinates, routes or timing.
  addArtwork(layerName, art) {
    const { scene } = this;
    const layer = this.layers[layerName];
    const frames = art.animation?.frames;
    const object = frames?.length
      ? scene.add.sprite(art.x ?? 0, art.y ?? 0, art.key, art.frame)
      : scene.add.image(art.x ?? 0, art.y ?? 0, art.key, art.frame);
    object.setOrigin(art.originX ?? 0, art.originY ?? 0).setAlpha(art.alpha ?? 1).setName(art.id);
    if (art.width && art.height) object.setDisplaySize(art.width, art.height);
    object.setScale(object.scaleX * (art.scale ?? 1), object.scaleY * (art.scale ?? 1));
    object.texture.setFilter(1);
    layer.add(object);
    if (frames?.length && !this.reducedMotion) {
      const key = `regional-${this.definition.id}-${art.id}`;
      if (!scene.anims.exists(key)) scene.anims.create({ key,
        frames: frames.map(frame => typeof frame === 'object' ? frame : { key: art.key, frame }),
        frameRate: art.animation.frameRate ?? 20,
        repeat: art.animation.loop === false ? 0 : art.animation.repeat ?? -1
      });
      object.play({ key, startFrame: art.animation.startFrame ?? 0 });
    }
    if (art.animation || art.motion) {
      const motion = art.motion ?? {};
      const growth = Math.max(1, motion.scaleTo ?? 1);
      const margin = Math.max(object.displayWidth, object.displayHeight) * growth
        + Math.abs(motion.driftX ?? 0) + Math.abs(motion.driftY ?? 0);
      this.effects.push({ object, art, elapsed: 0, scaleX: object.scaleX, scaleY: object.scaleY, margin });

      // Inactive sprites skip Phaser's animation preUpdate until the camera sees them.
      object.setActive(false);
    }
    return object;
  }

  // Only visible artwork advances. Scene pause/sleep stops this listener naturally;
  // returning to an effect resumes its local time without a large catch-up jump.
  update(delta) {
    const view = this.scene.cameras.main.worldView;
    for (const effect of this.effects) {
      const { object, art, margin } = effect;
      const visible = art.x + margin >= view.x && art.x - margin <= view.right
        && art.y + margin >= view.y && art.y - margin <= view.bottom;
      object.setVisible(visible).setActive(visible && !this.reducedMotion);
      if (!visible || this.reducedMotion || !art.motion) continue;
      const motion = art.motion;
      effect.elapsed += Math.min(delta, 100);
      const raw = effect.elapsed / (motion.duration ?? 7000) + (motion.phase ?? 0);
      const progress = art.animation?.loop === false ? Math.min(1, raw) : raw % 1;
      object.setPosition(art.x + (motion.driftX ?? 0) * progress,
        art.y + (motion.driftY ?? 0) * progress);
      const growth = 1 + ((motion.scaleTo ?? 1) - 1) * progress;
      object.setScale(effect.scaleX * growth, effect.scaleY * growth);
      object.setAlpha((art.alpha ?? 1) * (motion.fade ? Math.sin(progress * Math.PI) ** 2 : 1));
    }
  }

  destroy() {
    if (!this.scene) return;
    this.scene.events.off('postupdate', this.onUpdate);
    this.scene.events.off('shutdown', this.onShutdown);
    Object.values(this.layers).forEach(layer => layer.destroy());
    this.layers = {};
    this.effects = [];
    this.scene = null;
  }
}
