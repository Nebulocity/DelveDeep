import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import { SpriteMotion } from './SpriteMotion.js';

// Presentation only: animation never changes arena positions, reach, or stats.
// Combat drives the frame clock, so Pause and inspection freeze the animation.
export default class UnitSprite {
  constructor(unit, definition) {
    this.unit = unit;
    this.definition = definition;
    this.motion = new SpriteMotion(unit.arenaX, unit.arenaY);
    const frame = this.currentFrame();
    this.image = unit.scene.add.image(0, definition.footY, frame.key)
      .setScale(definition.scale);
    this.applyFrame(frame);
  }

  static create(unit) {
    const definition = CHARACTER_SPRITES[unit.id];
    if (!definition?.textures || !unit.scene.textures) return null;
    if (!definition.textures.every(({ key }) => unit.scene.textures.exists(key))) return null;
    definition.textures.forEach(({ key }) => {
      // Phaser's NEAREST texture filter preserves native PixelLab pixels.
      unit.scene.textures.get(key).setFilter(1);
    });
    return new UnitSprite(unit, definition);
  }

  currentFrame() {
    const clips = this.definition.clips[this.motion.state];
    const clip = clips[this.motion.direction] ?? clips.south;
    return clip.frames[Math.floor(this.motion.elapsed / clip.frameMs) % clip.frames.length];
  }

  applyFrame(frame) {
    if (this.frameKey !== frame.key) this.image.setTexture(frame.key);
    this.frameKey = frame.key;
    this.image.setOrigin(frame.flipX ? 1 - frame.originX : frame.originX, frame.originY);
    this.image.setFlipX(frame.flipX === true);
  }

  update(delta) {
    const unit = this.unit;
    const scene = unit.scene;
    const frozen = scene.combatPaused || scene.battleOver || scene.waveTransitioning;
    this.motion.update(unit.arenaX, unit.arenaY, delta, unit.moveSpeed, unit.alive, frozen);
    this.applyFrame(this.currentFrame());
  }

  reset() {
    this.motion.reset(this.unit.arenaX, this.unit.arenaY);
    this.image.clearTint();
    this.applyFrame(this.currentFrame());
  }
}
