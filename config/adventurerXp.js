// Farming awards one XP per living adventurer per clear. These budgets therefore mean
// approximate hours, rather than a wall-clock lock: gear and tactics can shorten fights.
// cycleSeconds includes combat, the return rest and the next wave's countdown. Pineshire
// estimates use the prepared five-person party; later regions use a provisional 40 s.
export const PLANNED_ADVENTURER_LEVEL = 50;
export const FARM_HOURS_BY_DIFFICULTY = {
  Easy: 4, Difficult: 8, Tough: 16, 'Very Tough': 32, 'Incredibly Tough': 64, Impossible: 128
};

export const ADVENTURER_XP_BANDS = [
  { start: 1, cap: 5, difficulty: 'Easy', cycleSeconds: 24 },
  { start: 5, cap: 10, difficulty: 'Difficult', cycleSeconds: 45 },
  { start: 10, cap: 15, difficulty: 'Tough', cycleSeconds: 34 },
  { start: 15, cap: 20, difficulty: 'Very Tough', cycleSeconds: 57 },
  { start: 20, cap: 25, difficulty: 'Very Tough', cycleSeconds: 37 },
  { start: 25, cap: 30, difficulty: 'Incredibly Tough', cycleSeconds: 51 },
  { start: 30, cap: 35, difficulty: 'Impossible', cycleSeconds: 40 },
  { start: 35, cap: 40, difficulty: 'Impossible', cycleSeconds: 40 },
  { start: 40, cap: 45, difficulty: 'Impossible', cycleSeconds: 40 },
  { start: 45, cap: 50, difficulty: 'Impossible', cycleSeconds: 40 }
];

// Divide each band budget among its level steps, with modestly growing costs inside
// that band. The last step takes the integer remainder so rounding cannot change the
// total. New-region costs may reset because fight speed, not difficulty labels, sets XP.
export const ADVENTURER_XP_COSTS = ADVENTURER_XP_BANDS.flatMap(band => {
  const steps = band.cap - band.start;
  const total = Math.round(FARM_HOURS_BY_DIFFICULTY[band.difficulty] * 3600 / band.cycleSeconds);
  const weights = Array.from({ length: steps }, (_, index) => 8 + index);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  let assigned = 0;
  return weights.map((weight, index) => {
    const cost = index === steps - 1 ? total - assigned : Math.floor(total * weight / weightTotal);
    assigned += cost;
    return cost;
  });
});
