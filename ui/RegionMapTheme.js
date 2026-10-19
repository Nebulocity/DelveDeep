import { UI_FONT_SIZES, UI_FONT_FAMILIES } from '../config/uiTypography.js';
import { serviceFrame, serviceCard } from './TownServiceTheme.js';
import { bindButtonPress } from './ButtonPress.js';
import HapticsService from '../services/HapticsService.js';
import { showFeatureToast } from './FeatureToast.js';

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
  const art = (kind === 'card' ? serviceCard(scene, x, y, width, height, { selected: state === 'selected' })
    : kind === 'control' ? regionControl(scene, x, y, width, height, 'selected', true)
    : kind ? regionControl(scene, x, y, width, height, kind)
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

// Dense controls reuse Town's smaller painted corners, with one restrained state
// accent rather than another large ornamental frame around every action.
function regionControl(scene, x, y, width, height, kind = 'selected', restrained = false) {
  const frame = serviceFrame(scene, 0, 0, width, height, kind, restrained ? 0.55 : 1);
  const accent = scene.add.graphics();
  const art = scene.add.container(x, y, [frame, accent]).setSize(width, height);
  art.hidePressShadow = true;
  art.setRegionState = state => {
    accent.clear();
    if (state === 'selected' || state === 'danger') {
      const color = state === 'danger' ? 0xe59b87 : 0xffdb86;
      accent.fillStyle(color, 0.09).fillRect(-width / 2 + 18, -height / 2 + 14, width - 36, height - 28);
      accent.lineStyle(3, color, 0.95).lineBetween(-width / 2 + 24, height / 2 - 12, width / 2 - 24, height / 2 - 12);
    }
  };
  return art;
}

export function setRegionPanelState(scene, panel, state = 'normal', alpha = 1) {
  const art = panel.regionMapArt;
  if (panel.regionMapState !== state || !panel.regionMapStyled) {
    art.setSelected?.(state === 'selected');
    art.setRegionState?.(state);
    if (!art.setRegionState) {
      if (state === 'danger') art.list?.[0]?.setTint?.(0xb87970);
      else art.list?.[0]?.clearTint?.();
    }
    panel.regionButtonText?.setColor(state === 'selected' ? '#ffdb86' : state === 'danger' ? '#ffd5c6' : '#fff1d2');
    panel.regionMapState = state;
    panel.regionMapStyled = true;
  }
  art.setAlpha(alpha);
}

export function addRegionButton(scene, x, y, width, height, label, action, { depth = 1002, enabled = true, disabledReason, state = 'normal', icon, restrained = false, haptic = true } = {}) {
  const panel = addRegionPanel(scene, x, y, width, height, depth, state, true,
    restrained || width < 240 ? 'control' : state === 'selected' ? 'selected' : 'option');
  const text = scene.add.text(x, y, label, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: UI_FONT_SIZES.body32,
    fontStyle: 'bold', color: state === 'selected' ? '#ffdb86' : state === 'danger' ? '#ffd5c6' : '#fff1d2',
    align: 'center', wordWrap: { width: width - (restrained ? 40 : 72) }
  }).setOrigin(0.5).setDepth(depth + 1).setScrollFactor(0);
  panel.regionButtonText = text;
  panel.regionMapArt.setAlpha(enabled ? 1 : 0.5);
  text.setAlpha(enabled ? 1 : 0.5);
  const image = icon ? scene.add.image(x, y, icon).setDisplaySize(width - 8, height - 8)
    .setScrollFactor(0).setDepth(depth + 1) : null;
  if (image) {
    panel.pressVisuals.push(image);
    panel.once('destroy', () => image.destroy());
  }
  {
    panel.setInteractive({ useHandCursor: true });
    panel.uiSound = enabled ? 'click' : 'failure';
    bindButtonPress(scene, panel, [text], () => {
      if (!enabled) {
        HapticsService.tap();
        showFeatureToast(scene, disabledReason || `${label} is currently unavailable.`, { centered: true });
        return;
      }
      if (haptic) HapticsService.tap();
      return action();
    });
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
