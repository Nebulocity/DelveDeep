// These are percentages per cleared farm wave, with one independent roll per rarity.
// A successful roll awards one eligible environment material, regardless of difficulty.
// Keeping 0.05 as a percentage avoids confusing it with a 5% probability.
export const FARM_MATERIAL_CHANCES = {
  Easy: { common: 48, uncommon: 3, rare: 0, epic: 0, legendary: 0 },
  Difficult: { common: 42, uncommon: 6, rare: 2, epic: 0, legendary: 0 },
  Tough: { common: 30, uncommon: 15, rare: 4, epic: 0, legendary: 0 },
  'Very Tough': { common: 15, uncommon: 30, rare: 8, epic: 1, legendary: 0 },
  'Incredibly Tough': { common: 6, uncommon: 42, rare: 16, epic: 2, legendary: 0.05 },
  Impossible: { common: 3, uncommon: 48, rare: 32, epic: 3, legendary: 0.75 }
};
