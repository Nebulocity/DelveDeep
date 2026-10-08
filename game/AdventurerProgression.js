// This handles XP, level gains and Happiness for roster characters. XP is progress toward
// the next level; gained levels rebuild derived stats from the configured profile. We keep
// identity, known skills and owned gear while updating progression, rather than making a
// brand-new character whenever a level changes.

import { rebuildCharacterStats } from './CharacterStats.js';

// This helper increases the experience needed for each adventurer level.
export function xpRequired(level) {

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  return 100 + Math.max(0, level - 1) * 50;
}

// Development grants preserve current XP and use the normal level rewards.
export function grantAdventurerLevels(adventurer, amount = 1) {

  // The condition before ? chooses the first value when true and the value after : when
  // false. Math.max chooses the largest value; pairing it with Math.min can keep a result
  // inside both a lower and an upper bound. Math.floor rounds toward the smaller whole
  // number, so 3.8 becomes 3.
  const gained = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  for (let index = 0; index < gained; index += 1) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    adventurer.skillPoints = Math.max(0, adventurer.skillPoints ?? adventurer.level) + 1;
    adventurer.level += 1;
    if (adventurer.statProgressionVersion === 2) Object.assign(adventurer, rebuildCharacterStats(adventurer));
    else {
      adventurer.maxHp += 6;
      adventurer.attackPower += 2;
      if (Number.isFinite(adventurer.healPower)) adventurer.healPower += 2;
    }
  }

  return { levelsGained: gained };
}

// This helper adds earned experience to an adventurer and processes every level gained
// from it. Each level raises maximum health and attack power, plus healing power when that
// stat is present; leftover experience remains toward the next level.
export function grantAdventurerXp(adventurer, amount) {

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  const result = { levelsGained: 0, xpGained: Math.max(0, Math.round(amount)) };

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  adventurer.xp = Math.max(0, adventurer.xp ?? 0) + result.xpGained;

  // Process multiple level gains when one reward crosses several thresholds, subtracting
  // each level cost in turn.
  while (adventurer.xp >= xpRequired(adventurer.level)) {
    adventurer.xp -= xpRequired(adventurer.level);
    grantAdventurerLevels(adventurer, 1);
    result.levelsGained += 1;
  }

  return result;
}

// This helper applies morale changes within the adventurer happiness limits.
export function adjustHappiness(adventurer, amount) {

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound. ?? uses the fallback only for null or undefined. A
  // real zero or false stays intact.
  adventurer.happiness = Math.min(100, Math.max(0, (adventurer.happiness ?? 70) + amount));
  return adventurer.happiness;
}

// This helper translates happiness into a readable mood for the roster UI.
export function happinessLabel(value) {

  if (value >= 85) return 'Inspired';
  if (value >= 65) return 'Content';
  if (value >= 40) return 'Uneasy';

  return 'Frustrated';
}
