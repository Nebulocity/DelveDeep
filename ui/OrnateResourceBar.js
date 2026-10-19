import { combatText } from './CombatHudTheme.js';

export const RESOURCE_STYLES = Object.freeze({
  health: { fill: 0x0fbf68, shade: 0x075c3e, light: 0x9affbd, gem: 0x34ed86, trail: 0xa94e48, health: true },
  mana: { fill: 0x158add, shade: 0x123e7d, light: 0x9ae7ff, gem: 0x42caff, trail: 0x7386c9 }
});

// Current mechanics expose Mana only. Additional resources can supply readers/styles
// without assuming every adventurer has that pool or adding combat resource mechanics.
export const CARD_SECONDARY_RESOURCES = Object.freeze([
  { id: 'mana', style: RESOURCE_STYLES.mana, current: unit => unit.mana, maximum: unit => unit.maxMana }
]);

export default class OrnateResourceBar {
  constructor(scene, x, y, width, height, style = RESOURCE_STYLES.health, depth = 4503) {
    this.scene = scene;
    this.style = style;
    this.width = width;
    this.height = height;
    this.ratio = 0;
    this.previousMax = null;
    this.feedbackAt = -Infinity;
    const innerWidth = width - 24;
    this.innerWidth = innerWidth;
    const left = -innerWidth / 2;
    const back = scene.add.rectangle(0, 0, innerWidth, height - 8, 0x040c18);
    this.trail = scene.add.rectangle(left, 0, 1, height - 10, style.trail).setOrigin(0, 0.5);
    this.fill = scene.add.rectangle(left, 0, 1, height - 10, style.fill).setOrigin(0, 0.5);
    const shade = scene.add.rectangle(0, (height - 12) / 2 - 3, innerWidth, 6, style.shade, 0.35);
    this.gloss = scene.add.rectangle(left, -(height - 12) / 2 + 3, 1, 5, style.light, 0.45).setOrigin(0, 0.5);
    this.sweep = scene.add.rectangle(left, 0, 1, height - 12, style.light, 0.4).setOrigin(0, 0.5).setVisible(false);
    const trim = scene.add.graphics().lineStyle(2, 0xba8f45).strokeRoundedRect(-width / 2 + 8, -height / 2, width - 16, height, 5)
      .lineStyle(1, 0xffdb86, 0.85).strokeRoundedRect(-width / 2 + 11, -height / 2 + 3, width - 22, height - 6, 3);
    for (const side of [-1, 1]) {
      const gx = side * (width / 2 - 7), r = height * 0.23;
      const points = [{ x: gx, y: -r - 3 }, { x: gx + 7, y: 0 }, { x: gx, y: r + 3 }, { x: gx - 7, y: 0 }];
      trim.fillStyle(style.gem).lineStyle(1.5, 0xe8bc69).fillPoints(points, true).strokePoints(points, true);
      trim.lineStyle(1, style.light, 0.9).lineBetween(gx, -r, gx - 3, 0).lineBetween(gx - 3, 0, gx, r);
    }
    this.feedback = scene.add.graphics();
    this.text = combatText(scene, 0, 0, '', 24, 0).setStroke('#03111d', 3);
    this.root = scene.add.container(x, y, [back, this.trail, this.fill, shade, this.gloss, this.sweep, trim, this.feedback, this.text])
      .setDepth(depth).setSize(width, height);
  }

  setValue(current, maximum, alive = true, animate = true) {
    const max = Math.max(0, maximum ?? 0);
    const value = Math.max(0, Math.min(max, current ?? 0));
    const ratio = alive && max > 0 ? value / max : 0;
    const changed = ratio !== this.ratio || max !== this.previousMax || alive !== this.alive;
    const now = this.scene.time.now;
    const reset = this.previousMax !== max || !alive || !animate;
    if (reset) {
      this.trailRatio = ratio;
      this.feedbackAt = -Infinity;
      this.direction = null;
    } else if (ratio !== this.ratio) {
      const delta = ratio - this.ratio;
      if (delta < 0) this.trailRatio = Math.max(this.ratio, this.trailRatio ?? 0);
      // Small continuous regeneration updates the exact fill without restarting a flash.
      if (delta < 0 || delta >= 0.005 && now - this.feedbackAt > 180) {
        this.direction = delta < 0 ? 'spend' : 'restore';
        this.fromRatio = this.ratio;
        this.feedbackAt = now;
      }
    }
    this.previousMax = max;
    this.animate = animate;
    this.ratio = ratio;
    this.alive = alive;
    this.fill.setDisplaySize(this.innerWidth * ratio, this.height - 10).setVisible(ratio > 0);
    this.gloss.setDisplaySize(this.innerWidth * ratio, 5).setVisible(ratio > 0);
    const displayValue = this.style.health && alive ? Math.max(1, Math.round(value)) : Math.round(value);
    const label = alive ? `${displayValue} / ${Math.round(max)}` : this.style.health ? 'DOWN' : '';
    if (label !== this.label) {
      this.label = label;
      this.text.setText(label).setScale(1);
      if (this.text.width > this.innerWidth - 8) this.text.setScale((this.innerWidth - 8) / this.text.width);
    }
    this.update(changed || reset);
  }

  update(force = false) {
    const now = this.scene.time.now;
    if (!force && this.lastDrawAt === now) return;
    this.lastDrawAt = now;
    const age = now - this.feedbackAt;
    this.feedback.clear();
    const spending = this.direction === 'spend' && age < 520;
    const trail = spending ? this.ratio + Math.max(0, (this.trailRatio ?? this.ratio) - this.ratio)
      * (1 - Math.max(0, age - 220) / 300) : this.ratio;
    this.trail.setDisplaySize(this.innerWidth * trail, this.height - 10).setVisible(spending && trail > this.ratio);
    if (spending && age < 320) this.feedback.lineStyle(2, this.style.health ? 0xef7169 : this.style.light, 0.38 * (1 - age / 320))
      .strokeRoundedRect(-this.width / 2 + 9, -this.height / 2, this.width - 18, this.height, 4);
    const restoring = this.direction === 'restore' && age < 240 && this.ratio > this.fromRatio;
    this.sweep.setVisible(restoring);
    if (restoring) {
      // The main fill and numbers already show the exact pool. A bright edge grows only
      // through the restored portion, giving smooth feedback without delaying health.
      const restored = (this.ratio - this.fromRatio) * this.innerWidth;
      this.sweep.setX(-this.innerWidth / 2 + this.fromRatio * this.innerWidth)
        .setDisplaySize(restored * Math.min(1, age / 160), this.height - 12).setAlpha(0.45 * (1 - age / 240));
    }
    if (this.animate && this.style.health && this.alive && this.ratio > 0 && this.ratio <= 0.25) {
      this.feedback.lineStyle(1.5, 0xef7169, 0.2 + Math.sin(now / 500) * 0.06)
        .strokeRoundedRect(-this.width / 2 + 8, -this.height / 2, this.width - 16, this.height, 4);
    }
  }
}
