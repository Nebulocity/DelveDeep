import { serviceFrame, serviceText } from './TownServiceTheme.js';
import HapticsService from '../services/HapticsService.js';

const active = new WeakMap();

export function clearFeatureToast(scene) {
  const toast = active.get(scene);
  if (!toast) return;
  active.delete(scene);
  toast.timer?.remove();
  scene.events.off('shutdown', toast.onShutdown);
  toast.objects.forEach(object => { if (object.active) object.destroy(); });
}

// One non-interactive toast per scene replaces rapid repeats rather than stacking.
// Gameplay restrictions supply their own factual message; only unfinished work jokes.
export function showFeatureToast(scene, message, { centered = false } = {}) {
  clearFeatureToast(scene);
  const { width, height } = scene.scale;
  const panelWidth = Math.min(1150, width - 160);
  const label = serviceText(scene, width / 2, centered ? height / 2 : height - 182, message, 'body34', {
    align: 'center', wordWrap: { width: panelWidth - 110 }
  }).setOrigin(0.5).setDepth(20001).setScrollFactor(0);
  const panelHeight = Math.max(98, label.height + 44);
  const panel = (scene.textures.exists('town-hub-option')
    ? serviceFrame(scene, width / 2, label.y, panelWidth, panelHeight, 'option')
    : scene.add.rectangle(width / 2, label.y, panelWidth, panelHeight, 0x151c22).setStrokeStyle(3, 0xd3a750))
    .setDepth(20000).setScrollFactor(0);
  const toast = { objects: [panel, label] };
  if (scene.mapUiCamera) {
    for (const object of toast.objects) {
      object.cameraFilter = (object.cameraFilter | scene.cameras.main.id) & ~scene.mapUiCamera.id;
    }
  }
  toast.onShutdown = () => clearFeatureToast(scene);
  active.set(scene, toast);
  scene.events.once('shutdown', toast.onShutdown);
  toast.timer = scene.time.delayedCall(2500, () => clearFeatureToast(scene));
}

export function unavailableFeature(scene) {
  HapticsService.tap();
  showFeatureToast(scene, 'The kobolds are still building this one!');
}
