import { tutorialSlides } from '../data/tutorial.js';
import { addRegionPanel, setRegionPanelState } from './RegionMapTheme.js';
import { syncRegionMapCameras } from './RegionMapUI.js';
import { bindButtonPress } from './ButtonPress.js';
import HapticsService from '../services/HapticsService.js';

export function showTutorialSlideshow(scene) {
  scene.selectionDetailsClose?.();
  const { width, height } = scene.scale;
  const cx = width / 2;
  const depth = 10000;
  const objects = [];
  let index = 0;
  let video = null;
  let paused = false;
  let closed = false;
  const keep = object => { objects.push(object); return object; };
  const text = (x, y, value, size, options = {}) => keep(scene.add.text(x, y, value, {
    fontFamily: 'Arial', fontSize: `${size}px`, color: '#f1f8ec', align: 'center', ...options
  }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 3));
  const close = () => {
    if (closed) return;
    closed = true;
    video?.destroy();
    objects.forEach(object => object.destroy());
    scene.selectionDetailsClose = null;
    scene.events.off('shutdown', close);
  };
  scene.selectionDetailsClose = close;
  scene.events.once('shutdown', close);
  keep(scene.add.rectangle(cx, height / 2, width, height, 0x000000, 0.78)
    .setScrollFactor(0).setDepth(depth).setInteractive());
  keep(addRegionPanel(scene, cx, height / 2, width - 120, height - 60, depth + 1)).setInteractive();
  text(cx, 80, 'WELCOME TO DELVE DEEP', 38, { fontStyle: 'bold', color: '#f2d79f' });
  const title = text(cx, 137, '', 36, { fontStyle: 'bold' });
  const caption = text(cx, height - 236, '', 32, { wordWrap: { width: width - 330 }, fixedWidth: width - 330 });
  const status = text(cx, 472, 'Loading gameplay...', 34);
  const count = text(cx, height - 66, '', 28, { color: '#b4c4af' });
  const button = (x, label, action, buttonWidth = 310) => {
    const panel = keep(addRegionPanel(scene, x, height - 136, buttonWidth, 82, depth + 4))
      .setInteractive({ useHandCursor: true }).setName(`tutorial-${label.toLowerCase()}`);
    const caption = text(x, height - 136, label, 32, { fontStyle: 'bold' }).setDepth(depth + 5);
    bindButtonPress(scene, panel, [caption], () => { HapticsService.tap(); action(); });
    return { panel, caption };
  };
  const previous = button(cx - 750, 'PREVIOUS', () => show(index - 1));
  const playback = button(cx - 250, 'PAUSE', () => {
    if (!video) return;
    paused = !paused;
    video.setPaused(paused);
    playback.caption.setText(paused ? 'PLAY' : 'PAUSE');
  });
  button(cx + 250, 'REPLAY', () => {
    if (video?.video?.error) { show(index); return; }
    video?.setCurrentTime(0).setPaused(false);
    paused = false;
    playback.caption.setText('PAUSE');
  });
  const next = button(cx + 750, 'NEXT', () => show(index + 1));
  const closePanel = keep(addRegionPanel(scene, width - 235, 87, 270, 74, depth + 4))
    .setInteractive({ useHandCursor: true }).setName('tutorial-close');
  const closeLabel = text(width - 235, 87, 'CLOSE', 32).setDepth(depth + 5);
  bindButtonPress(scene, closePanel, [closeLabel], () => { HapticsService.tap(); close(); });
  const enable = (control, enabled) => {
    control.panel.input.enabled = enabled;
    control.caption.setAlpha(enabled ? 1 : 0.4);
    setRegionPanelState(scene, control.panel, 'normal', enabled ? 1 : 0.4);
  };
  function show(nextIndex) {
    if (nextIndex < 0 || nextIndex >= tutorialSlides.length) return;
    index = nextIndex;
    paused = false;
    video?.destroy();
    const slide = tutorialSlides[index];
    title.setText(slide.title);
    caption.setText(slide.caption);
    count.setText(`${index + 1} of ${tutorialSlides.length}`);
    playback.caption.setText('PAUSE');
    enable(previous, index > 0);
    enable(next, index < tutorialSlides.length - 1);
    status.setText('Loading gameplay...').setVisible(true);
    const current = scene.add.video(cx, 472).setScrollFactor(0).setDepth(depth + 2).setName('tutorial-video');
    video = current;
    current.once('created', () => {
      if (closed || video !== current) return;
      current.setScale(Math.min((width - 420) / current.width, 570 / current.height));
      status.setVisible(false);
    });
    current.on('error', () => status.setText('Unable to play this clip. Tap Replay to try again.').setVisible(true));
    current.loadURL(slide.video, true).play(true);
    syncRegionMapCameras(scene);
  }
  show(0);
}
