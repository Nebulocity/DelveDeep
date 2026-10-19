// Animate only the artwork. The existing button keeps its fixed touch target,
// sound and haptics. Phaser's scene updates stop while the scene is inactive.
export function animateSettingsCog(scene, image, target, isOpen = () => false) {
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  image.setOrigin(0.5);
  image.texture.setFilter(1);
  let boost = 0;
  const respond = () => { boost = 6; };
  const update = (_time, delta) => {
    if (reducedMotion?.matches || !image.active || !image.visible) return;
    const seconds = Math.min(delta, 100) / 1000;
    boost *= Math.exp(-seconds * 6);

    // One clockwise revolution per six seconds. A tap adds roughly a sixth
    // of a turn, with most of the mechanical burst settling in half a second.
    // Ease to rest while Settings is open after the response has settled.
    image.rotation = (image.rotation + Math.PI / 3 * seconds * (isOpen() ? boost : 1 + boost)) % (Math.PI * 2);
  };
  const cleanup = () => {
    scene.events.off('update', update);
    scene.events.off('shutdown', cleanup);
    target.off('pointerup', respond);
    image.off('destroy', cleanup);
  };
  target.on('pointerup', respond);
  scene.events.on('update', update);
  scene.events.once('shutdown', cleanup);
  image.once('destroy', cleanup);
  return image;
}
