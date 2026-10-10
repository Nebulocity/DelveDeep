// These helpers select the visible frame, foot anchor and reaction for a unit.
// Presentation depends on accepted sprite metadata. Keep cosmetic choices separate from
// combat random rolls so a different animation cannot change the outcome of the fight.

const TAU = Math.PI * 2;

export const CRITICAL_RECOIL_MS = 660;

// Work out the on-screen direction away from the attacker. Projection matters because
// arena y grows toward the back while screen y grows downward. Dividing each difference
// by the length makes the direction one unit long, independent of attack distance.
export function criticalHitDirection(unit, attacker) {
  const project = target => unit.battlefield?.arenaToScreen(target.arenaX, target.arenaY)
    ?? { x: target.arenaX, y: -target.arenaY };
  const position = project(unit);
  const origin = attacker ? project(attacker) : position;
  const dx = position.x - origin.x;
  const dy = position.y - origin.y;
  const length = Math.hypot(dx, dy);
  return { awayX: length ? dx / length : 1, awayY: length ? dy / length : 0 };
}

// Three forward hops spend 55%, 30% and 15% of the total knockback distance.
// Travel never reverses. Only the height returns to zero at each landing.
export function criticalHitPose(elapsed) {
  const time = Math.max(0, Math.min(CRITICAL_RECOIL_MS, elapsed));
  if (time >= CRITICAL_RECOIL_MS) return { travel: 1, y: 0 };

  // Each hop lasts 220 milliseconds. A sine arch lifts the feet in local pixels,
  // with smaller heights of 32, 20 and 10 pixels on successive hops.
  const hopTime = CRITICAL_RECOIL_MS / 3;
  const hop = Math.floor(time / hopTime);
  const progress = (time % hopTime) / hopTime;
  const distances = [0.55, 0.30, 0.15];
  const starts = [0, 0.55, 0.85];
  return { travel: starts[hop] + distances[hop] * progress,
    y: -Math.sin(Math.PI * progress) * [32, 20, 10][hop] };
}

// Return offsets from the sheet pose so the same animation can vary by slime type.
export function slimePose(style, state, elapsed, duration) {
  if (!style) return { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  const phase = elapsed / style.period * TAU;
  if (state === 'idle') {
    if (style.kind === 'bob') {

      // Angles are radians. cos(angle) gives the horizontal part of a circle; sin(angle)
      // gives the vertical part. Multiplying by a radius turns those fractions into
      // offsets.
      const pulse = Math.sin(phase);
      return { x: Math.sin(phase * 0.5) * style.sway,
        y: -pulse * style.lift,
        scaleX: 1 + pulse * style.squish * 0.5,
        scaleY: 1 - pulse * style.squish * 0.5 };
    }

    if (style.kind === 'pulse') {
      const pulse = Math.sin(phase);

      // Math.max chooses the largest value; pairing it with Math.min can keep a result
      // inside both a lower and an upper bound.
      return { x: Math.sin(phase * 0.5) * style.sway,
        y: -Math.max(0, pulse) * style.lift,
        scaleX: 1 + pulse * style.squish,
        scaleY: 1 - pulse * style.squish * 0.72 };
    }

    const pulse = Math.sin(phase);
    const hop = Math.max(0, pulse);

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const spread = pulse < 0 ? -pulse * style.squish : -pulse * style.squish * 0.55;
    return { x: 0, y: -hop * style.lift,
      scaleX: 1 + spread,
      scaleY: 1 - spread };
  }

  if (state === 'attack') {
    const thrust = Math.sin(Math.PI * Math.min(1, elapsed / duration));
    return { x: 0, y: -thrust * style.lift * 1.4,
      scaleX: 1 + thrust * style.squish * 2,
      scaleY: 1 - thrust * style.squish * 1.3 };
  }

  if (state === 'hit' || state === 'block') {
    const recoil = Math.sin(Math.PI * Math.min(1, elapsed / duration));
    return { x: Math.sin(elapsed / 25) * recoil * style.sway,
      y: recoil * style.lift * 0.35,
      scaleX: 1 + recoil * style.squish * 1.4,
      scaleY: 1 - recoil * style.squish * 1.5 };
  }

  return { x: 0, y: 0, scaleX: 1, scaleY: 1 };
}

export const MONSTER_DEATH_MS = 1100;

// Keep death timing shared across every monster sprite.
export function monsterDeathPose(elapsed) {

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound.
  const time = Math.min(MONSTER_DEATH_MS, Math.max(0, elapsed));

  // The condition before ? chooses the first value when true and the value after : when
  // false. % gives the remainder. With a nonnegative index and positive list length, it
  // wraps the index back to the start of the list. Math.floor rounds toward the smaller
  // whole number, so 3.8 becomes 3.
  const flicker = time < 560 ? (Math.floor(time / 80) % 2 ? 0.38 : 1) : 1;
  const fade = time < 560 ? 1 : 1 - (time - 560) / (MONSTER_DEATH_MS - 560);
  const pop = time < 880 ? 1 : time < 970
    ? 1 + (time - 880) / 90 * 0.18
    : 1.18 * (1 - (time - 970) / 130);

  return { alpha: Math.max(0, flicker * fade), scale: Math.max(0, pop) };
}
