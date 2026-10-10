// Encounter-local tuning keeps catalog stats available for other maps and older saves.
// These scales apply to fresh spawns after existing Thornbriar ordinary-wave tuning.
// Health controls fight length; physical and spell power control incoming pressure.
export const DELVE_BALANCE = {
  'slime-cave': { normalHealth: 1, normalPower: 1, bossHealth: 1, bossPower: 0.45 },
  'thornbriar-hollow': { normalHealth: 1, normalPower: 1, bossHealth: 0.8, bossPower: 0.23 },
  'dolmark-den': { normalHealth: 1, normalPower: 1, bossHealth: 0.85, bossPower: 0.35 },
  'old-quarry': { normalHealth: 0.6, normalPower: 0.1, bossHealth: 0.8, bossPower: 0.24 },
  'sunken-watch': { normalHealth: 1, normalPower: 0.25, bossHealth: 0.85, bossPower: 0.34 },
  'murmuring-abyss': { normalHealth: 1, normalPower: 0.1, bossHealth: 1.2, bossPower: 1.8 }
};

// Apply the whole wave's scale to its boss and escorts. Multiplying the combat stats
// also scales percentage skills without changing warnings, reach, timing or responses.
export function delveEnemyDefinition(definition, delve, bossWave) {
  const id = delve?.encounterId ?? delve?.id;
  const tuning = DELVE_BALANCE[id];
  if (!tuning) return definition;
  const health = bossWave ? tuning.bossHealth : tuning.normalHealth;
  const power = bossWave ? tuning.bossPower : tuning.normalPower;

  // Monster level is descriptive. Heroes grow through CharacterStats; monsters use
  // these authored totals. Boss escorts share the boss preparation level for inspection.
  const level = bossWave ? delve.bossPreparation?.level : delve.recommendedLevel;
  return { ...definition, level: level ?? definition.level,
    maxHp: Math.round(definition.maxHp * health),
    attackPower: definition.attackPower * power,
    spellDamage: definition.spellDamage * power,
    spellHealing: definition.spellHealing * power };
}
