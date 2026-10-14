// Replace workbook variables with the inspected character's current ranked amounts.
// Dynamic recipient and damage-linked amounts stay percentages because no target exists
// in the Hall. Timing and costs remain concrete and readable instead of exposing formulas.

import { replacementAmount } from '../combat/ReplacementEffects.js';

export function replacementDescription(unit, ability, compact = false, structured = false) {
  const rounded = value => Number(value.toFixed(2));
  const seconds = value => `${rounded(value / 1000)}s`;
  const distance = value => `${rounded(value)} ${value === 1 ? 'pace' : 'paces'}`;
  const usedDurations = new Set();
  const effectText = (effect, token) => {
    const casterAmount = effect.basis.startsWith('Caster ') && effect.unit === '% of power basis';
    const value = casterAmount ? Math.round(replacementAmount(unit, unit, effect)) : rounded(effect.potency * 100);
    const dynamic = !casterAmount && effect.unit === '% of power basis';
    const resourceOwner = effect.basis.startsWith('Target ') ? "the enemy's" : 'their';
    let text = effect.text.replace(token, dynamic ? `${value}% of ${resourceOwner} maximum ${effect.basis.includes('Mana') ? 'Mana' : 'Health'}` : String(value));

    // The authored effect already supplies its resource noun. Avoid repeating it after
    // inserting a percentage of the recipient's maximum resource.
    text = text.replace(/\b(Health|Mana) \1\b/gi, '$1');

    // Put each timer beside the effect it governs. The secondary timer can differ from
    // the preparation window, so keep those meanings separate without extra headings.
    text = text.replace(/the (secondary|preparation|primary) duration/g, (_, kind) => {
      const field = kind === 'secondary' ? 'secondaryDuration' : 'duration';
      usedDurations.add(field);
      return seconds(ability[field] || ability.duration);
    });
    text = text.replace(/the duration/g, () => {
      const field = token === '[y]' && ability.secondaryDuration ? 'secondaryDuration' : 'duration';
      usedDurations.add(field);
      return seconds(ability[field]);
    });
    text = text.replace(/\bduring (\d+(?:\.\d+)?s)\b/g, 'for $1');
    text = text.replace(/The caster cannot move for \d+(?:\.\d+)?s\./g, 'The caster cannot move for the duration.');
    if (ability.targetLabel === 'Single ally or self') text = text.replace(/the affected allies/g, 'that ally');
    return text;
  };
  let effects = [effectText(ability.primary, '[x]')];
  if (ability.secondary.text !== 'None') effects.push(effectText(ability.secondary, '[y]'));

  // These few mechanics need a shorter explanation than the design workbook wording.
  // Values still come from the inspected rank and gear, just like the shared text above.
  const x = rounded(ability.primary.potency * 100);
  const y = Math.round(replacementAmount(unit, unit, ability.secondary));
  if (ability.handler === 'arenaRepositionTruce') {
    effects = [`Move ordinary enemies left and stop their movement and attacks for ${seconds(ability.duration)}.`,
      `Move allies right and root them for ${seconds(ability.secondaryDuration)}; they can still cast and heal.`];
    usedDurations.add('duration'); usedDurations.add('secondaryDuration');
  } else if (ability.handler === 'channelNextSpellMana') {
    effects = [`Channel for ${seconds(ability.duration)} to boost your next Assault spell's damage by ${x}%.`,
      `Recover ${y} Mana during the channel. The spell boost lasts ${seconds(ability.secondaryDuration)}.`];
    usedDurations.add('duration'); usedDurations.add('secondaryDuration');
  } else if (ability.handler === 'decoyAllyRescue') {
    effects = [`Place a decoy with ${x}% of an ally's maximum Health where they stood.`,
      `Move that ally beside you and restore ${y} Health. Requires an ally below 25% Health.`];
  } else if (ability.handler === 'decoyThreat') {
    effects = [`Create a distant decoy with ${Math.round(replacementAmount(unit, unit, ability.primary))} Health.`,
      'Enemies targeting you attack the decoy instead.'];
  }
  if (ability.duration && !usedDurations.has('duration')) effects.push(`Lasts ${seconds(ability.duration)}.`);
  if (ability.secondaryDuration && !usedDurations.has('secondaryDuration')) effects.push(`Secondary effect lasts ${seconds(ability.secondaryDuration)}.`);
  if (ability.restockDamageBonus) effects.push(`Boosts your next physical ability's damage by ${rounded(ability.restockDamageBonus * 100)}%. Use it within 8s.`);

  const facts = [ability.range === Infinity ? 'Range: Anywhere' : !ability.range ? 'Range: Self' : `Range: ${distance(ability.range)}`];
  if (ability.shape === 'Circle') facts.push(`Radius: ${distance(ability.radius / 100)}`);
  if (ability.shape === 'Line') facts.push(`Line: ${distance(ability.width / 100)} wide`);
  if (ability.shape === 'Cone') facts.push(`Cone reach: ${distance(ability.radius / 100)}`);
  facts.push(`Cooldown: ${seconds(ability.cooldown)}`);
  const costs = [];
  if (ability.manaFraction) costs.push(`${Math.round(unit.maxMana * ability.manaFraction)} Mana`);
  if (ability.healthFraction) costs.push(`${rounded(ability.healthFraction * 100)}% current Health${ability.healthPayer === 'Every living ally' ? ' from each ally' : ''}`);
  if (costs.length) facts.push(`Cost: ${costs.join(' + ')}`);

  // Explain requirements and tradeoffs that can change a player's loadout choice. Leave
  // AI selection rules, stacking implementation, and internal geometry out of the tooltip.
  const notes = [];
  const restrictions = {
    stealthStrike: 'Requires Stealth and ends it on use.',
    pairedEscape: 'Requires another ally below 25% Health.',
    escapeMovementBuff: 'Requires you below 25% Health and under nearby enemy pressure.',
    reactiveSiphon: 'Requires learned Siphon and an attacker in its range.',
    conditionalHeal: 'Triggers once.',
    channelNextSpellMana: 'Damage interrupts. You cannot move or act while channeling.',
    partyOneCooldownReduction: 'Only cooldowns with 5s or less remaining qualify.',
    decoyThreat: 'Bosses ignore the decoy.',
    arenaRepositionTruce: 'Bosses are unaffected.'
  };
  if (restrictions[ability.handler]) notes.push(restrictions[ability.handler]);
  if (['restoreCharges', 'restoreChargesNextBoost', 'partyRestoreCharges'].includes(ability.handler)) notes.push('Only refills packs carried into this battle; temporary charges expire afterward.');
  if (['remainingCooldownReduction', 'partyCooldownReduction', 'partyOneCooldownReduction'].includes(ability.handler)) notes.push('Excludes restocks and once-only skills.');
  if (ability.healthFraction) notes.push(ability.healthPayer === 'Every living ally'
    ? 'Requires each living ally at 25% Health or above. Health costs cannot be lethal.'
    : 'Requires at least 25% Health. Health costs cannot be lethal.');
  if (ability.oncePerWave) notes.push('Once per wave.');
  if (ability.oncePerEncounter) notes.push('Once per encounter.');
  // The battle sheet gives effects and usage facts separate space on each ability card.
  if (structured) return { effects, facts, notes };
  return [effects.join(' '), facts.join(' · '), notes.join(' ')].filter(Boolean).join(compact ? ' ' : '\n\n');
}
