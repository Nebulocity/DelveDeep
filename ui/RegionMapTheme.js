import { UI_FONT_SIZES, UI_FONT_FAMILIES } from '../config/uiTypography.js';
import { serviceFrame, serviceCard } from './TownServiceTheme.js';
import { bindButtonPress } from './ButtonPress.js';
import HapticsService from '../services/HapticsService.js';

export function regionMessageBounds(scene, scope = 'ui') {
  const camera = scope === 'map' && scene.mapUiCamera ? scene.cameras.main : null;
  if (camera) {
    const left = Math.max(0, camera.x);
    const right = Math.min(scene.scale.width, camera.x + camera.width);
    return { centerX: left + (right - left) / 2, width: right - left };
  }
  return { centerX: scene.scale.width / 2, width: scene.scale.width };
}

// Keep existing map hit targets while sharing Town's painted frames and charcoal
// cards. Decorative art never takes input or changes camera ownership.
export function addRegionPanel(scene, x, y, width, height, depth = 1000, state = 'normal', fixed = true, kind) {
  const compact = height < 110 || width < 110;
  const art = (kind ? serviceFrame(scene, x, y, width, height, kind)
    : compact ? serviceCard(scene, x, y, width, height, { selected: state === 'selected' })
    : serviceFrame(scene, x, y, width, height, width > height * 6 ? 'bar' : 'panel'))
    .setScrollFactor(fixed ? 0 : 1).setDepth(depth - 0.01)
    .setName(fixed ? 'region-map-surface' : 'region-map-world-surface');
  const hit = scene.add.rectangle(x, y, width, height, 0, 0)
    .setScrollFactor(fixed ? 0 : 1).setDepth(depth).setName('region-map-panel');
  hit.regionMapArt = art;
  hit.regionMapState = state;
  hit.pressVisuals = [art];
  hit.once('destroy', () => art.destroy());
  setRegionPanelState(scene, hit, state);
  return hit;
}

export function setRegionPanelState(scene, panel, state = 'normal', alpha = 1) {
  const art = panel.regionMapArt;
  if (panel.regionMapState !== state || !panel.regionMapStyled) {
    art.setSelected?.(state === 'selected');
    if (state === 'danger') art.list?.[0]?.setTint?.(0xb87970);
    else art.list?.[0]?.clearTint?.();
    panel.regionMapState = state;
    panel.regionMapStyled = true;
  }
  art.setAlpha(alpha);
}

export function addRegionButton(scene, x, y, width, height, label, action, { depth = 1002, enabled = true, state = 'normal', icon } = {}) {
  const panel = addRegionPanel(scene, x, y, width, height, depth, state, true,
    width >= 240 ? state === 'selected' ? 'selected' : 'option' : undefined);
  const text = scene.add.text(x, y, label, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: UI_FONT_SIZES.body32,
    fontStyle: 'bold', color: '#fff1d2', align: 'center', wordWrap: { width: width - 36 }
  }).setOrigin(0.5).setDepth(depth + 1).setScrollFactor(0);
  panel.regionMapArt.setAlpha(enabled ? 1 : 0.5);
  text.setAlpha(enabled ? 1 : 0.5);
  const image = icon ? scene.add.image(x, y, icon).setDisplaySize(width - 8, height - 8)
    .setScrollFactor(0).setDepth(depth + 1) : null;
  if (image) {
    panel.pressVisuals.push(image);
    panel.once('destroy', () => image.destroy());
  }
  if (enabled) {
    panel.setInteractive({ useHandCursor: true });
    bindButtonPress(scene, panel, [text], () => { HapticsService.tap(); action(); });
    const cancelDrag = pointer => {
      if (pointer.isDown && Math.hypot(pointer.x - pointer.downX, pointer.y - pointer.downY) > 24) panel.emit('pointerout');
    };
    scene.input.on('pointermove', cancelDrag);
    panel.once('destroy', () => scene.input.off('pointermove', cancelDrag));
  }
  return { panel, text, objects: [panel.regionMapArt, panel, text] };
}

export function addRegionNotice(scene, x, y, message, { width = 1100, fontSize = UI_FONT_SIZES.body32, depth = 5200 } = {}) {
  const text = scene.add.text(x, y, message, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: `${fontSize}px`, color: '#fff1d2', align: 'center',
    wordWrap: { width: width - 90 }, stroke: '#11161b', strokeThickness: 2
  }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
  const panel = addRegionPanel(scene, x, y, Math.min(width, text.width + 90), Math.max(84, text.height + 48), depth);
  text.once('destroy', () => panel.destroy());
  return { panel, text };
}
