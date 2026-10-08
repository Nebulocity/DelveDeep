import { abilityPower, linkedHealing } from './CharacterStats.js';
import { ADJACENT_DISTANCE, ARENA_RANGE, rangeLabel } from '../config/combatRanges.js';

const number = value => Number((value ?? 0).toFixed(2));
const percent = value => `${number(value * 100)}%`;
const seconds = value => `${number(value / 1000)} seconds`;
const distance = value => `${number(value * ADJACENT_DISTANCE)} units`;
const amountRange = (low, high = low) => `${Math.round(Math.min(low, high))}-${Math.round(Math.max(low, high))}`;

function recipients(ability) {
  const ally = ['heal', 'protect'].includes(ability.effect);
  const side = ally ? 'allies' : 'enemies';
  if (ability.effect === 'protect' && ability.target === 'allies') {
    return `all allies within a ${distance(ability.radius ?? 2)} radius of you`;
  }
  if (ability.effect === 'trap') return 'the first enemy within 60 units of the trap';
  if (ability.beam) return 'enemies in a 100-unit-wide line toward the target';
  if (ability.zone || ability.splash) return `all ${side} within a ${distance(ability.zone ?? ability.splash)} radius of the target`;
  if (ability.radius) return `all ${side} within a ${distance(ability.radius)} radius of you`;
  if (ability.target === 'self') return 'yourself';
  if (ability.targets === Infinity) return 'all enemies in range';
  if (ability.targets > 1) return `up to ${ability.targets} enemies in range`;
  return ally ? 'one ally or yourself' : 'one enemy';
}

