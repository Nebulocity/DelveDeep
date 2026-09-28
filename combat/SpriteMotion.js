// Arena Y increases toward the far/top edge of the battlefield.
export function movementDirection(dx, dy) {
  const octants = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return octants[(octant + 8) % 8];
}

// Pure presentation state, separate from Phaser and combat rules for testing.
export class SpriteMotion {
  constructor(x, y, direction = 'south-east') {
    this.reset(x, y, direction);
  }

  reset(x, y, direction = this.direction) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.state = 'idle';
    this.elapsed = 0;
    this.quietMs = 0;
  }

  update(x, y, delta, speed, alive = true, frozen = false) {
    const dx = x - this.x;
    const dy = y - this.y;
    this.x = x;
    this.y = y;
    if (!alive || frozen || delta <= 0) return;

    const distance = Math.hypot(dx, dy);
    const teleported = distance > Math.max(20, speed * delta / 1000 * 2);
    const moving = distance > Math.max(0.15, speed * delta / 1000 * 0.15) && !teleported;
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
