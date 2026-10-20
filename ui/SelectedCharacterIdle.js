import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import { applyCharacterPose, characterDisplayMetrics } from './CharacterSpriteDisplay.js';

// Selection screens need only portraits and south-facing idle sheets. Queue each
// missing texture once, including characters whose held portrait uses another sheet.
export function preloadSelectionPortraits(scene) {
  const queued = new Set();
  for (const definition of Object.values(CHARACTER_SPRITES)) {
    const keys = new Set([definition.portraitFrame?.key,
      ...definition.clips.idle.south.frames.map(frame => frame.key)]);
    for (const texture of definition.textures) {
      if (!keys.has(texture.key) || queued.has(texture.key) || scene.textures.exists(texture.key)) continue;
      queued.add(texture.key);
      scene.load.spritesheet(texture.key, texture.url, { frameWidth: 256, frameHeight: 256 });
    }
  }
}

// Use the existing clip's timing and authored origins on an ordinary image. Only
// selected, visible entries own a timer; selection and scrolling drive state changes.
export function bindSelectedCharacterIdle(scene, image, definition, selected = false) {
  const clip = definition?.clips.idle.south;
  if (!clip?.frames.length || !clip.frames.every(frame => scene.textures.exists(frame.key))) return image;
  let timer = null, index = 0, inView = true, disposed = false;
  const suspended = new Set();
  const stop = () => { timer?.remove(false); timer = null; };
  const pose = () => applyCharacterPose(image, clip.frames[index]);
  const refresh = () => {
    stop();
    index = 0;
    pose();
    if (!selected || !inView || suspended.size || disposed || clip.frames.length < 2) return;
    timer = scene.time.addEvent({ delay: clip.frameMs, loop: true, callback: () => {
      index = (index + 1) % clip.frames.length;
      pose();
    } });
  };
  const sleep = () => { suspended.add('scene'); refresh(); };
  const wake = () => { suspended.delete('scene'); refresh(); };
  const hide = () => { suspended.add('game'); refresh(); };
  const show = () => { suspended.delete('game'); refresh(); };
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    stop();
    for (const event of ['sleep', 'pause']) scene.events.off(event, sleep);
    for (const event of ['wake', 'resume']) scene.events.off(event, wake);
    scene.events.off('shutdown', cleanup);
    scene.game.events.off('hidden', hide).off('visible', show);
    image.off('destroy', cleanup);
  };
  image.selectionIdle = {
    setSelected(value) { if (selected !== value) { selected = value; refresh(); } },
    setInView(value) { if (inView !== value) { inView = value; refresh(); } }
  };
  for (const event of ['sleep', 'pause']) scene.events.on(event, sleep);
  for (const event of ['wake', 'resume']) scene.events.on(event, wake);
  scene.game.events.on('hidden', hide).on('visible', show);
  scene.events.once('shutdown', cleanup);
  image.once('destroy', cleanup);
  refresh();
  return image;
}

export function selectionCharacterPortrait(scene, hero, x, y, size, profile = 'townRoster', selected = false) {
  const definition = CHARACTER_SPRITES[hero.id];
  const clip = definition?.clips.idle.south;
  const first = clip?.frames[0];
  if (!first || !scene.textures.exists(first.key)) return scene.add.circle(x, y, size / 3, hero.color);
  scene.textures.get(first.key).setFilter(1);
  const image = scene.add.image(x, y, first.key, first.frame).setName(`selection-idle-${hero.id}`);
  const metrics = characterDisplayMetrics(scene, definition, profile, { source: clip, size, width: size, height: size });
  if (metrics) {
    const { bounds, scale } = metrics;
    image.setScale(scale).setPosition(x - (bounds.left + bounds.right) * scale / 2,
      y - (bounds.top + bounds.bottom) * scale / 2);
  }
  return bindSelectedCharacterIdle(scene, image, definition, selected);
}

// Masked scroll lists retain their objects. Suspend their timers as soon as the
// artwork leaves the viewport, and resume from the held frame when it returns.
export function refreshSelectionIdleVisibility(objects, bounds) {
  for (const object of objects) {
    if (!object.selectionIdle) continue;
    const rect = object.getBounds();
    object.selectionIdle.setInView(object.visible && rect.bottom > bounds.y && rect.top < bounds.y + bounds.height
      && rect.right > bounds.x && rect.left < bounds.x + bounds.width);
  }
}
