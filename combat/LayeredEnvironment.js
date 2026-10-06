import { createPixelEnvironmentEffects } from './PixelEnvironmentEffects.js';
import { createForestEnvironmentEffects } from './ForestEnvironmentEffects.js';
import { createVoidEnvironmentEffects } from './VoidEnvironmentEffects.js';
import { createDenEnvironmentEffects } from './DenEnvironmentEffects.js';

// All artwork, ambient effects and the walkable arena share one camera-space transform.
export function getEnvironmentTransform(environment, width, height) {
  const scale = Math.min(width / environment.width, height / environment.height);
  return { scale, x: (width - environment.width * scale) / 2,
    y: (height - environment.height * scale) / 2 + (environment.offsetY ?? 0) * scale };
}

// Project each authored floor boundary through the same transform as its artwork.
export function getDelveArena(environment, width, height) {
  const t = getEnvironmentTransform(environment, width, height);
  const authored = environment.walkable.map(([x, y]) => ({ x: t.x + x * t.scale, y: t.y + y * t.scale }));
  const bottomLimit = height * 0.775 - 8;
  const boundary = [];

  // Clip the floor to the usable battlefield above the party cards.
  for (let index = 0; index < authored.length; index += 1) {
    const a = authored[index], b = authored[(index + 1) % authored.length];
    if (a.y <= bottomLimit) boundary.push(a);
    if ((a.y <= bottomLimit) !== (b.y <= bottomLimit)) {
      const ratio = (bottomLimit - a.y) / (b.y - a.y);
      boundary.push({ x: a.x + (b.x - a.x) * ratio, y: bottomLimit });
    }
  }
  const left = Math.min(...boundary.map(p => p.x));
  const right = Math.max(...boundary.map(p => p.x));
  const top = Math.min(...boundary.map(p => p.y));
  const bottom = Math.max(...boundary.map(p => p.y));
  return { topLeftX: left, bottomLeftX: left, topRightX: right, bottomRightX: right,
    topY: top, bottomY: bottom, boundary };
}

export function preloadEnvironment(scene, environment) {
  for (const layer of environment.layers) {
    if (!scene.textures.exists(layer.key)) scene.load.image(layer.key, layer.url);
  }
  if (environment.ambient && !scene.cache.video.exists(environment.ambient.key)) {
    scene.load.video(environment.ambient.key, environment.ambient.url, true);
  }
}

export function createEnvironment(scene, environment) {
  const { width, height } = scene.scale;
  const t = getEnvironmentTransform(environment, width, height);
  if (environment.pixelArt) {
    for (const layer of environment.layers) scene.textures.get(layer.key).setFilter(1);
  }
  const layers = environment.layers.map(layer => scene.add.image(t.x, t.y, layer.key)
    .setOrigin(0).setScale(t.scale).setDepth(layer.depth));
  let foreground;
  let foregroundMask;
  let foregroundShape;
  if (environment.foreground) {
    const source = environment.layers.find(layer => layer.key === environment.foreground.sourceKey);
    foregroundShape = scene.make.graphics({ x: 0, y: 0, add: false });
    foregroundShape.fillStyle(0xffffff);
    for (const polygon of environment.foreground.polygons) {
      foregroundShape.fillPoints(polygon.map(([x, y]) => ({ x: t.x + x * t.scale,
        y: t.y + y * t.scale })), true);
    }
    foregroundMask = foregroundShape.createGeometryMask();
    foreground = scene.add.image(t.x, t.y, source.key).setOrigin(0).setScale(t.scale)
      .setDepth(environment.foreground.depth).setMask(foregroundMask);
  }
  const effects = environment.denEffects
    ? createDenEnvironmentEffects(scene, environment.denEffects, t)
    : environment.voidEffects
      ? createVoidEnvironmentEffects(scene, environment.voidEffects, t)
      : environment.forestEffects
        ? createForestEnvironmentEffects(scene, environment.forestEffects, t)
        : createPixelEnvironmentEffects(scene, environment.pixelEffects, t);
  const a = environment.ambient;
  let video;
  let mask;
  let maskShape;
  if (a) {
    maskShape = scene.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff);
    for (const r of a.regions) maskShape.fillRect(t.x + r.x * t.scale,
      t.y + r.y * t.scale, r.width * t.scale, r.height * t.scale);
    mask = maskShape.createGeometryMask();
    video = scene.add.video(t.x, t.y + a.sourceY * t.scale, a.key)
      .setOrigin(0).setScale(t.scale).setDepth(-900).setMask(mask).setMute(true);
    // The still beneath remains a fallback while video loads or autoplay is blocked.
    video.play(true);
  }
  const pause = () => video?.setPaused(true);
  const resume = () => video?.setPaused(false);
  scene.events.on('pause', pause);
  scene.events.on('resume', resume);
  scene.events.once('shutdown', () => {
    scene.events.off('pause', pause);
    scene.events.off('resume', resume);
    video?.stop();
    video?.clearMask();
    mask?.destroy();
    maskShape?.destroy();
    foreground?.clearMask();
    foregroundMask?.destroy();
    foregroundShape?.destroy();
  });
  return { layers, foreground, effects, video, transform: t };
}
