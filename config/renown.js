// These caps are independent of any region's Delve caps. Raising them later does not
// require changing the reward or purchase code.
export const MAX_RENOWN_LEVEL = 50;
export const MAX_CHARACTER_LEVEL = 50;
export const CHARACTER_RENOWN_INTERVAL = 5;

// Rarity gates require earned standing even when another source supplies extra points.
// All tactic rarities can be purchased with Renown Points, including Legendary.
export const LEADERSHIP_RARITIES = {
  common: { name: 'Common', level: 1, minCost: 1, maxCost: 3 },
  uncommon: { name: 'Uncommon', level: 10, minCost: 4, maxCost: 6 },
  rare: { name: 'Rare', level: 20, minCost: 8, maxCost: 10 },
  epic: { name: 'Epic', level: 40, minCost: 15, maxCost: 15 },
  legendary: { name: 'Legendary', level: 50, minCost: 50, maxCost: 50 }
};
