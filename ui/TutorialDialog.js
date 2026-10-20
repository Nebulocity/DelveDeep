import { serviceCard, serviceText, serviceButton, serviceScrollSurface } from './TownServiceTheme.js';
import { hallScroll } from './HallUI.js';
import { playUiSound } from '../services/UiAudioService.js';

// Recruitment uses the current charcoal service surfaces and release-based controls.
// Keep this small presentation helper separate from the saved recruitment transaction.
export function showTutorialDialog(scene, { title, description, confirmLabel = 'OK', onConfirm,
  onCancel, cancelLabel = 'CANCEL' }) {
  scene.selectionDetailsClose?.();
  scene.mapLocationClose?.();
  playUiSound(scene, 'dialogOpen');
  const { width, height } = scene.scale;
  const panelWidth = Math.min(1200, width - 120);
  const depth = 11000;
  const objects = [];
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scene.events.off('shutdown', close);
    if (scene.selectionDetailsClose === close) scene.selectionDetailsClose = null;
    objects.forEach(object => object.destroy());
  };
  const keep = object => {
    objects.push(object);
    return object.setScrollFactor(0);
  };
  const body = keep(serviceText(scene, 0, 0, description, 'body34', {
    wordWrap: { width: panelWidth - 104 }, lineSpacing: 9
  }).setDepth(depth + 3));
  const heading = keep(serviceText(scene, width / 2, 0, title, 'heading42', {
    align: 'center', wordWrap: { width: panelWidth - 104 }
  }).setOrigin(0.5, 0).setDepth(depth + 3));
  const panelHeight = Math.min(height - 140, Math.max(360, heading.height + body.height + 228));
  const top = (height - panelHeight) / 2;
  heading.setY(top + 38);
  body.setPosition(width / 2 - panelWidth / 2 + 52, top + heading.height + 64);
  const stop = (pointer, x, y, event) => event?.stopPropagation?.();
  const shade = keep(scene.add.rectangle(width / 2, height / 2, width, height, 0, 0.68)
    .setDepth(depth).setInteractive());
  shade.on('pointerdown', stop).on('pointerup', stop);
  const panel = keep(serviceCard(scene, width / 2, height / 2, panelWidth, panelHeight)
    .setDepth(depth + 1).setInteractive());
  panel.on('pointerdown', stop).on('pointerup', stop);
  const bodyHeight = panelHeight - heading.height - 202;
  if (body.height > bodyHeight) {
    const scroll = hallScroll(scene, { x: body.x, y: body.y, width: panelWidth - 104, height: bodyHeight },
      [body], body.height, 0, () => {},
      (owner, x, y, w, h, variant) => serviceScrollSurface(owner, x, y, w, h, variant).setDepth(depth + 3),
      () => scene.selectionDetailsClose !== close);
    objects.splice(objects.indexOf(body), 1);
    keep(scroll.container.setDepth(depth + 3));
  }
  const addButton = (x, label, action, controlWidth) => {
    const control = serviceButton(scene, x, top + panelHeight - 66, controlWidth, 92, label, () => {
      if (closed) return;
      close();
      return action?.();
    }, { compact: true, depth: depth + 4, name: `tutorial-dialog-${label.toLowerCase().replaceAll(' ', '-')}` });
    for (const object of [...control.visuals, control.target]) keep(object);
  };
  if (onCancel) {
    addButton(width / 2 - panelWidth / 4 + 13, cancelLabel, () => {
      playUiSound(scene, 'dialogClose');
      return onCancel();
    }, panelWidth / 2 - 78);
    addButton(width / 2 + panelWidth / 4 - 13, confirmLabel, onConfirm, panelWidth / 2 - 78);
  } else {
    addButton(width / 2, confirmLabel, onConfirm, 300);
    shade.on('pointerdown', () => { close(); playUiSound(scene, 'dialogClose'); });
  }
  scene.selectionDetailsClose = close;
  scene.events.once('shutdown', close);
  return close;
}
