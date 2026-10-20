import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { saveProfile } from '../game/GameStorage.js';
import { pois } from '../data/worldMap.js';
import { serviceFrame, serviceText, serviceIcon, serviceButton, serviceScrollSurface } from './TownServiceTheme.js';
import { hallScroll, preloadHallPortraits } from './HallUI.js';
import { UI_FONT_FAMILIES } from '../config/uiTypography.js';
import { clearFeatureToast } from './FeatureToast.js';
import HapticsService from '../services/HapticsService.js';
import { bindButtonPress } from './ButtonPress.js';
import { playUiSound } from '../services/UiAudioService.js';
import { showAbilityUnlockNotice } from './AbilityUnlockNotice.js';

export function featurePanel(scene, bounds) {
  return serviceFrame(scene, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, bounds.width, bounds.height);
}

export function currentTownArtwork() {
  const town = pois.find(poi => poi.id === GameState.world.currentLocation && poi.type === 'town');
  return town?.id === 'pineshire' ? 'town' : town?.conceptArt ?? 'town';
}

export function featureBody(scene, bounds, value, offset = 0, onScroll = () => {}) {
  const body = serviceText(scene, bounds.x, bounds.y, value, 'body34', {
    fontFamily: UI_FONT_FAMILIES.sans, wordWrap: { width: bounds.width - 12 }, lineSpacing: 10
  });
  return hallScroll(scene, bounds, [body], body.height, offset, onScroll, serviceScrollSurface);
}

export function featureList(scene, bounds, entries, draw, { stride = 150, offset = 0, onScroll = () => {} } = {}) {
  const retained = new Set(scene.children.list);
  entries.forEach((entry, index) => draw(entry, bounds.x, bounds.y + index * stride, bounds.width, index));
  return hallScroll(scene, bounds, scene.children.list.filter(object => !retained.has(object)),
    entries.length * stride, offset, onScroll, serviceScrollSurface);
}

export function featureSelect(scene, x, y, width, height, onTap, { name, visuals = [] } = {}) {
  const hit = scene.add.rectangle(x, y, width, height, 0, 0).setName(name ?? 'feature-selection')
    .setInteractive({ useHandCursor: true });
  hit.pressVisuals = visuals;
  bindButtonPress(scene, hit, [], () => { HapticsService.tap(); onTap(); });
  const cancelDrag = pointer => {
    if (pointer.isDown && Math.hypot(pointer.x - pointer.downX, pointer.y - pointer.downY) > 24) hit.emit('pointerout');
  };
  scene.input.on('pointermove', cancelDrag);
  hit.once('destroy', () => scene.input.off('pointermove', cancelDrag));
  return hit;
}

// The shared shell owns lifecycle and styling, not feature composition or gameplay.
export default class TownFeatureScene extends Phaser.Scene {
  constructor(key, characterFeature = false) {
    super(key);
    this.characterFeature = characterFeature;
  }

  preload() { if (this.characterFeature) preloadHallPortraits(this); }

  create() {
    this.message = '';
    this.leaving = false;
    const resize = () => this.render();
    const back = () => {
      if (this.selectionDetailsClose) { playUiSound(this, 'dialogClose'); this.selectionDetailsClose(); }
      else this.backToTown();
    };
    this.scale.on('resize', resize);
    this.input.keyboard?.on('keydown-ESC', back);
    this.events.once('shutdown', () => {
      this.scale.off('resize', resize);
      this.input.keyboard?.off('keydown-ESC', back);
      this.selectionDetailsClose?.();
      clearFeatureToast(this);
    });
    this.render();
    showAbilityUnlockNotice(this);
  }

  backToTown() {
    if (this.leaving) return;
    this.leaving = true;
    playUiSound(this, 'navigation');
    this.scene.start('TownScene');
  }

  frame(title, icon, { resource = '', hint = 'Drag lists to browse.', background = 'adventurers-hall' } = {}) {
    this.selectionDetailsClose?.();
    clearFeatureToast(this);
    for (const object of [...this.children.list]) if (object.active) object.destroy();
    const { width, height } = this.scale;
    const image = this.add.image(width / 2, height / 2, background);
    image.setScale(Math.max(width / image.width, height / image.height));
    const town = pois.find(poi => poi.id === GameState.world.currentLocation && poi.type === 'town');
    serviceFrame(this, width / 2, 68, width - 104, 126, 'bar');
    serviceButton(this, 267, 68, 398, 96, 'Back to Town', () => this.backToTown(), { icon: 'town-hub-world-map' });
    serviceIcon(this, `town-hub-${icon}`, width / 2 - 290, 68, 86);
    serviceText(this, width / 2, 26, town?.name ?? 'Town', 'support28', { color: '#dfbf7a' }).setOrigin(0.5);
    serviceText(this, width / 2, 79, title, 'display54').setOrigin(0.5);
    serviceText(this, width - 84, 68, resource, 'body34', { wordWrap: { width: 510 }, align: 'right' }).setOrigin(1, 0.5);
    serviceText(this, width / 2, height - 84, this.message || hint, 'body32', {
      wordWrap: { width: width - 180 }, align: 'center', fontFamily: UI_FONT_FAMILIES.sans
    }).setOrigin(0.5).setName('feature-feedback');
    return { x: 52, y: 164, width: width - 104, height: height - 300, bottom: height - 136 };
  }

  commit(result, sound = 'success') {
    this.message = result.message;
    playUiSound(this, result.ok ? sound : 'failure');
    if (result.ok) { saveProfile(); HapticsService.confirm(); }
    this.render();
  }
}
