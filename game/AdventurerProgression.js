export function xpRequired(level) {
  return 100 + Math.max(0, level - 1) * 50;
}

export function grantAdventurerXp(adventurer, amount) {
  const result = { levelsGained: 0, xpGained: Math.max(0, Math.round(amount)) };
  adventurer.xp = Math.max(0, adventurer.xp ?? 0) + result.xpGained;

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

export function adjustHappiness(adventurer, amount) {
  adventurer.happiness = Math.min(100, Math.max(0, (adventurer.happiness ?? 70) + amount));
  return adventurer.happiness;
}

export function happinessLabel(value) {
  if (value >= 85) return 'Inspired';
  if (value >= 65) return 'Content';
  if (value >= 40) return 'Uneasy';
  return 'Frustrated';
}
