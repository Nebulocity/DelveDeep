const TAU = Math.PI * 2;

export function slimePose(style, state, elapsed, duration) {
  if (!style) return { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  const phase = elapsed / style.period * TAU;
  if (state === 'idle') {
    if (style.kind === 'bob') {
      const pulse = Math.sin(phase);
      return { x: Math.sin(phase * 0.5) * style.sway,
        y: -pulse * style.lift,
        scaleX: 1 + pulse * style.squish * 0.5,
        scaleY: 1 - pulse * style.squish * 0.5 };
    }
    if (style.kind === 'pulse') {
      const pulse = Math.sin(phase);
      return { x: Math.sin(phase * 0.5) * style.sway,
        y: -Math.max(0, pulse) * style.lift,
        scaleX: 1 + pulse * style.squish,
        scaleY: 1 - pulse * style.squish * 0.72 };
    }
    const pulse = Math.sin(phase);
    const hop = Math.max(0, pulse);
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

export function monsterDeathPose(elapsed) {
  const time = Math.min(MONSTER_DEATH_MS, Math.max(0, elapsed));
  const flicker = time < 560 ? (Math.floor(time / 80) % 2 ? 0.38 : 1) : 1;
  const fade = time < 560 ? 1 : 1 - (time - 560) / (MONSTER_DEATH_MS - 560);
  const pop = time < 880 ? 1 : time < 970
    ? 1 + (time - 880) / 90 * 0.18
    : 1.18 * (1 - (time - 970) / 130);
  return { alpha: Math.max(0, flicker * fade), scale: Math.max(0, pop) };
}
