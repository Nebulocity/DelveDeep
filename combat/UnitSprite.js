// This wraps the sprite sheets used to show a combatant. Frame metadata tells us the foot
// anchor, facing and playable frames. We line up feet rather than image centers, because
// different animations can have different amounts of empty space around the character.

import { SLIME_SPRITES } from '../data/slimeSprites.js';
import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import { ENEMY_SPRITES } from '../data/enemySprites.js';
import { VOID_SPRITES } from '../data/voidSprites.js';
import { SUNKEN_WATCH_SPRITES } from '../data/sunkenWatchSprites.js';
import { QUARRY_SPRITES } from '../data/quarrySprites.js';
import { SpriteMotion, movementDirection } from './SpriteMotion.js';
import { slimePose, monsterDeathPose, criticalHitPose, criticalHitDirection, CRITICAL_RECOIL_MS } from './SpritePresentation.js';

// Presentation only: animation never changes arena positions, reach, or stats. Combat
// drives the frame clock, so Pause and inspection freeze the animation.
export default class UnitSprite {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods. unit is the live combatant, with
  // current resources and arena position.
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

  // Choose the accepted sprite definition matching this combatant's stable sprite
  // identity. unit is the live combatant, with current resources and arena position.
  static definitionFor(unit) {

    // The condition before ? chooses the first value when true and the value after : when
    // false. ?? uses the fallback only for null or undefined. A real zero or false stays
    // intact.
    const definition = unit.isEnemy
      ? (SLIME_SPRITES[unit.spriteId] ?? ENEMY_SPRITES[unit.spriteId]
        ?? VOID_SPRITES[unit.spriteId] ?? SUNKEN_WATCH_SPRITES[unit.spriteId]
        ?? QUARRY_SPRITES[unit.spriteId])
      : CHARACTER_SPRITES[unit.id];

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!definition?.textures || !unit.scene.textures) return null;

