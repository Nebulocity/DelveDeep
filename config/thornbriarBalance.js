// These totals target an ungeared level-5 Caramon, Flint, Tika, Tanis and Goldmoon party
// using rank-1 starter skills. Ten enemies share the farming wave, so individual damage
// stays modest while their combined health gives abilities time to matter.
export const THORNBRIAR_NON_BOSS_STATS = {
  ruffian: { maxHp: 2400, armor: 96, attackPower: 6, spellDamage: 6 },
  lasher: { maxHp: 4000, armor: 144, attackPower: 6, spellDamage: 6 },
  hedgeMage: { maxHp: 3200, armor: 144, attackPower: 6, spellDamage: 6 }
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
