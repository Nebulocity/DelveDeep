import { CHANCE_STATS } from '../config/characterProgression.js';

// Round only the displayed value; combat and equipment keep their full precision.
// Crit and hit retain up to two decimal places, including the crit multiplier.
export function statDisplayNumber(value, stat) {
  if (!Number.isFinite(value)) return 0;
  const precision = ['critChance', 'hitChance', 'critMultiplier'].includes(stat) ? 100 : 1;
  return Math.round(value * precision) / precision;
}

export function statDisplayText(value, stat) {
  const chance = CHANCE_STATS.includes(stat);
  return `${statDisplayNumber((value ?? 0) * (chance ? 100 : 1), stat)}${chance ? '%' : ''}`;
}
