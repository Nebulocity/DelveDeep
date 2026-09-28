// All artwork, video patches and the tactical grid share one camera-space transform.
export function getEnvironmentTransform(environment, width, height) {
  const scale = Math.min(width / environment.width, height / environment.height);
  return { scale, x: (width - environment.width * scale) / 2,
    y: (height - environment.height * scale) / 2 + (environment.offsetY ?? 0) * scale };
}

export function getEnvironmentFloor(environment, width, height) {
  const t = getEnvironmentTransform(environment, width, height);
  const f = environment.floor;
  return { topLeftX: t.x + f.topLeftX * t.scale, topRightX: t.x + f.topRightX * t.scale,
    bottomLeftX: t.x + f.bottomLeftX * t.scale, bottomRightX: t.x + f.bottomRightX * t.scale,
    topY: t.y + f.topY * t.scale, bottomY: t.y + f.bottomY * t.scale };
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
  const layers = environment.layers.map(layer => scene.add.image(t.x, t.y, layer.key)
    .setOrigin(0).setScale(t.scale).setDepth(layer.depth));
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
  });
  return { layers, video, transform: t };
}
