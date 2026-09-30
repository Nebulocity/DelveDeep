import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import { SpriteMotion, movementDirection } from './SpriteMotion.js';

// Presentation only: animation never changes arena positions, reach, or stats.
// Combat drives the frame clock, so Pause and inspection freeze the animation.
export default class UnitSprite {
  constructor(unit, definition) {
    this.unit = unit;
    this.definition = definition;
    this.motion = new SpriteMotion(unit.arenaX, unit.arenaY);
    const frame = this.currentFrame();
    this.image = unit.scene.add.image(0, definition.footY, frame.key, frame.frame)
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
    const state = this.action?.state ?? this.motion.state;
    const clips = this.definition.clips[state];
    const clip = clips[this.motion.direction] ?? clips.south;
    const elapsed = this.action?.elapsed ?? this.motion.elapsed;
    const index = Math.floor(elapsed / clip.frameMs);
    return clip.frames[this.action ? Math.min(index, clip.frames.length - 1) : index % clip.frames.length];
  }

  // Events change presentation only. Death holds its final fallen-body frame.
  play(state, target) {
    if (!this.definition.clips[state] || this.action?.state === 'death') return;
    if (target && target !== this.unit) {
      this.motion.direction = movementDirection(target.arenaX - this.unit.arenaX, target.arenaY - this.unit.arenaY);
    }
    // Repeated hits must not pin a reaction forever on its first frame.
    if (this.action?.state === state) return;
    this.action = { state, elapsed: 0 };
    this.applyFrame(this.currentFrame());
  }

  applyFrame(frame) {
    if (this.frameKey !== frame.key || this.frameIndex !== frame.frame) {
      this.image.setTexture(frame.key, frame.frame);
    }
    this.frameKey = frame.key;
    this.frameIndex = frame.frame;
    this.image.setOrigin(frame.flipX ? 1 - frame.originX : frame.originX, frame.originY);
    this.image.setFlipX(frame.flipX === true);
  }

  update(delta) {
    const unit = this.unit;
    const scene = unit.scene;
    const frozen = scene.combatPaused || (this.action?.state !== 'death' && (scene.battleOver || scene.waveTransitioning));
    if (this.action) {
      this.motion.x = unit.arenaX;
      this.motion.y = unit.arenaY;
      if (!frozen) this.action.elapsed += Math.max(0, delta);
      const clip = this.definition.clips[this.action.state][this.motion.direction];
      if (this.action.state !== 'death' && this.action.elapsed >= clip.frameMs * clip.frames.length) {
        this.action = null;
        this.motion.reset(unit.arenaX, unit.arenaY);
      }
      this.applyFrame(this.currentFrame());
      return;
    }
    this.motion.update(unit.arenaX, unit.arenaY, delta, unit.moveSpeed, unit.alive, frozen);
    this.applyFrame(this.currentFrame());
  }

  reset() {
    this.action = null;
    this.motion.reset(this.unit.arenaX, this.unit.arenaY);
    this.image.clearTint();
    this.applyFrame(this.currentFrame());
  }
}
