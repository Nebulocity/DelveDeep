import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import { CHARACTER_DISPLAY_PROFILES, CHARACTER_BODY_PROPORTIONS } from '../data/characterDisplayProfiles.js';

const identities = new WeakMap(Object.entries(CHARACTER_SPRITES).map(([id, definition]) => [definition, id]));
const textureMeasurements = new WeakMap();

// Cache scalar bounds for an entire idle clip (or a held portrait), never for a live
// animation frame. Authored origins put every measured drawing in foot-relative space.
export function characterArtworkBounds(scene, source) {
  let cache = textureMeasurements.get(scene.textures);
  if (!cache) textureMeasurements.set(scene.textures, cache = new WeakMap());
  if (cache.has(source)) return cache.get(source);
  const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let complete = true;
  const poses = source.frames ?? [source];
  const seen = new Set();
  for (const pose of poses) {
    const signature = `${pose.key}:${pose.frame}:${pose.originX}:${pose.originY}:${pose.flipX}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    if (!scene.textures.exists(pose.key)) { complete = false; continue; }
    const frame = scene.textures.getFrame(pose.key, pose.frame);
    if (!frame) { complete = false; continue; }
    const w = frame.cutWidth, h = frame.cutHeight;
    canvas.width = w;
    canvas.height = h;
    context.drawImage(frame.source.image, frame.cutX, frame.cutY, w, h, 0, 0, w, h);
    const pixels = context.getImageData(0, 0, w, h).data;
    const ox = (pose.originX ?? 0.5) * w, oy = (pose.originY ?? 0.5) * h;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!pixels[(y * w + x) * 4 + 3]) continue;
        bounds.left = Math.min(bounds.left, pose.flipX ? ox - x - 1 : x - ox);
        bounds.right = Math.max(bounds.right, pose.flipX ? ox - x : x + 1 - ox);
        bounds.top = Math.min(bounds.top, y - oy);
        bounds.bottom = Math.max(bounds.bottom, y + 1 - oy);
      }
    }
  }
  canvas.width = canvas.height = 0;
  if (!Number.isFinite(bounds.left)) return null;
  if (complete) cache.set(source, bounds);
  return bounds;
}

export function applyCharacterPose(image, pose) {
  const originX = pose.originX ?? 0.5;
  image.setTexture(pose.key, pose.frame)
    .setOrigin(pose.flipX ? 1 - originX : originX, pose.originY ?? 0.5)
    .setFlipX(pose.flipX === true);
}

// A single idle measurement determines scale across all states and directions.
// Width/height limits only contain artwork in UI slots; map anchors stay on the road.
export function characterDisplayMetrics(scene, definition, profile, options = {}) {
  const source = options.source ?? definition.portraitFrame ?? definition.clips.idle.south;
  const bounds = characterArtworkBounds(scene, source);
  if (!bounds) return null;
  const proportions = CHARACTER_BODY_PROPORTIONS[identities.get(definition)] ?? {};
  const settings = CHARACTER_DISPLAY_PROFILES[profile];
  const bodyHeight = (bounds.bottom - bounds.top) * (proportions.bodyFraction ?? 1);
  const target = (settings.bodyHeight ?? options.size * settings.bodyFraction)
    * (proportions.stature ?? 1) * settings.sizeMultiplier;
  const scale = Math.min(target / bodyHeight,
    (settings.fitToSlot === false ? Infinity : options.width ?? Infinity) / (bounds.right - bounds.left),
    (settings.fitToSlot === false ? Infinity : options.height ?? Infinity) / (bounds.bottom - bounds.top));
  return { bounds, scale };
}

// The slot center remains unchanged; visible pixels, rather than transparent cells,
// determine the center and size. Animated portraits instead retain a shared baseline.
export function displayCharacterPortrait(scene, image, definition, pose, x, y, size, profile = 'townRoster') {
  scene.textures.get(pose.key).setFilter(1);
  applyCharacterPose(image, pose);
  const metrics = characterDisplayMetrics(scene, definition, profile,
    { source: pose, size, width: size, height: size });
  if (!metrics) return image;
  const { bounds, scale } = metrics;
  return image.setScale(scale).setPosition(x - (bounds.left + bounds.right) * scale / 2,
    y - (bounds.top + bounds.bottom) * scale / 2);
}
