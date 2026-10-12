// Finished PixelLab sphere layers share a 96-pixel canvas and a 32-frame loop.
// The pale rear film sits behind the body; reflections and glints sit in front.
export function shieldSphereClips(style, key) {
  return ['rear', 'front'].map(layer => ({
    name: layer, key: `${key}-${layer}`, width: 96, height: 96,
    frames: 32, start: 0, x: -48, y: -48,
    depth: layer === 'rear' ? 'behind' : 'front', loop: true,
    url: new URL(`../assets/effects/shield-spheres/${style}/${layer}.png`, import.meta.url).href
  }));
}

// A circle must enclose the body's diagonal, including its weapon and feet.
// The rendered shell is 76 pixels across inside the padded 96-pixel cell.
export function shieldSphereScale(bounds) {
  return Math.hypot(bounds.right - bounds.left, bounds.bottom - bounds.top) * 1.08 / 76;
}