// Describe the current ranked skill with concrete results, without exposing stat calculations.
export function abilityDescription(unit, ability) {
  const a = ability;
  const lines = [];
  const targets = recipients(a);
  let low = a.power ?? 0;
  let high = a.highPower ?? a.lowHealthPower ?? low;
  if (a.missingHealthBonus) high = low * 2;
  if (a.rearBonus) high = Math.max(high, low * (1 + a.rearBonus));
  if (a.lowHealthBoost) high = Math.max(high, low * (1 + a.lowHealthBoost));
  const healing = ['heal', 'refuge'].includes(a.effect);
  const minimum = abilityPower(unit, a, low, healing);
  const maximum = abilityPower(unit, a, high, healing);
  const amounts = amountRange(minimum, maximum);
  const duration = seconds(a.duration ?? 0);

  if (['damage', 'trap'].includes(a.effect)) {
    if (a.effect === 'trap') lines.push(`Place a trap that deals ${amounts} damage to ${targets}. It lasts until triggered or the wave ends.`);
    else if (!a.poison) lines.push(`Deal ${amounts} ${a.damageType ?? 'physical'} damage to ${targets}.`);
    else lines.push(`Poison ${targets}.`);
    if (a.charge) lines.push('Rush into melee range before striking.');
    if (a.requiresStealth) lines.push('Requires stealth and ends it when you strike.');
    if (a.behind) lines.push('Move behind the target before striking.');
    if (a.judgement) lines.push('Deals the higher damage amount when the target is not focused on a tank.');
    if (a.missingHealthBonus) lines.push('Deals more damage while you are wounded.');
    if (a.rearBonus) lines.push('Deals the higher damage amount when the target is focused on someone else.');
    if (a.healRatio) {
      const scope = a.healScope === 'lowest' ? 'your most wounded ally'
        : a.healScope === 'near' ? 'all allies within 100 units of the target' : 'all living allies';
      lines.push(`Heal ${scope} for up to ${amountRange(linkedHealing(unit, a, minimum), linkedHealing(unit, a, maximum))} Health per enemy hit. Healing depends on damage dealt.`);
    }
    if (a.threatMultiplier > 1 || a.totalThreat) lines.push('Draw additional enemy attention with each hit.');
    if (a.friendlyFire) lines.push('Also damages allies caught in the line.');
  } else if (a.effect === 'heal') {
    lines.push(`Restore ${amounts} Health to ${targets}.`);
    if (a.lowHealthPower || a.lowHealthBoost) lines.push('Restores the higher amount when you are below half Health.');
    if (a.selfDamage) lines.push(`Healing another ally costs you ${a.selfDamage} Health. Healing yourself has no Health cost.`);
    if (a.retaliation) lines.push(`The recipient retaliates against the next attacker for ${Math.round(abilityPower(unit, { ...a, damageType: 'nature' }, a.retaliation))} nature damage.`);
    if (a.temporaryHp) lines.push(`A successful heal grants ${a.temporaryHp} extra shield Health.`);
  } else if (a.effect === 'protect') {
    if (a.powerUnit === 'shield HP') lines.push(`Grant ${targets} a shield that absorbs ${number(a.power)} damage for ${duration}.`);
    else if (a.powerUnit.includes('dodge')) lines.push(`Grant ${targets} a ${number(Math.min(75, a.power))}% chance to evade ${a.rangedOnlyDodge ? 'ranged' : 'incoming'} hits for ${duration}.`);
    else lines.push(`Reduce incoming damage to ${targets} by ${number(Math.min(75, a.power))}% for ${duration}.`);
    if (a.intercept) lines.push('When used on an ally, redirect their next hit to you.');
  } else if (a.effect === 'prepare') {
    const value = `${number(a.power)}%`;
    const unitName = a.powerUnit ?? '';
    if (unitName.includes('heal')) lines.push(`Your next heal restores ${value} more Health.`);
    else if (unitName.includes('windup')) lines.push(`Reduce the windup of your next ${a.protectiveOnlyWindup ? 'protective spell' : 'spell'} by ${value}.`);
    else if (unitName.includes('critical')) lines.push(`Gain ${value} critical chance for ${duration}${a.nextCritOnly ? ', ending after your next attack' : ''}.`);
    else if (unitName.includes('movement')) lines.push(`Move ${value} faster for ${duration}.`);
    else if (unitName.includes('threat reduction')) lines.push(`Generate ${value} less threat for ${duration}.`);
    else if (unitName.includes('poison')) lines.push(`Your next damaging hit poisons its target for ${Math.round(abilityPower(unit, a))} damage every 2 seconds for 6 seconds.`);
    else if (unitName.includes('next-hit')) lines.push(`Your next damaging hit deals ${value} more damage.`);
    else if (unitName.includes('spell bonus')) lines.push(`Your next damaging spell deals ${value} more damage.`);
    else if (unitName.includes('attack bonus')) lines.push(`Deal ${value} more damage for ${duration}.`);
    else if (unitName.includes('damage reduction')) lines.push(`Take ${value} less damage for ${duration}.`);
    else if (unitName.includes('duration')) lines.push('Your next protection ability lasts longer.');
    if (a.extraMoveBonus) lines.push(`Move ${percent(a.extraMoveBonus)} faster for ${duration}.`);
    if (a.selfReduction) lines.push(`Take ${percent(a.selfReduction)} less damage for ${duration}.`);
    if (a.nextProtectionBonus) lines.push(`Your next protection ability is ${percent(a.nextProtectionBonus)} stronger.`);
    if (a.nextProtectionDurationBonus) lines.push(`Your next protection ability lasts ${percent(a.nextProtectionDurationBonus)} longer.`);
    if (a.nextThreatBonus) lines.push('Your next damaging hit draws additional enemy attention.');
    if (a.nextRangeBonus) lines.push(`Your next damaging ability reaches ${distance(a.nextRangeBonus)} farther.`);
    if (a.nextLinkedHealRatio) lines.push('Your next damaging spell also heals your most wounded ally.');
    lines.push(`Use on yourself. Preparation lasts ${duration}.`);
  } else if (a.effect === 'taunt') {
    lines.push(`Force ${targets} to attack you for ${duration}.`);
    if (a.farthest) lines.push('Prioritizes the farthest enemies and draws them toward you.');
    if (a.reduction) lines.push(`Take ${percent(a.reduction)} less damage for ${duration}.`);
  } else if (a.effect === 'vow') {
    lines.push(`Protect one ally or yourself, reducing incoming damage by ${percent(a.reduction)} for ${seconds(a.immunityDuration)} and drawing their attackers to you.`);
    lines.push(`Their attackers focus on you for ${duration}.`);
  } else if (a.effect === 'parry') {
    lines.push(`When struck, gain a ${percent(a.chance)} chance to deflect the hit and reflect its damage at the attacker.`);
  } else if (a.effect === 'sacrifice') {
    lines.push(`Sacrifice yourself to revive all fallen allies and fully restore your other allies' Health and Mana. You cannot revive again this encounter.`);
    lines.push(`Living damage dealers deal ${percent(a.damageBoost)} more damage, and healers restore ${percent(a.healingBoost)} more Health, for ${duration}.`);
    lines.push('Available only during the final boss with exactly one other living ally and at least one fallen ally. Once per encounter.');
  } else if (a.effect === 'stealth') {
    lines.push(`Hide from enemy targeting for up to ${duration}, ending when you attack. Requires that no enemy is currently targeting you.`);
  } else if (a.effect === 'enrage') {
    lines.push(`Deal ${percent(a.damageMultiplier - 1)} more damage and take ${percent(a.incomingMultiplier - 1)} more damage for ${duration}. Then deal ${percent(1 - a.recoveryMultiplier)} less damage for ${seconds(a.recovery)}.`);
  } else if (a.effect === 'mark') {
    lines.push(`Mark one enemy, making it take ${percent(a.damageTakenBoost)} more damage for ${duration}.`);
  } else if (a.effect === 'stabilize') {
    lines.push(`Take ${percent(a.reduction)} less damage for ${duration}. Your next damaging spell deals ${percent(a.spellBoost)} more damage.`);
  } else if (a.effect === 'aegis') {
    lines.push(`Your next single-target heal restores ${percent(a.healBonus)} more Health and also heals you when used on another ally.`);
  } else if (a.effect === 'armor') {
    lines.push(`Increase your Armor by ${percent(a.armorMultiplier - 1)} for ${duration}.`);
  } else if (a.effect === 'refuge') {
    lines.push(`Restore ${amounts} Health to yourself every ${seconds(a.interval)} for ${duration}. Reduce your next incoming hit by 50%.`);
  } else if (a.effect === 'ascendance') {
    lines.push(`Restore ${percent(a.healingBoost)} more Health with your healing for ${duration}. Gain one teleport up to ${distance(a.teleportRange)} during that time.`);
  } else if (a.effect === 'teleport') {
    lines.push(`Teleport to a walkable destination more than ${distance(a.moveThreshold)} away, or escape nearby enemies by up to ${distance(a.moveThreshold + 1)}. Cannot teleport while held or rooted.`);
  } else lines.push(a.description ?? `Use ${a.name} on ${targets}.`);

  if (a.stun) lines.push(`Stun affected enemies for ${seconds(a.stun)}.`);
  if (a.root) lines.push(`Root affected enemies in place for ${seconds(a.root)}.`);
  if (a.blind) lines.push(`Blind affected enemies for ${seconds(a.blind)}${a.blindChance ? `, giving their attacks a ${percent(a.blindChance)} chance to miss` : ''}.`);
  if (a.poison && a.effect === 'damage') {
    lines.push(`Deal ${Math.round(abilityPower(unit, a, a.poison.power))} poison damage every ${seconds(a.poison.interval)} for ${seconds(a.poison.duration)}.`);
    if (a.attackSlow) lines.push(`Slow their attacks by ${percent(a.attackSlow)} while poisoned.`);
  }
  if (a.slow) lines.push(`Slow enemy movement by ${percent(a.slow)} for ${seconds(Math.max(2000, a.duration))}.`);
  if (a.healingReduction) lines.push(`Reduce the target's received healing by ${percent(a.healingReduction)} for ${duration}.`);
  if (a.damageTakenBoost && a.effect !== 'mark') lines.push(`Affected enemies take ${percent(a.damageTakenBoost)} more damage for ${duration}.`);
  if (a.targetThreatReduction) lines.push(`Generate ${percent(a.targetThreatReduction)} less threat for ${duration}.`);
  lines.push(!a.range ? 'Range: Self.' : a.range >= ARENA_RANGE || !Number.isFinite(a.range)
    ? 'Range: Anywhere in the arena.' : `Range: ${rangeLabel(a.range)} (${distance(a.range)}).`);
  if (a.cooldown) lines.push(`Cooldown: ${seconds(a.cooldown)}.`);
  if (a.manaCost) lines.push(`Costs ${a.manaCost} Mana.`);
  return lines.join('\n\n');
}

