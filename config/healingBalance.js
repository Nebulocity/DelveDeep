// Each magical class owns its healingMultiplier in characterProgression.js.
// Apply that class tuning once before building ranks, so previews and combat agree.
export const HEALING_BALANCE = {
  healerManaPerSecond: 2
};

// Apply tuning when building new ability definitions, before rank bonuses and tooltips.
// Saved encounters already contain their definitions and do not pass through this helper.
export function balancedHealingAbility(row, healingMultiplier) {
  const tune = effect => {
    if (!effect.healing) return { ...effect };

    // Both potency and its ceiling use fractions of Spell Power. Scaling both keeps
    // the original rank curve, including skills with an authored maximum coefficient.
    return { ...effect, potency: effect.potency * healingMultiplier,
      cap: effect.cap == null ? effect.cap : effect.cap * healingMultiplier };
  };
  return { ...row, primary: tune(row.primary), secondary: tune(row.secondary) };
}
