import { SLIME_SPRITES } from '../data/slimeSprites.js';
import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import { ENEMY_SPRITES } from '../data/enemySprites.js';
import { SpriteMotion, movementDirection } from './SpriteMotion.js';
import { slimePose, monsterDeathPose } from './SpritePresentation.js';

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
    this.applyPose();
  }

  static create(unit) {
    const definition = unit.isEnemy ? (SLIME_SPRITES[unit.spriteId] ?? ENEMY_SPRITES[unit.spriteId]) : CHARACTER_SPRITES[unit.id];
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
    this.applyPose();
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

  applyPose() {
    const state = this.action?.state ?? this.motion.state;
    const elapsed = this.action?.elapsed ?? this.motion.elapsed;
    const clip = this.definition.clips[state]?.[this.motion.direction]
      ?? this.definition.clips[state]?.south;
    const duration = clip ? clip.frameMs * clip.frames.length : 1;
    const pose = slimePose(this.definition.motion, state, elapsed, duration);
    const death = this.unit.isEnemy && state === 'death' ? monsterDeathPose(elapsed) : null;
    const size = death?.scale ?? 1;
    this.image.setPosition(pose.x, this.definition.footY + pose.y);
    this.image.setScale(this.definition.scale * pose.scaleX * size,
      this.definition.scale * pose.scaleY * size);
    if (death) this.image.setAlpha(death.alpha);
    this.syncHitZone();
  }

  syncHitZone() {
    const hitZone = this.unit.hitZone;
    if (!hitZone || !this.image.width || !this.image.height) return;
    const spriteWidth = this.image.width * Math.abs(this.image.scaleX);
    const spriteHeight = this.image.height * Math.abs(this.image.scaleY);
    hitZone.setSize(Math.max(120, spriteWidth), Math.max(180, spriteHeight));
    hitZone.setPosition(
      this.image.x + (0.5 - this.image.originX) * spriteWidth,
      this.image.y + (0.5 - this.image.originY) * spriteHeight
    );
  }

  update(delta) {
    const unit = this.unit;
    if (this.image?.active === false || unit.container?.active === false) return;
    if (unit.landing) return;
    const scene = unit.scene;
    const frozen = scene.combatPaused || (this.action?.state !== 'death' && scene.battleOver);
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
      this.applyPose();
      return;
    }
    this.motion.update(unit.arenaX, unit.arenaY, delta, unit.moveSpeed * (scene.waveRetreating ? 2 : 1), unit.alive, frozen);
    const orderedPoint = scene.manualTargets?.get(unit.id);
    const followingOrder = orderedPoint && unit.distanceToPoint(orderedPoint.x, orderedPoint.y)
      > (scene.movement?.config.arrivalTolerance ?? 12);
    if (!unit.isEnemy && unit.alive && !frozen && ['Ranged DPS', 'Healer'].includes(unit.role)
      && !followingOrder) {
      const enemies = scene.getLivingEnemies?.() ?? [];
      const target = enemies.slice().sort((a, b) => Number(b.isBoss) - Number(a.isBoss)
        || (b.maxHp ?? 0) - (a.maxHp ?? 0)
        || unit.distanceTo(a) - unit.distanceTo(b))[0];
      if (target) {
        const time = scene.time?.now ?? 0;
        if (this.facingDirection === undefined || time - (this.lastFacingAt ?? -Infinity) >= 1500) {
          this.facingDirection = movementDirection(target.arenaX - unit.arenaX, target.arenaY - unit.arenaY);
          this.lastFacingAt = time;
        }
        this.motion.direction = this.facingDirection;
      }
    } else {
      this.facingDirection = undefined;
    }
    this.applyFrame(this.currentFrame());
    this.applyPose();
  }

  reset() {
    this.action = null;
    this.motion.reset(this.unit.arenaX, this.unit.arenaY);
    this.image.clearTint();
    this.applyFrame(this.currentFrame());
    this.image.setAlpha(1);
    this.applyPose();
  }
}