    // every requires all entries to pass the check; an empty list gives true.
    if (!definition.textures.every(({ key }) => unit.scene.textures.exists(key))) return null;
    return definition;
  }

  // Create the accepted sprite image and register its playable animation frames.
  static create(unit) {
    const definition = this.definitionFor(unit);
    if (!definition) return null;
    definition.textures.forEach(({ key }) => {

      // Phaser's NEAREST texture filter preserves the native sprite pixels.
      unit.scene.textures.get(key).setFilter(1);
    });

    return new UnitSprite(unit, definition);
  }

  // Find the playable frame from the current animation and facing metadata.
  currentFrame() {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const state = this.action?.state ?? this.motion.state;
    const clips = this.definition.clips[state];
    const clip = clips[this.motion.direction] ?? clips.south;
    const elapsed = this.action?.elapsed ?? this.motion.elapsed;

    // Math.floor rounds toward the smaller whole number, so 3.8 becomes 3.
    const index = Math.floor(elapsed / (this.action?.frameMs ?? clip.frameMs));

    // The condition before ? chooses the first value when true and the value after : when
    // false. Math.min chooses the smallest value; pairing it with Math.max can keep a
    // result inside both a lower and an upper bound. % gives the remainder. With a
    // nonnegative index and positive list length, it wraps the index back to the start of
    // the list.
    return clip.frames[this.action ? Math.min(index, clip.frames.length - 1) : index % clip.frames.length];
  }

  // Events change presentation only. Death holds its final fallen-body frame.
  play(state, target) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!this.definition.clips[state] || this.action?.state === 'death') return;
    if (target && target !== this.unit) {
      this.motion.direction = movementDirection(target.arenaX - this.unit.arenaX, target.arenaY - this.unit.arenaY);
    }

    // Repeated hits must not pin a reaction forever on its first frame.
    if (this.action?.state === state) return;
    this.action = { state, elapsed: 0 };

    // A void cast, leap or area pose spans the actual action windup in milliseconds.
    // Dividing by the playable frame count shows its whole clip before the hit, even
    // when two monsters use the same artwork with different authored cast times.
    const duration = this.unit.pendingAction?.duration;
    if (['cast', 'leap', 'area'].includes(state) && duration > 0) {
      const clip = this.definition.clips[state][this.motion.direction];
      this.action.frameMs = duration / clip.frames.length;
    }
    this.applyFrame(this.currentFrame());
    this.applyPose();
  }

  // Keep critical shock separate from the sheet animation. A normal hit, attack or
  // death clip can continue while these three small hops move only its visible image.
  playCriticalHit(attacker) {
    this.criticalRecoil = { elapsed: 0, ...criticalHitDirection(this.unit, attacker) };
    this.applyPose();
  }

  // Apply the selected sheet frame and its anchor to the visible sprite.
  applyFrame(frame) {
    if (this.frameKey !== frame.key || this.frameIndex !== frame.frame) {
      this.image.setTexture(frame.key, frame.frame);
    }
    this.frameKey = frame.key;
    this.frameIndex = frame.frame;

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner. The condition before ? chooses the first value when true and the value after
    // : when false.
    this.image.setOrigin(frame.flipX ? 1 - frame.originX : frame.originX, frame.originY);
    this.image.setFlipX(frame.flipX === true);
  }

  // Apply the small cosmetic offset, scale and tint for the current reaction pose.
  applyPose() {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const state = this.action?.state ?? this.motion.state;
    const elapsed = this.action?.elapsed ?? this.motion.elapsed;
    const clip = this.definition.clips[state]?.[this.motion.direction]
      ?? this.definition.clips[state]?.south;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const duration = clip ? (this.action?.frameMs ?? clip.frameMs) * clip.frames.length : 1;
    const pose = slimePose(this.definition.motion, state, elapsed, duration);
    const death = this.unit.isEnemy && state === 'death' ? monsterDeathPose(elapsed) : null;
    const size = death?.scale ?? 1;

    // Add the shock offsets to the existing slime/sheet pose. We leave the container,
    // health bars and gameplay feet where they belong. Hit-zone alignment below follows
    // the displayed sprite without changing collision or ability distance checks.
    const recoil = this.criticalRecoil;
    const shock = recoil ? criticalHitPose(recoil.elapsed, recoil.awayX, recoil.awayY) : { x: 0, y: 0 };
    this.image.setPosition(pose.x + shock.x, this.definition.footY + pose.y + shock.y);
    this.image.setScale(this.definition.scale * pose.scaleX * size,
      this.definition.scale * pose.scaleY * size);

    if (death) this.image.setAlpha(death.alpha);
    this.syncHitZone();
  }

  // Align the unit's selectable input area with its current visible sprite bounds.
  syncHitZone() {
    const hitZone = this.unit.hitZone;
    if (!hitZone || !this.image.width || !this.image.height) return;
    const spriteWidth = this.image.width * Math.abs(this.image.scaleX);
    const spriteHeight = this.image.height * Math.abs(this.image.scaleY);

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    hitZone.setSize(Math.max(120, spriteWidth), Math.max(180, spriteHeight));
    hitZone.setPosition(
      this.image.x + (0.5 - this.image.originX) * spriteWidth,
      this.image.y + (0.5 - this.image.originY) * spriteHeight
    );
  }

  // Advance the selected animation and align the sprite to its live unit position.
  update(delta) {
    const unit = this.unit;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (this.image?.active === false || unit.container?.active === false) return;
    if (unit.landing) return;
    const scene = unit.scene;
    const frozen = scene.combatPaused || (this.action?.state !== 'death' && scene.battleOver);

    // Advance on the same frame clock as the sprite, so Pause freezes the shock too.
    // Once it ends, clearing the record restores the original pose exactly. A lethal
    // hit can finish its hops alongside the death clip, including at battle end.
    if (this.criticalRecoil && !frozen) {
      this.criticalRecoil.elapsed += Math.max(0, delta);
      if (this.criticalRecoil.elapsed >= CRITICAL_RECOIL_MS) this.criticalRecoil = null;
    }

    if (this.action) {
      this.motion.x = unit.arenaX;
      this.motion.y = unit.arenaY;
      if (!frozen) this.action.elapsed += Math.max(0, delta);
      const clip = this.definition.clips[this.action.state][this.motion.direction];

      if (this.action.state !== 'death'
        && this.action.elapsed >= (this.action.frameMs ?? clip.frameMs) * clip.frames.length) {
        this.action = null;
        this.motion.reset(unit.arenaX, unit.arenaY);
      }
      this.applyFrame(this.currentFrame());
      this.applyPose();

      return;
    }

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.motion.update(unit.arenaX, unit.arenaY, delta, unit.moveSpeed * (scene.waveRetreating ? 2 : 1), unit.alive, frozen);

    // Idle allies face the incoming wave from their current screen lane.
    if (!unit.isEnemy && unit.alive && !frozen && scene.waveTransitioning
      && this.motion.state === 'idle' && unit.battlefield && scene.scale?.width) {
      const position = unit.battlefield.arenaToScreen(unit.arenaX, unit.arenaY);
      const centerX = scene.scale.width / 2;
      const centerWidth = position.widthAtDepth * 0.1;
      this.motion.direction = position.x < centerX - centerWidth ? 'north-east'
        : position.x > centerX + centerWidth ? 'north-west' : 'north';
    }

    const orderedPoint = scene.manualTargets?.get(unit.id);

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const followingOrder = orderedPoint && unit.distanceToPoint(orderedPoint.x, orderedPoint.y)
      > (scene.movement?.config.arrivalTolerance ?? 12);
    if (!unit.isEnemy && unit.alive && !frozen && ['Ranged DPS', 'Healer'].includes(unit.role)
      && !followingOrder) {
      const enemies = scene.getLivingEnemies?.() ?? [];

      // sort rearranges this array in place. A negative comparator result puts a before b;
      // positive puts it after; zero keeps them tied.
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

  // Return this animation state to its initial timing and facing.
  reset() {
    this.action = null;
    this.criticalRecoil = null;
    this.motion.reset(this.unit.arenaX, this.unit.arenaY);
    this.image.clearTint();
    this.applyFrame(this.currentFrame());
    this.image.setAlpha(1);
    this.applyPose();
  }
}
