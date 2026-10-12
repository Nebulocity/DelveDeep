// Healing coefficients were authored against Spell Healing totals larger than hero HP.
// Keep the adjustment here so future playtests can tune recovery without changing stats.
export const HEALING_BALANCE = {
  spellHealingScale: 0.25,
  healerManaPerSecond: 2
};

// Apply tuning when building new ability definitions, before rank bonuses and tooltips.
// Saved encounters already contain their definitions and do not pass through this helper.
export function balancedHealingAbility(row) {
  const tune = effect => {
    if (effect.basis !== 'Caster Spell Healing') return { ...effect };

    // Both potency and its ceiling use fractions of Spell Healing. Scaling both keeps
    // the original rank curve, including skills with an authored maximum coefficient.
    return { ...effect, potency: effect.potency * HEALING_BALANCE.spellHealingScale,
      cap: effect.cap == null ? effect.cap : effect.cap * HEALING_BALANCE.spellHealingScale };
  };
  return { ...row, primary: tune(row.primary), secondary: tune(row.secondary) };
}
