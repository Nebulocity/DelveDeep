// We use one transform for the background, foreground masks, effects and walkable floor.
// The transform has a scale plus x/y offsets. An artwork point becomes offset + point *
// scale. Using the same transform everywhere keeps feet lined up with the floor. The lower
// polygon is clipped at the party HUD; decorative foreground art can hide a unit without
// blocking it.

import { createPixelEnvironmentEffects } from './PixelEnvironmentEffects.js';
import { createForestEnvironmentEffects } from './ForestEnvironmentEffects.js';
import { createVoidEnvironmentEffects } from './VoidEnvironmentEffects.js';
import { createDenEnvironmentEffects } from './DenEnvironmentEffects.js';

// All artwork, ambient effects and the walkable arena share one camera-space transform.
export function getEnvironmentTransform(environment, width, height) {

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound.
  const scale = Math.min(width / environment.width, height / environment.height);

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  return { scale, x: (width - environment.width * scale) / 2,
    y: (height - environment.height * scale) / 2 + (environment.offsetY ?? 0) * scale };
}

// Project each authored floor boundary through the same transform as its artwork.
export function getDelveArena(environment, width, height) {
  const t = getEnvironmentTransform(environment, width, height);

  // Each [x, y] is a vertex in the original artwork. Multiplying by t.scale and adding
  // t.x/t.y moves that same vertex onto the displayed floor. Never project this boundary
  // with a separate scale from the artwork.
  const authored = environment.walkable.map(([x, y]) => ({ x: t.x + x * t.scale, y: t.y + y * t.scale }));

  // The full-width HUD frame begins 12 pixels above the individual party cards.
  const bottomLimit = height * 0.78 - 12;
  const boundary = [];

  // Clip the floor to the usable battlefield above the party cards.
  for (let index = 0; index < authored.length; index += 1) {

    // Pair each vertex with the next one, wrapping the final vertex back to the first. We
    // examine edges, because an edge can cross the HUD cutoff even when only one of its
    // endpoints remains above it.
    const a = authored[index], b = authored[(index + 1) % authored.length];
    if (a.y <= bottomLimit) boundary.push(a);
    if ((a.y <= bottomLimit) !== (b.y <= bottomLimit)) {

      // This is the fraction of the edge where y reaches bottomLimit. Apply the same
      // fraction to its horizontal change to get the intersection x. Adding this point
      // preserves the polygon shape at the clipped edge.
      const ratio = (bottomLimit - a.y) / (b.y - a.y);
      boundary.push({ x: a.x + (b.x - a.x) * ratio, y: bottomLimit });
    }
  }

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound. ... expands these entries into the new list or call.
  // It does not deep-copy the objects inside.
  const left = Math.min(...boundary.map(p => p.x));
  const right = Math.max(...boundary.map(p => p.x));
  const top = Math.min(...boundary.map(p => p.y));
  const bottom = Math.max(...boundary.map(p => p.y));

  return { topLeftX: left, bottomLeftX: left, topRightX: right, bottomRightX: right,
    topY: top, bottomY: bottom, boundary };
}

// Queue the selected battlefield layers and optional ambient clip by their asset keys.
// scene is the Phaser screen that owns the objects, clock and input used here. environment
export function preloadEnvironment(scene, environment) {
  for (const layer of environment.layers) {
    if (!scene.textures.exists(layer.key)) scene.load.image(layer.key, layer.url);
  }

  if (environment.ambient && !scene.cache.video.exists(environment.ambient.key)) {
    scene.load.video(environment.ambient.key, environment.ambient.url, true);
  }
}

// Place art, masked foreground and ambient effects through one shared environment
// transform.
export function createEnvironment(scene, environment) {

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { width, height } = scene.scale;
  const t = getEnvironmentTransform(environment, width, height);
  if (environment.pixelArt) {
    for (const layer of environment.layers) scene.textures.get(layer.key).setFilter(1);
  }

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry.
  const layers = environment.layers.map(layer => scene.add.image(t.x, t.y, layer.key)
    .setOrigin(0).setScale(t.scale).setDepth(layer.depth));
  let foreground;
  let foregroundMask;
  let foregroundShape;

  if (environment.foreground) {

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const source = environment.layers.find(layer => layer.key === environment.foreground.sourceKey);

    // The mask is a hidden drawing shape, not a visible scene decoration. Its polygons
    // keep only the foreground pieces of the original image, so we can draw those pieces
    // over units without drawing the entire image twice.
    foregroundShape = scene.make.graphics({ x: 0, y: 0, add: false });
    foregroundShape.fillStyle(0xffffff);

    for (const polygon of environment.foreground.polygons) {
      foregroundShape.fillPoints(polygon.map(([x, y]) => ({ x: t.x + x * t.scale,
        y: t.y + y * t.scale })), true);
    }

    // A geometry mask uses a Graphics shape to decide which pixels remain visible. The
    // mask shape can be hidden while still clipping its target.
    foregroundMask = foregroundShape.createGeometryMask();

    // The mask limits which pixels are drawn. It does not automatically limit the touch
    // hit area; input bounds need their own check. Depth is drawing order, not distance or
    // size. Higher-depth objects draw on top of lower-depth objects. Origin is the anchor
    // within the object: 0 is the left/top edge, 0.5 is the center and 1 is the
    // right/bottom edge. x/y place that anchor, not necessarily the object's corner.
    foreground = scene.add.image(t.x, t.y, source.key).setOrigin(0).setScale(t.scale)
      .setDepth(environment.foreground.depth).setMask(foregroundMask);
  }

  // The condition before ? chooses the first value when true and the value after : when
  // false.
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

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  scene.events.on('pause', pause);
  scene.events.on('resume', resume);

  // once registers a callback that removes itself after the first matching event.
  scene.events.once('shutdown', () => {
    scene.events.off('pause', pause);
    scene.events.off('resume', resume);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
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
