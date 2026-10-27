// Encounter-local tuning keeps catalog stats available for other maps and older saves.
// These scales apply to fresh spawns after existing Thornbriar ordinary-wave tuning.
// Health controls fight length; physical and spell power control incoming pressure.
// Final-wave durability follows actual no-repeat entry levels 2/3/4/6/8/10.
// Ordinary waves and all warning timings retain their existing values.
export const DELVE_BALANCE = {
  'slime-cave': { normalHealth: 1, normalPower: 1, bossHealth: 0.65, bossPower: 0.45 },
  'thornbriar-hollow': { normalHealth: 1, normalPower: 1, bossHealth: 0.4, bossPower: 0.15 },
  'dolmark-den': { normalHealth: 0.7, normalPower: 0.25, bossHealth: 0.45, bossPower: 0.2 },
  'old-quarry': { normalHealth: 0.6, normalPower: 0.1, bossHealth: 0.24, bossPower: 0.14 },
  'sunken-watch': { normalHealth: 1, normalPower: 0.2, bossHealth: 0.38, bossPower: 0.28 },
  'murmuring-abyss': { normalHealth: 1, normalPower: 0.1, bossHealth: 0.95, bossPower: 1.2, bossEscortPower: 0.35 }
};

// Apply encounter-local scales to the boss and its escorts. Multiplying the combat stats
// also scales percentage skills without changing warnings, reach, timing or responses.
export function delveEnemyDefinition(definition, delve, bossWave) {
  const id = delve?.encounterId ?? delve?.id;
  const tuning = DELVE_BALANCE[id];
  if (!tuning) return definition;
  const health = bossWave ? tuning.bossHealth : tuning.normalHealth;

  // The Abyss Keeper's sustained pressure needs a separate budget from the Sovereign's
  // interruptible warnings. Other encounters retain one shared boss-wave power scale.
  const power = bossWave
    ? !definition.boss && tuning.bossEscortPower != null ? tuning.bossEscortPower : tuning.bossPower
    : tuning.normalPower;

  // Monster level is descriptive. Heroes grow through CharacterStats; monsters use
  // these authored totals. Boss escorts share the boss preparation level for inspection.
  const level = bossWave ? delve.bossPreparation?.level : delve.recommendedLevel;
  return { ...definition, level: level ?? definition.level,
    maxHp: Math.round(definition.maxHp * health),
    attackPower: definition.attackPower * power,
    spellPower: definition.spellPower * power };
}
