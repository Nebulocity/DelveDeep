import { bindButtonPress } from './ButtonPress.js';
import HapticsService from '../services/HapticsService.js';

const PARTS = ['up', 'down', 'up-disabled', 'down-disabled', 'thumb', 'thumb-active',
  'track-top', 'track-middle', 'track-bottom'];
const key = part => `scrollbar-${part}`;

export function preloadScrollbarAssets(scene) {
  for (const part of PARTS) {
    if (!scene.textures.exists(key(part))) {
      scene.load.image(key(part), new URL(`../assets/ui/scrollbar/${part}.png`, import.meta.url).href);
    }
  }
}

function trackArtwork(scene, width, height) {
  const top = scene.add.image(0, 0, key('track-top')).setOrigin(0.5, 0);
  const middle = scene.add.image(0, 0, key('track-middle')).setOrigin(0.5, 0);
  const bottom = scene.add.image(0, 0, key('track-bottom')).setOrigin(0.5, 1);

  // Only the undecorated channel changes length. Uniform cap scaling preserves both jewels.
  const scale = Math.min(width / top.width, height / (top.height + bottom.height + 1));
  top.setScale(scale).setY(-height / 2);
  bottom.setScale(scale).setY(height / 2);
  middle.setPosition(0, -height / 2 + top.displayHeight)
    .setDisplaySize(top.displayWidth, Math.max(1, height - top.displayHeight - bottom.displayHeight));
  return [middle, top, bottom];
}

// Controllers retain a proportional logical thumb. Its fixed-aspect artwork has its own
// center travel, so it reaches both track ends without stretching the diamond or caps.
export function scrollbarSurface(scene, x, y, width, height, kind, depth = 0) {
  const thumb = kind === 'thumb';
  const pieces = thumb
    ? [scene.add.image(0, 0, key('thumb')), scene.add.image(0, 0, key('thumb-active'))]
    : trackArtwork(scene, Math.min(14, width - 6), Math.max(4, height - 4));
  const surface = scene.add.container(x, y, pieces).setSize(width, height).setDepth(depth)
    .setName(`scrollbar-${kind}`);
  let hover = false;
  let pressed = false;
  let visualHeight = height;
  let artworkOffset = 0;
  let grabOffset = 0;
  let dragging = false;
  const paint = () => {
    if (!thumb) return;
    pieces[0].setVisible(!hover && !pressed);
    pieces[1].setVisible(hover || pressed);
  };
  surface.setScrollbarProgress = (progress, trackHeight) => {
    if (!thumb) return;
    const p = Math.max(0, Math.min(1, progress));
    const scale = Math.min(Math.min(24, width - 4) / pieces[0].width,
      76 / pieces[0].height, Math.max(4, trackHeight - 4) / pieces[0].height);
    pieces.forEach(piece => piece.setScale(scale));
    visualHeight = pieces[0].displayHeight;

    // Logical center: top + height/2 + p*(trackHeight-height).
    // Art center: top + visualHeight/2 + p*(trackHeight-visualHeight).
    artworkOffset = (visualHeight - height) * (0.5 - p);
    pieces.forEach(piece => piece.setY(artworkOffset));
    if (surface.input?.hitArea?.setTo) {
      const targetHeight = Math.max(height, visualHeight);
      const trackTop = -height / 2 - p * (trackHeight - height);
      const hitTop = Math.max(trackTop, artworkOffset - targetHeight / 2);
      const hitBottom = Math.min(trackTop + trackHeight, artworkOffset + targetHeight / 2);
      surface.input.hitArea.setTo(0, height / 2 + hitTop, width, Math.max(1, hitBottom - hitTop));
      surface.input.customHitArea = true;
    }
  };
  surface.scrollbarProgressFromPointer = (pointerY, trackTop, trackHeight, keepGrabOffset = false) => {
    const center = pointerY - (keepGrabOffset ? grabOffset : 0);
    return Math.max(0, Math.min(1,
      (center - trackTop - visualHeight / 2) / Math.max(1, trackHeight - visualHeight)));
  };
  surface.setScrollbarProgress(0, height);
  paint();
  surface.setScrollbarInteraction = (over, held) => {
    hover = over;
    pressed = held;
    paint();
  };
  surface.on('dragstart', () => { dragging = true; });
  surface.on('pointerover', () => { hover = true; paint(); });
  surface.on('pointerout', () => { hover = false; if (!dragging) pressed = false; paint(); });
  surface.on('pointerdown', pointer => {
    pressed = true;
    grabOffset = pointer.y - (surface.y + artworkOffset);
    paint();
  });
  const release = () => { pressed = false; dragging = false; paint(); };
  surface.on('pointerup', release).on('dragend', release);
  scene.input.on('pointerup', release).on('gameout', release);
  scene.game.events.on('blur', release);
  surface.once('destroy', () => {
    scene.input.off('pointerup', release).off('gameout', release);
    scene.game.events.off('blur', release);
  });
  return surface;
}

export function scrollbarArrow(scene, x, y, direction, action, depth = 3) {
  const part = direction < 0 ? 'up' : 'down';
  const normal = scene.add.image(0, 0, key(part));
  const disabled = scene.add.image(0, 0, key(part + '-disabled'));
  for (const image of [normal, disabled]) image.setScale(Math.min(44 / image.width, 44 / image.height));
  const face = scene.add.container(x, y, [normal, disabled]).setDepth(depth);
  const button = scene.add.rectangle(x, y, 56, 56, 0, 0).setDepth(depth + 0.2)
    .setInteractive({ useHandCursor: true }).setName(direction < 0 ? 'scrollbar-up' : 'scrollbar-down');
  let enabled = true;
  button.pressVisuals = [face];
  button.hidePressShadow = true;
  face.hidePressShadow = true;
  button.setScrollbarEnabled = value => {
    enabled = value;
    normal.setVisible(enabled);
    disabled.setVisible(!enabled);
  };
  button.setScrollbarEnabled(true);
  button.setVisible = visible => {
    button.visible = visible;
    face.setVisible(visible);
    return button;
  };
  bindButtonPress(scene, button, [], () => { if (enabled) { HapticsService.tap(); action(); } });
  button.once('destroy', () => { if (face.scene) face.destroy(); });
  return { button, text: face };
}
