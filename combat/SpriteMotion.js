// This keeps movement and animation facing in step. A sprite's animation is what the
// player sees, while the unit's arena position remains the gameplay truth. Small direction
// changes need stable facing choices so a walking character does not flicker between
// directions. Arena Y increases toward the far/top edge of the battlefield.
export function movementDirection(dx, dy) {
  const octants = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];

  // atan2 takes the y difference first and x difference second, returning a direction
  // angle in radians with the correct quadrant.
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));

  // % gives the remainder. With a nonnegative index and positive list length, it wraps the
  // index back to the start of the list.
  return octants[(octant + 8) % 8];
}

// Pure presentation state, separate from Phaser and combat rules for testing.
export class SpriteMotion {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods.
  constructor(x, y, direction = 'south-east') {
    this.reset(x, y, direction);
  }

  // Return this animation state to its initial timing and facing.
  reset(x, y, direction = this.direction) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.state = 'idle';
    this.elapsed = 0;
    this.quietMs = 0;
  }

  // Compare current and previous positions to choose stable walking direction and reaction
  // state.
  update(x, y, delta, speed, alive = true, frozen = false) {
    const dx = x - this.x;
    const dy = y - this.y;
    this.x = x;
    this.y = y;

    if (!alive || frozen || delta <= 0) return;

    // Math.hypot calculates straight-line length from the x/y differences: square each,
    // add them, then take the square root.
    const distance = Math.hypot(dx, dy);

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    const teleported = distance > Math.max(20, speed * delta / 1000 * 2);
    const moving = distance > Math.max(0.15, speed * delta / 1000 * 0.15) && !teleported;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.quietMs = moving ? 0 : this.quietMs + delta;

    // A short grace period avoids flicker from subpixel avoidance corrections.
    const nextState = moving || (this.state === 'walk' && this.quietMs < 90 && !teleported) ? 'walk' : 'idle';
    if (moving) this.direction = movementDirection(dx, dy);
    if (nextState !== this.state) {
      this.state = nextState;
      this.elapsed = 0;
    } else {
      this.elapsed += Math.min(delta, 100);
    }
  }
}
