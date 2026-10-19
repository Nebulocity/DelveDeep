// Action duration multipliers: 1 = authored timing, 1.5 = 50% longer, 2 = twice as long.
// Use positive values. These are the Default choice in the Delve's Combat Pace setting.
// These affect adventurers and enemies, including exact background combat replay.
export const COMBAT_PACING = {
  // cooldown: 1.5,
  cooldown: 3,

  // windup: 1.5
  windup: 3
};

export const COMBAT_PACE_OPTIONS = [
  { id: 'default', label: 'Default' },
  { id: 'normal', label: 'Normal', multiplier: 1 },
  { id: 'relaxed', label: 'Relaxed', multiplier: 1.5 },
  { id: 'slow', label: 'Slow', multiplier: 2 },
  { id: 'very-slow', label: 'Very Slow', multiplier: 3 }
];

export function combatPacingFor(id) {
  const option = COMBAT_PACE_OPTIONS.find(entry => entry.id === id) ?? COMBAT_PACE_OPTIONS[0];
  return option.multiplier ? { cooldown: option.multiplier, windup: option.multiplier } : COMBAT_PACING;
}

