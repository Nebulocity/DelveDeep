// These totals target varied level-5 parties wearing the cheapest compatible Common
// weapons and armor, using their three rank-1 starters without tactics or potions.
// Shorter fights prevent mage-heavy parties from exhausting their resources; modest
// damage keeps repeated ten-enemy farm waves safe without removing their authored skills.
export const THORNBRIAR_NON_BOSS_STATS = {
  ruffian: { maxHp: 1680, armor: 96, attackPower: 3, spellPower: 3 },
  lasher: { maxHp: 2800, armor: 144, attackPower: 3, spellPower: 3 },
  hedgeMage: { maxHp: 2240, armor: 144, attackPower: 3, spellPower: 3 }
};

// Apply this local balance only to Thornbriar's ordinary fights, including repeated farm
// fights. Return the original definition for bosses and other Delves. Existing saves
// still restore their recorded unit stats rather than gaining a new progression rule.
export function thornbriarEnemyDefinition(type, definition, encounterId, bossWave) {
  if (encounterId !== 'thornbriar-hollow' || bossWave || !THORNBRIAR_NON_BOSS_STATS[type]) return definition;

  // ... makes a new shallow record. The later totals replace only the listed fields;
  // the original catalog and percentage-based skills remain intact for the boss wave.
  return { ...definition, ...THORNBRIAR_NON_BOSS_STATS[type] };
}
