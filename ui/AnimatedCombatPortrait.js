import { combatPortraitArt } from '../data/combatPortraitArt.js';
import GameState from '../game/GameState.js';

import { applyCharacterPose, characterDisplayMetrics } from './CharacterSpriteDisplay.js';

export default class AnimatedCombatPortrait {
  constructor(scene, unit, bounds, depth = 4502) {
    this.scene = scene;
    this.unit = unit;
    this.elapsed = 0;
    this.lastTime = scene.time.now;
    this.index = -1;
    this.definition = unit.spriteVisual?.definition;
    this.clip = this.definition?.clips?.idle?.south;
    const { x, y, width, height } = bounds;
    this.bounds = bounds;
    this.availableHeight = height;
    const art = combatPortraitArt(unit.className);
    const objects = [scene.add.rectangle(x + width / 2, y + height / 2, width, height, art.color)];
    const backgroundKey = [art.backgroundKey, GameState.currentDelve?.visuals?.environment?.layers?.[0]?.key]
      .find(key => key && scene.textures.exists(key));
    if (backgroundKey) {
      const background = scene.add.image(x + width / 2, y + height / 2, backgroundKey);
      background.setScale(Math.max(width / background.width, height / background.height)).setTint(0xc4d2df).setAlpha(0.78);
      objects.push(background, scene.add.rectangle(x + width / 2, y + height / 2, width, height, art.color, 0.28));
    }
    const bx = x + width - 32;
    if (art.bannerKey && scene.textures.exists(art.bannerKey)) {
      const banner = scene.add.image(bx + 13, y + 33, art.bannerKey);
      banner.setScale(Math.min(27 / banner.width, 66 / banner.height));
      objects.push(banner);
    } else {
      const banner = scene.add.graphics().fillStyle(art.banner, 0.95).lineStyle(1, 0xb38e51);
      const points = [{ x: bx, y }, { x: bx + 27, y }, { x: bx + 27, y: y + 54 }, { x: bx + 13, y: y + 66 }, { x: bx, y: y + 54 }];
      banner.fillPoints(points, true).strokePoints(points, true);
      objects.push(banner);
      if (scene.textures.exists(art.iconKey)) objects.push(scene.add.image(bx + 13, y + 28, art.iconKey).setDisplaySize(22, 22));
    }
    const first = this.clip?.frames[0] ?? this.definition?.portraitFrame;
    if (first && scene.textures.exists(first.key)) {
      this.image = scene.add.image(0, 0, first.key, first.frame);
      objects.push(this.image);
      this.displaySource = this.clip?.frames.length ? this.clip : first;
      applyCharacterPose(this.image, first);
      this.layoutImage(height);
    }
    this.root = scene.add.container(0, 0, objects).setDepth(depth);
    const maskArt = scene.make.graphics({ add: false }).fillRect(x, y, width, height);
    this.mask = maskArt.createGeometryMask();
    this.maskArt = maskArt;
    this.root.setMask(this.mask);
    this.root.once('destroy', () => { this.mask.destroy(); maskArt.destroy(); });
    this.update(true);
  }

  setHeight(height) {
    if (height === this.availableHeight) return;
    this.availableHeight = height;
    const { x, y, width } = this.bounds;
    this.maskArt.clear().fillRect(x, y, width, height);
    if (!this.image) return;
    this.layoutImage(height);
  }

  layoutImage(height) {
    const { x, y, width } = this.bounds;
    const metrics = characterDisplayMetrics(this.scene, this.definition, 'combatRoster', {
      source: this.displaySource, size: height - 12, width: width - 10, height: height - 12
    });
    if (!metrics) return;
    const { bounds, scale } = metrics;
    this.image.setScale(scale).setPosition(x + width / 2 - (bounds.left + bounds.right) * scale / 2,
      y + height - 6 - bounds.bottom * scale);
  }

  update(visible) {
    const now = this.scene.time.now;
    const elapsed = Math.max(0, now - this.lastTime);
    this.lastTime = now;
    const alive = this.unit.alive;
    const active = visible && this.root.visible && this.root.active;
    if (active && alive && !this.scene.combatPaused) this.elapsed += elapsed;
    if (!this.image || !active) return;
    this.image.setAlpha(alive ? 1 : 0.42);
    if (alive) this.image.clearTint();
    else this.image.setTint(0x8993a1);
    if (!this.clip?.frames.length) return;
    const index = Math.floor(this.elapsed / this.clip.frameMs) % this.clip.frames.length;
    if (index === this.index) return;
    this.index = index;
    const frame = this.clip.frames[index];
    this.scene.textures.get(frame.key).setFilter(1);
    applyCharacterPose(this.image, frame);
  }
}
