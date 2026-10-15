// Equipment perks read live combat conditions at resolution. Percentages are fractions,
// so 0.05 adds five percentage points of chance or multiplies an amount by 1.05.
const descriptions = {
  bring_home_supper: (amount, threshold) => `+${amount}% critical hit chance against enemies below ${threshold}% Health.`,
  live_to_tell: (amount, threshold) => `+${amount}% Block chance while below ${threshold}% Health.`,
  fair_rates: amount => `Basic attacks deal ${amount}% more damage to enemies targeting the wielder.`,
  honest_days_work: (amount, threshold) => `+${amount}% basic attack damage while all living party members are above ${threshold}% Health.`,
  sentence_commuted: (amount, threshold) => `+${amount}% damage against enemies targeting another ally below ${threshold}% Health.`,
  doctors_orders: (amount, threshold) => `+${amount}% healing to allies below ${threshold}% Health.`,
  through_the_night: (amount, threshold) => `+${amount}% spell damage while above ${threshold}% Mana.`,
  enough_to_share: (amount, threshold) => `+${amount}% basic attack damage against enemies above ${threshold}% Health.`,
  last_muster: (amount, threshold) => `Take ${amount}% less damage while below ${threshold}% Health.`,
  woodland_cover: (amount, threshold) => `+${amount}% Dodge chance while above ${threshold}% Health.`,
  banked_embers: (amount, threshold) => `+${amount}% spell damage while below ${threshold}% Mana.`,
  familiar_care: (amount, threshold) => `Receive ${amount}% more healing while below ${threshold}% Health.`
};

// Keep inspection text and supported import IDs together so a misspelled perk fails early.
export function equipmentPerkDescription(perk) {
  const describe = descriptions[perk?.id];
  if (!describe) return '';
  const percent = value => Number(((value ?? 0) * 100).toFixed(2));
  return `${perk.name}: ${describe(percent(perk.amount), percent(perk.threshold))}`;
}

// Old battle snapshots omit equipmentPerks and therefore receive no new effects.
// Chance bonuses add together, while damage/healing modifiers are separate multipliers.
export function equipmentPerkBonus(unit, kind, target = null, party = [], context = {}) {
  if (!unit || unit.isEnemy) return 0;
  let bonus = 0;
  const health = member => member?.maxHp > 0 ? member.hp / member.maxHp : 0;
  const mana = unit.maxMana > 0 ? unit.mana / unit.maxMana : null;
  for (const perk of unit.equipmentPerks ?? []) {
    const amount = perk.amount;
    const threshold = perk.threshold;
    let active = false;

    // Compare strict thresholds before changing Health or Mana for this resolution.
    if (kind === 'crit' && perk.id === 'bring_home_supper') active = target?.isEnemy && health(target) < threshold;
    if (kind === 'block' && perk.id === 'live_to_tell') active = health(unit) < threshold;
    if (kind === 'dodge' && perk.id === 'woodland_cover') active = health(unit) > threshold;
    if (kind === 'reduction' && perk.id === 'last_muster') active = health(unit) < threshold;
    if (kind === 'healing' && perk.id === 'doctors_orders') active = !target?.isEnemy && health(target) < threshold;
    if (kind === 'receivedHealing' && perk.id === 'familiar_care') active = health(unit) < threshold;
    if (kind === 'damage' && target?.isEnemy && !context.reflection) {
      if (perk.id === 'fair_rates') active = context.basic && target.currentTargetId === unit.id;
      if (perk.id === 'honest_days_work') {
        const living = party.filter(member => member.alive && !member.isDecoy);
        active = context.basic && living.length > 0 && living.every(member => health(member) > threshold);
      }
      if (perk.id === 'sentence_commuted') active = party.some(member => member.alive && !member.isDecoy
        && member.id !== unit.id && member.id === target.currentTargetId && health(member) < threshold);
      if (perk.id === 'through_the_night') active = context.spell && mana !== null && mana > threshold;
      if (perk.id === 'banked_embers') active = context.spell && mana !== null && mana < threshold;
      if (perk.id === 'enough_to_share') active = context.basic && health(target) > threshold;
    }
    if (active) bonus += amount;
  }
  return bonus;
}
