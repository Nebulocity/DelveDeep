import { statDisplayNumber } from './StatDisplay.js';

const percent = (value, stat) => `${statDisplayNumber(value * 100, stat)}%`;
const scopes = { party: 'all living allies', physical: 'living physical fighters (tanks, melee fighters and Rangers)',
  magical: 'living Mana users', mages: 'living spell damage dealers', tanks: 'living tanks',
  wounded: 'the living allies with the lowest Health percentage', mana: 'living Mana users',
  lowestMana: 'the living Mana users with the lowest Mana percentage', fallen: 'fallen allies' };
const stats = { attack: 'Attack Power', spell: 'Spell Power', damage: 'damage', armor: 'Armor',
  hit: 'hit chance', crit: 'crit chance', dodge: 'Dodge chance', block: 'Block chance',
  speed: 'action speed', movement: 'movement speed' };

// Descriptions are built from the same amounts and recipient rules the resolver reads.
export function leaderTacticEffectDescription(ability) {
  return ability.effects.map(effect => {
    const recipients = scopes[effect.scope];
    const count = effect.count ? ` (up to ${effect.count})` : '';
    if (effect.kind === 'buff') {
      const changes = Object.entries(effect.changes).map(([stat, value]) => {
        if (stat === 'reduction') return `${percent(-value)} less incoming damage`;
        if (stat === 'spellReduction') return `${percent(-value)} less incoming magical damage`;
        return `+${percent(value, stat === 'crit' ? 'critChance' : stat === 'hit' ? 'hitChance' : stat)} ${stats[stat]}`;
      }).join(' and ');
      return `Grants ${changes} to ${recipients}${effect.scope === 'wounded' ? ' (one ally)' : ''} for ${effect.duration / 1000} seconds.`;
    }
    if (effect.kind === 'heal' || effect.kind === 'mana') return `Restore ${percent(effect.fraction)} of maximum ${effect.kind === 'heal' ? 'Health' : 'Mana'} to ${recipients}${count}.`;
    if (effect.kind === 'cleanse') return `Remove up to ${effect.count} harmful conditions from each of ${recipients}.`;
    if (effect.kind === 'strike') {
      const power = effect.school === 'melee' ? 'Attack Power' : effect.school === 'spell' ? 'Spell Power' : 'higher Attack or Spell Power';
      return `Deal ${percent(effect.potency)} of ${recipients}' average ${power} as ${effect.school === 'melee' ? 'physical' : 'magical'} damage to up to ${effect.targets} enemies anywhere in the arena. Prioritize the focused enemy, then lowest Health. Damage is resolved once per target before its defenses.`;
    }
    if (effect.kind === 'refresh') return `Reduce remaining ${effect.category ? effect.category + ' ' : ''}character-skill cooldowns by ${percent(effect.fraction)} for all living allies. Excludes once-only skills, refills, duplicates, resets, potions and other tactics.`;
    if (effect.kind === 'supplies') return `Restore up to ${effect.count} combat-only uses in each living ally's entry potion pack, up to its capacity. Potion cooldowns remain.`;
    if (effect.kind === 'revive') return `Revive ${effect.count ? `up to ${effect.count}` : 'all'} fallen allies with ${percent(effect.fraction)} Health and Mana.`;
    return '';
  }).join('\n\n') + (ability.oncePerEncounter ? '\n\nOnce per encounter.' : '');
}