export function leaderAbilityDescription(ability, party = []) {
  if (ability.id === 'encouragement') {
    const amounts = party.filter(hero => hero.alive !== false).map(hero => Math.round(hero.maxHp * ability.healFraction));
    return `${amounts.length ? `Restore ${amountRange(Math.min(...amounts), Math.max(...amounts))} Health to every living ally.`
      : 'Restore Health to every living ally.'}\n\nCooldown: ${seconds(ability.cooldown)}.`;
  }
  if (ability.id === 'coordinatedAttack') {
    const attackers = party.filter(hero => hero.alive !== false && hero.role === 'Melee DPS');
    if (!attackers.length) return `${ability.description} Range: Anywhere in the arena. Requires a living melee damage dealer.`;
    const damage = attackers.reduce((total, hero) => total + hero.attackPower, 0) * 3;
    return `Melee damage dealers focus one enemy anywhere in the arena, dealing ${amountRange(damage)} physical damage and rooting it for 6 seconds. Requires a living melee damage dealer. Once per encounter.`;
  }
  if (ability.id === 'lunarAssault') {
    const attackers = party.filter(hero => hero.alive !== false && hero.className?.startsWith('Mage of the'));
    if (!attackers.length) return `${ability.description} Range: Anywhere in the arena. Requires a living mage; affected enemies must be engaged.`;
    const damage = attackers.reduce((total, hero) => total + hero.spellDamage, 0) * 3;
    return `Mages deal ${amountRange(damage)} spell damage to enemies within a 400-unit radius of a target anywhere in the arena and root them for 8 seconds. Requires a living mage; affected enemies must be engaged. Once per encounter.`;
  }
  return `${ability.description}${ability.cooldown ? `\n\nCooldown: ${seconds(ability.cooldown)}.` : ''}`;
}
