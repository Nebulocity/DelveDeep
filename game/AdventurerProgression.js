// This function increases the experience needed for each adventurer level.
export function xpRequired(level) {

  return 100 + Math.max(0, level - 1) * 50;
}

// This function adds earned experience to an adventurer and processes every
// level gained from it. Each level raises maximum health and attack power,
// plus healing power when that stat is present; leftover experience remains
// toward the next level.
export function grantAdventurerXp(adventurer, amount) {

  const result = { levelsGained: 0, xpGained: Math.max(0, Math.round(amount)) };
  adventurer.xp = Math.max(0, adventurer.xp ?? 0) + result.xpGained;

  // Process multiple level gains when one reward crosses several thresholds,
  // subtracting each level cost in turn.
  while (adventurer.xp >= xpRequired(adventurer.level)) {
    adventurer.xp -= xpRequired(adventurer.level);
    adventurer.level += 1;
    adventurer.maxHp += 6;
    adventurer.attackPower += 2;
    if (Number.isFinite(adventurer.healPower)) {
      adventurer.healPower += 2;
    }
    result.levelsGained += 1;
  }

  return result;
}

// This function applies morale changes within the adventurer happiness
// limits.
export function adjustHappiness(adventurer, amount) {

  adventurer.happiness = Math.min(100, Math.max(0, (adventurer.happiness ?? 70) + amount));
  return adventurer.happiness;
}

// This function translates happiness into a readable mood for the roster UI.
export function happinessLabel(value) {

  if (value >= 85) return 'Inspired';
  if (value >= 65) return 'Content';
  if (value >= 40) return 'Uneasy';
  return 'Frustrated';
}
