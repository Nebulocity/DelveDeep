// Read old item bonuses while the equipment workbook moves to Spell Power Bonus.
// This adapter leaves catalog rows and owned copies untouched, including enchantments.
export function unifiedSpellBonuses(stats = {}) {
  const { spellDamage, spellHealing, healPower, ...bonuses } = stats ?? {};
  const finite = value => Number.isFinite(value) ? value : 0;

  // Old gear often granted both spell stats. Use the larger bonus once instead of
  // doubling it. A new Spell Power bonus can also have an older enchantment attached.
  if (spellDamage != null || spellHealing != null || healPower != null) {
    bonuses.spellPower = finite(bonuses.spellPower)
      + Math.max(finite(spellDamage), finite(spellHealing ?? healPower));
  }
  return bonuses;
}
