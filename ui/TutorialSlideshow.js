// The tutorial loads the current slide's silent video and lets the player pause, replay or
// change slides. Only the active clip needs a player. Close and scene shutdown must stop
// playback and remove listeners so hidden tutorial clips do not keep running.

import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { tutorialSlides } from '../data/tutorial.js';
import { addRegionPanel, addRegionButton, setRegionPanelState } from './RegionMapTheme.js';
import { syncRegionMapCameras } from './RegionMapUI.js';

// Open the video tutorial with slide navigation, playback controls and complete cleanup.
// scene is the Phaser screen that owns the objects, clock and input used here.
export function showTutorialSlideshow(scene) {

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  scene.selectionDetailsClose?.();
  scene.mapLocationClose?.();

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { width, height } = scene.scale;
  const cx = width / 2;
  const depth = 10000;
  const objects = [];
  let index = 0;
  let video = null;
  let paused = false;

  let closed = false;
  const keep = object => {
    objects.push(object);
    return object;
  };
  const text = (x, y, value, size, options = {}) => keep(scene.add.text(x, y, value, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: `${size}px`, color: '#fff1d2', align: 'center', ...options
  }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 3));
  const close = () => {
    if (closed) return;
    closed = true;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    video?.destroy();
    objects.forEach(object => object.destroy());
    scene.selectionDetailsClose = null;
    scene.events.off('shutdown', close);
  };

  scene.selectionDetailsClose = close;

  // once registers a callback that removes itself after the first matching event.
  scene.events.once('shutdown', close);

  // This gives the display object an input hit area. Visible artwork alone does not make
  // an object respond to a tap. Depth is drawing order, not distance or size. Higher-depth
  // objects draw on top of lower-depth objects. Scroll factor controls how much the object
  // follows the camera. Zero keeps it fixed while the world scrolls.
  const stop = (pointer, x, y, event) => event?.stopPropagation?.();
  keep(scene.add.rectangle(cx, height / 2, width, height, 0x000000, 0.72)
    .setScrollFactor(0).setDepth(depth).setInteractive()).on('pointerdown', stop).on('pointerup', stop);
  keep(addRegionPanel(scene, cx, height / 2, width - 120, height - 96, depth + 1))
    .setInteractive().on('pointerdown', stop).on('pointerup', stop);
  text(cx, 116, 'HOW TO PLAY', UI_FONT_SIZES.heading38, { fontStyle: UI_FONT_WEIGHTS.bold, color: '#f2d79f' });
  const title = text(cx, 176, '', UI_FONT_SIZES.body36, {
    fontStyle: UI_FONT_WEIGHTS.bold, wordWrap: { width: width - 600 }
  });

  // Keep each short instruction below the video, with larger phone-readable text.
  const caption = text(cx, height - 236, '', UI_FONT_SIZES.body36, { wordWrap: { width: width - 330 }, fixedWidth: width - 330 }).setName('tutorial-caption');
  const status = text(cx, 472, 'Loading gameplay...', UI_FONT_SIZES.body34, { wordWrap: { width: width - 500 } });

  const count = text(cx, height - 78, '', UI_FONT_SIZES.support28, { color: '#c6bdac' });
  const button = (x, label, action, buttonWidth = 310) => {

    // This gives the display object an input hit area. Visible artwork alone does not make
    // an object respond to a tap.
    const control = addRegionButton(scene, x, height - 152, buttonWidth, 88, label, action, { depth: depth + 4 });
    const panel = keep(control.panel).setName(`tutorial-${label.toLowerCase()}`);
    const caption = keep(control.text);
    return { panel, caption };
  };

  const step = Math.min(500, (width - 300) / 4);
  const previous = button(cx - step * 1.5, 'PREVIOUS', () => show(index - 1));
  const playback = button(cx - step / 2, 'PAUSE', () => {
    if (!video) return;
    paused = !paused;
    video.setPaused(paused);

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    playback.caption.setText(paused ? 'PLAY' : 'PAUSE');
  });

  button(cx + step / 2, 'REPLAY', () => {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (video?.video?.error) {
      show(index);
      return;
    }
    video?.setCurrentTime(0).setPaused(false);
    paused = false;
    playback.caption.setText('PAUSE');
  });

  const next = button(cx + step * 1.5, 'NEXT', () => show(index + 1));
  const closeControl = addRegionButton(scene, width - 264, 116, 272, 88, 'CLOSE', close, { depth: depth + 4 });
  keep(closeControl.panel).setName('tutorial-close');
  keep(closeControl.text);
  const enable = (control, enabled) => {
    control.panel.input.enabled = enabled;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    control.caption.setAlpha(enabled ? 1 : 0.4);
    setRegionPanelState(scene, control.panel, 'normal', enabled ? 1 : 0.4);
  };

  // Load and display the chosen tutorial slide, replacing the previous video and captions.
  function show(nextIndex) {
    if (nextIndex < 0 || nextIndex >= tutorialSlides.length) return;
    index = nextIndex;
    paused = false;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    video?.destroy();
    const slide = tutorialSlides[index];
    title.setText(slide.title);
    caption.setText(slide.caption);
    caption.setY(height - 224 - caption.height / 2);
    const videoTop = Math.max(230, title.y + title.height / 2 + 24);
    const videoHeight = Math.max(120, caption.y - caption.height / 2 - 24 - videoTop);
    const videoY = videoTop + videoHeight / 2;
    status.setY(videoY);
    count.setText(`${index + 1} of ${tutorialSlides.length}`);
    playback.caption.setText('PAUSE');
    enable(previous, index > 0);

    enable(next, index < tutorialSlides.length - 1);
    status.setText('Loading gameplay...').setVisible(true);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. Scroll factor controls how much the object follows the camera.
    // Zero keeps it fixed while the world scrolls.
    const current = scene.add.video(cx, videoY).setScrollFactor(0).setDepth(depth + 2).setName('tutorial-video');
    video = current;

    // once registers a callback that removes itself after the first matching event.
    current.once('created', () => {
      if (closed || video !== current) return;

      // Math.min chooses the smallest value; pairing it with Math.max can keep a result
      // inside both a lower and an upper bound.
      current.setScale(Math.min((width - 420) / current.width, videoHeight / current.height));
      status.setVisible(false);
    });

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    current.on('error', () => status.setText('Unable to play this clip. Tap Replay to try again.').setVisible(true));
    current.loadURL(slide.video, true).play(true);
    syncRegionMapCameras(scene);
  }

  show(0);
}
