import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { TOWN_LAYOUTS, townLayout, setTownLayout } from '../game/TownPreferences.js';
import { TOWN_NAVIGATION, createTownAnimations } from './TownAssets.js';
import { getTownLayout } from './TownLayout.js';
import { bindButtonPress } from './ButtonPress.js';
import { UI_SAFE_LEFT, UI_SAFE_RIGHT } from './Layout.js';

export default class TownHub {
  constructor(scene) {
    this.scene = scene;
    this.objects = [];
    this.modalObjects = [];
    this.hits = [];
    this.badges = [];
    this.opening = false;
    this.modal = null;
    this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    createTownAnimations(scene);
    this.render();
    this.refreshTimer = scene.time.addEvent({ delay: 500, loop: true, callback: () => this.refresh() });
  }

  remember(object, modal = false) {
    (modal ? this.modalObjects : this.objects).push(object);
    return object;
  }

  text(x, y, value, slot = 'body36', depth = 12, modal = false, extra = {}) {
    return this.remember(this.scene.add.text(x, y, value, {
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: UI_FONT_SIZES[slot] * this.unit,
      fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2', stroke: '#16120d', strokeThickness: 3,
      align: 'center', ...extra
    }).setOrigin(0.5).setDepth(depth), modal);
  }

  frame(x, y, width, height, kind, depth = 10, modal = false) {
    if (kind === 'title' || this.scene.game.renderer.type !== Phaser.WEBGL) {
      return this.remember(this.scene.add.image(x, y, `town-hub-${kind}`)
        .setDisplaySize(width, height).setDepth(depth), modal);
    }

    // Nine-slicing preserves the painted corners while the textured center stretches.
    const slices = {
      bar: [100, 42], panel: [128, 128], capsule: [100, 35],
      option: [90, 62], button: [50, 50], selected: [50, 50]
    };
    const [border, vertical] = slices[kind];
    return this.remember(this.scene.add.nineslice(x, y, `town-hub-${kind}`, undefined,
      width / this.unit, height / this.unit, border, border, vertical, vertical).setScale(this.unit).setDepth(depth), modal);
  }

  icon(x, y, size, name, depth = 12, modal = false) {
    return this.remember(this.scene.add.image(x, y, `town-hub-${name}`)
      .setDisplaySize(size, size).setDepth(depth), modal);
  }

  control(x, y, width, height, visuals, action, depth = 14, modal = false) {
    const hit = this.remember(this.scene.add.rectangle(x, y, width, height, 0, 0)
      .setDepth(depth).setInteractive({ useHandCursor: true }), modal);
    hit.pressVisuals = visuals;
    bindButtonPress(this.scene, hit, [], () => {
      if (this.opening || (!modal && this.modal && hit !== this.settingsControl)) return;
      HapticsService.tap();
      action();
    });

    // The illustrated face already includes its shadow. Keep the shared helper's
    // press/cancel behavior while suppressing its additional rectangular shadow.
    this.scene.children.list[this.scene.children.list.length - 1].setAlpha(0);
    if (!modal) this.hits.push(hit);
    return hit;
  }

  render() {
    const modal = this.modal;
    this.closeModal();
    this.clear(this.objects);
    this.hits = [];
    this.badges = [];
    const { width, height } = this.scene.scale;
    const layout = getTownLayout(width, height, townLayout());
    this.unit = layout.unit;
    const u = this.unit;
    if (layout.bar) {
      const b = layout.bar;
      this.frame(b.x, b.y, b.width, b.height, 'bar');
      const dividers = this.remember(this.scene.add.graphics().setDepth(11));
      dividers.lineStyle(2 * u, 0xbb8d49, 0.7);
      const slot = (b.width - 90 * u) / 5;
      for (let i = 1; i < 5; i++) {
        const x = width / 2 + (i - 2.5) * slot;
        dividers.lineBetween(x, b.y - 40 * u, x, b.y + 44 * u);
      }
    }
    TOWN_NAVIGATION.forEach((destination, index) => this.navigation(destination, layout.positions[index]));
    this.hud(width);
    this.refresh();
    if (modal) this.showModal(modal);
  }

  navigation(destination, box) {
    const { x, y, width, height, framed } = box;
    const u = this.unit;
    const visuals = [];
    if (framed) visuals.push(this.frame(x, y, width, height, 'button'));
    const iconSize = Math.min(height * 0.63, 112 * u);
    visuals.push(this.icon(x, y - 20 * u, iconSize, destination.id));
    const label = this.text(x, y + height * 0.31, destination.label);
    if (label.width > width - 28 * u) label.setScale((width - 28 * u) / label.width);
    visuals.push(label);
    const badgeX = x + width / 2 - 26 * u, badgeY = y - height / 2 + 25 * u;
    const badge = this.remember(this.scene.add.circle(badgeX, badgeY, 22 * u, 0xae1724)
      .setStrokeStyle(3 * u, 0xffd88a).setDepth(15).setVisible(false));
    const count = this.text(badgeX, badgeY, '', 'body30', 16).setVisible(false);
    this.badges.push({ destination, badge, count });
    this.control(x, y, width - 12 * u, height - 10 * u, visuals, () => {
      this.glint(x, y - 24 * u, destination.effect);
      this.navigate(destination.scene);
    }).setName(`town-${destination.id}`);
  }

