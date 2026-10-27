// First-clear rewards are fixed per participant and independent of repeat-farm income.
// XP totals at the six milestones are 225, 375, 575, 1125, 1875 and 2325.
export const PINESHIRE_PROGRESSION = {
  'slime-cave': { waves: 6, cap: 3, entry: 1, xp: [30, 30, 30, 30, 30, 75], gold: [1000, 100, 100, 100, 100, 300] },
  'thornbriar-hollow': { waves: 6, cap: 4, entry: 3, xp: [20, 20, 20, 20, 20, 50], gold: [200, 200, 200, 200, 200, 400] },
  'dolmark-den': { waves: 6, cap: 5, entry: 4, xp: [25, 25, 25, 25, 25, 75], gold: [350, 350, 350, 350, 350, 500] },
  'old-quarry': { waves: 10, cap: 7, entry: 5, xp: [50, 50, 50, 50, 50, 50, 50, 50, 50, 100], gold: [450, 450, 450, 450, 450, 450, 450, 450, 450, 950] },
  'sunken-watch': { waves: 10, cap: 9, entry: 7, xp: [70, 70, 70, 70, 70, 70, 70, 70, 70, 120], gold: [400, 400, 400, 400, 400, 400, 400, 400, 400, 900] },
  'murmuring-abyss': { waves: 12, cap: 10, entry: 9, xp: [40, 40, 40, 40, 40, 40, 40, 40, 40, 45, 45, 0], gold: [250, 250, 250, 250, 250, 250, 250, 250, 250, 375, 375, 800] }
};

// These are current world-map identities, not translations of retired content.
export function pineshireEncounterId(delve) {
  return delve?.encounterId ?? ({ 'march-west-delves': 'old-quarry', 'verge-delves': 'sunken-watch' }[delve?.id]) ?? delve?.id;
}

export function pineshireProgression(delve) {
  return PINESHIRE_PROGRESSION[pineshireEncounterId(delve)] ?? null;
}

// Proposed initial tuning: 30% Uncommon and 35% Rare in the final preparation waves.
export const PINESHIRE_RARITY_CHANCES = { uncommon: 0.30, rare: 0.35 };

export function pineshireWaveReward(delve, index) {
  const plan = pineshireProgression(delve);
  if (!plan || !Number.isInteger(index) || index < 0 || index >= plan.waves) return null;
  const boss = index === plan.waves - 1;
  const level = Math.floor(plan.entry + (plan.cap - plan.entry) * index / (plan.waves - 1));
  return { gold: plan.gold[index], xp: plan.xp[index], cap: plan.cap, level, boss,
    rarity: boss ? plan.cap === 10 ? 'epic' : 'rare'
      : plan.cap === 10 && index >= 9 ? 'uncommon' : 'common',
    upgradeRarity: boss || plan.waves === 6 && index < 3 ? null
      : plan.cap === 10 && index >= 9 ? 'rare' : 'uncommon' };
}
