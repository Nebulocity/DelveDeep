import { getEquippedAdventurer } from '../game/Equipment.js';
import { rankedAbility } from '../game/AdventurerAbilities.js';
import { abilityDescription } from '../game/AbilityDescriptions.js';

// Preserve the resolved rank comparison previously displayed by the Hall training UI.
export function trainingComparison(hero, base, current, next) {
  const stats = getEquippedAdventurer(hero);
  const after = rankedAbility(base, next);
  const effect = ability => abilityDescription(stats, ability, { compact: true }).split('Range:')[0].trim();
  if (!current) return `Learn: ${effect(after)}`;
  const before = rankedAbility(base, current);
  const previous = [...effect(before).matchAll(/\d+(?:\.\d+)?/g)].map(match => Number(match[0]));
  let index = 0;
  const improved = effect(after).replace(/(\d+(?:\.\d+)?)(%|s)?/g, (text, amount, unit = '') => {
    const delta = Number((Number(amount) - previous[index++]).toFixed(2));
    return !Number.isFinite(delta) || !delta ? text : `${text} {{(${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)}${unit})}}`;
  });
  const saved = Number(((before.cooldown - after.cooldown) / 1000).toFixed(2));
  return `${improved}\nCooldown: ${after.cooldown / 1000}s${saved ? ` {{(↓ ${saved}s)}}` : ''}`;
}
