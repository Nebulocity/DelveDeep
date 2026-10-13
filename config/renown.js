// These caps are independent of any region's Delve caps. Raising them later does not
// require changing the reward or purchase code.
export const MAX_RENOWN_LEVEL = 50;
export const MAX_CHARACTER_LEVEL = 50;
export const CHARACTER_RENOWN_INTERVAL = 5;

// Rarity gates require earned standing even when another source supplies extra points.
// Legendary abilities are quest rewards, so the normal shop never sells them.
export const LEADERSHIP_RARITIES = {
  common: { name: 'Common', level: 1, minCost: 1, maxCost: 5 },
  uncommon: { name: 'Uncommon', level: 10, minCost: 15, maxCost: 20 },
  rare: { name: 'Rare', level: 20, minCost: 30, maxCost: 35 },
  epic: { name: 'Epic', level: 40, minCost: 45, maxCost: 50 },
  legendary: { name: 'Legendary', level: 50, questOnly: true }
};
