// Rank tables use tuned combat coefficients, not the larger untuned healing reference values.
// Each effect family has its own steps; fixed rules improve through timing instead of potency.
const roundTo = (value, step) => Number((Math.round(value / step) * step).toFixed(4));

// Build ten explicit records at catalog entry. Saves keep learned ranks and old battle definitions.
export function withAbilityRankCurve(base) {
  const effectCurve = (effect, secondary = false) => {
    let start = effect.potency, step = 0, ceiling = effect.cap ?? Infinity;
    if (base.handler === 'healingAura' && !secondary) {

      // Aura output is a total fraction of the caster's Health, shared across its ticks.
      start = 0.3;
      step = 0.1;
      ceiling = 1.2;
    } else if (effect.unit === '% of power basis' || effect.unit === '% of measured amount') {
      step = Math.max(0.05, roundTo(start * 0.15, 0.05));
      if (start > 0) ceiling = Math.max(ceiling, start + step * 9);
      if (/maximum Mana/.test(effect.basis)) ceiling = Math.min(ceiling, Math.max(start, 0.8));
    } else if (effect.unit === 'Percentage points') {

      // Chance modifiers use whole percentage points; final character chance limits still apply.
      step = start > 0 ? 0.01 : 0;
      ceiling = Math.min(0.2, Math.max(ceiling === Infinity ? 0 : ceiling, start + step * 9));
    } else if (effect.unit === '% change') {
      step = start > 0 ? (start >= 0.5 ? 0.1 : 0.05) : 0;
      ceiling = Math.max(ceiling, start + step * 9);

      // Reductions cannot eliminate all damage, time or movement. Armor bonuses can exceed 100%.
      if (start < 0.5) ceiling = Math.min(ceiling, 0.75);
      if (base.handler === 'nextWindupReduction' && !secondary) ceiling = Infinity;
    } else if (effect.unit === '% pack capacity, rounded') {

      // Potion refills cannot create more than one pack. Cooldown improvements reward later ranks.
      step = start < 1 ? 0.1 : 0;
      ceiling = 1;
    }
    return rank => ({ ...effect, potency: start === 0 ? 0 : roundTo(Math.min(ceiling, start + step * rank), 0.005),
      cap: Number.isFinite(ceiling) ? ceiling : null });
  };
  const primary = effectCurve(base.primary), secondary = effectCurve(base.secondary, true);
  const periodic = base.tickInterval > 0 || /channel/i.test(base.handler);
  const control = /stun|root|lock|disarm|truce/i.test(base.handler) || base.category === 'Protect';
  const cooldownStep = base.cooldown >= 18000 ? 1000 : 500;
  const floor = Math.max(base.cooldownFloor, base.cooldown * 0.5);

  // Periodic effects keep their duration so stronger totals also mean stronger ticks.
  const duration = (value, cap, rank, effect) => {
    if (!value || periodic) return value;
    let limit = cap;

    // Enemy control retains a recovery gap before the next cast, rather than growing into a lock.
    if (/enemy|enemies/i.test(base.targetLabel) && /stun|root|disarm|silence|prevent.*cast/i.test(effect.text)) {
      limit = Math.min(limit, Math.max(value, Math.floor(floor * 0.65 / 500) * 500));
    }
    return Math.min(limit, value + rank * (control ? 500 : 1000));
  };
  return { ...base, rankCurveVersion: 1, rankValues: Array.from({ length: 10 }, (_, rank) => ({
    primary: primary(rank), secondary: secondary(rank),
    restockDamageBonus: ['restoreCharges', 'partyRestoreCharges'].includes(base.handler) ? (rank + 1) * 0.05 : 0,
    duration: duration(base.duration, base.durationCap, rank, base.primary),
    secondaryDuration: duration(base.secondaryDuration, base.secondaryDurationCap, rank, base.secondary),
    cooldown: Math.max(floor, base.cooldown - rank * cooldownStep)
  })) };
}