  hud(width) {
    const u = this.unit;
    const y = 65 * u;
    const mapX = UI_SAFE_LEFT + 215 * u;
    const map = this.frame(mapX, y, 430 * u, 106 * u, 'capsule');
    const arrow = this.text(mapX - 170 * u, y - 2 * u, '‹', 'display62');
    const icon = this.icon(mapX - 102 * u, y, 72 * u, 'world-map');
    const label = this.text(mapX + 50 * u, y, 'World Map', 'heading40');
    this.control(mapX, y, 420 * u, 100 * u, [map, arrow, icon, label], () => this.back()).setName('town-world-map');

    const titleWidth = Math.min(690 * u, width - 1240 * u);
    this.frame(width / 2, 91 * u, titleWidth, 150 * u, 'title');
    const title = this.text(width / 2, 103 * u, this.scene.townName, 'display62');
    if (title.width > titleWidth - 150 * u) title.setScale((titleWidth - 150 * u) / title.width);

    const settingsX = width - UI_SAFE_RIGHT - 53 * u;
    const settingsIcon = this.icon(settingsX, y, 100 * u, 'settings', 106);
    this.settingsControl = this.control(settingsX, y, 100 * u, 100 * u, [settingsIcon], () => {
      if (this.modal === 'settings') this.closeModal();
      else this.showModal('settings');
    }, 107).setName('town-settings');
    const aetherX = settingsX - 228 * u;
    const goldX = aetherX - 300 * u;
    this.frame(goldX, y, 290 * u, 96 * u, 'capsule');
    this.icon(goldX - 100 * u, y, 64 * u, 'gold');
    this.goldText = this.text(goldX + 25 * u, y, '', 'body36');
    this.frame(aetherX, y, 290 * u, 96 * u, 'capsule');
    this.icon(aetherX - 100 * u, y, 66 * u, 'exchange');
    this.aetherText = this.text(aetherX + 26 * u, y, 'Aether —', 'body30');
  }

  refresh() {
    const gold = Math.round(GameState.gold).toLocaleString('en-US');
    if (this.goldText?.active && this.goldText.text !== gold) {
      this.goldText.setText(gold).setScale(1);
      if (this.goldText.width > 164 * this.unit) this.goldText.setScale(164 * this.unit / this.goldText.width);
    }
    for (const { destination, badge, count } of this.badges) {
      const value = destination.badge?.(GameState) ?? 0;
      badge.setVisible(value > 0);
      count.setVisible(value > 0).setText(value > 99 ? '99+' : String(value));
    }
  }

  glint(x, y, animation = 'town-hub-selection') {
    if (this.reducedMotion) return;
    const effect = this.remember(this.scene.add.sprite(x, y, 'town-hub-glint').setDepth(18)
      .setDisplaySize(88 * this.unit, 132 * this.unit));
    effect.play(animation).once('animationcomplete', () => effect.destroy());
  }

  navigate(scene, data) {
    if (this.opening) return;
    this.opening = true;
    this.hits.forEach(hit => hit.disableInteractive());
    this.transition = this.scene.time.delayedCall(this.reducedMotion ? 0 : 180, () => this.scene.scene.start(scene, data));
  }

  showModal(mode) {
    this.closeModal();
    this.modal = mode;
    this.hits.forEach(hit => { if (hit !== this.settingsControl) hit.disableInteractive(); });
    const { width, height } = this.scene.scale;
    const u = this.unit;
    const w = Math.min(750 * u, width - 2 * UI_SAFE_LEFT);
    const h = Math.min(570 * u, height - 180 * u);
    const x = width - UI_SAFE_RIGHT - w / 2, y = 142 * u + h / 2;
    const top = y - h / 2;
    const shade = this.remember(this.scene.add.rectangle(width / 2, height / 2, width, height, 0, 0.12)
      .setDepth(100).setInteractive(), true);
    shade.on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());
    this.frame(x, y, w, h, 'panel', 101, true);
    const heading = 'Settings';
    this.text(x, top + 65 * u, heading, 'heading48', 103, true);
    const close = this.text(x + w / 2 - 66 * u, top + 64 * u, '×', 'display62', 103, true);
    this.control(close.x, close.y, 90 * u, 90 * u, [close], () => this.closeModal(), 105, true).setName('town-modal-close');
    if (mode === 'settings') {
      this.text(x, top + 136 * u, 'Town Navigation Style', 'body36', 103, true);
      TOWN_LAYOUTS.forEach((option, index) => {
        const rowY = top + (252 + index * 160) * u;
        const selected = townLayout() === option.id;
        const frame = this.frame(x, rowY, w - 100 * u, 140 * u, selected ? 'selected' : 'option', 102, true);
        const radio = this.text(x - w / 2 + 114 * u, rowY, selected ? '◉' : '○', 'heading48', 103, true,
          { color: selected ? '#ffd477' : '#a4a3a0' });
        const label = this.text(x + 30 * u, rowY - 23 * u, option.label, 'heading40', 103, true);
        const description = this.text(x + 30 * u, rowY + 27 * u, option.description, 'body30', 103, true,
          { fontStyle: UI_FONT_WEIGHTS.normal, color: '#d3c4ae' });
        this.control(x, rowY, w - 110 * u, 132 * u, [frame, radio, label, description], () => {
          setTownLayout(option.id);
          this.render();
        }, 105, true).setName(`town-layout-${option.id}`);
      });
    }
    this.scene.selectionDetailsClose = () => this.closeModal();
  }

  closeModal() {
    this.clear(this.modalObjects);
    this.modal = null;
    this.scene.selectionDetailsClose = null;
    if (!this.opening) this.hits.forEach(hit => { if (hit.active) hit.setInteractive(); });
  }

  back() {
    if (this.modal) { this.closeModal(); return; }
    this.navigate('TitleScene');
  }

  clear(objects) {
    for (const object of objects.splice(0)) {
      this.scene.tweens.killTweensOf(object);
      if (object.active) object.destroy();
    }
  }

  destroy() {
    this.transition?.remove();
    this.refreshTimer?.remove();
    this.closeModal();
    this.clear(this.objects);
  }
}
