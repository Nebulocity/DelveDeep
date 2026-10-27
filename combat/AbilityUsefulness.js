// Read-only estimates for routine effects. Resolution remains authoritative, and
// unsupported secondary effects keep their existing selection path rather than scoring zero.
import { abilityPower, hitAccuracy } from '../game/CharacterStats.js';
import { armorReduction } from '../config/characterProgression.js';
import { arenaDistance } from '../config/combatRanges.js';
import { equipmentPerkBonus } from '../game/EquipmentPerks.js';
import { incomingPressure, missingHealth, healingUrgency } from './CombatDecisions.js';
import { replacementAmount, replacementMultiplier, replacementChance } from './ReplacementEffects.js';
import { createTacticalContext, evaluateTactical, usesTacticalAbility } from './TacticalUsefulness.js';
import { preparedAbility, evaluatePreparation, PREPARATION_HANDLERS } from './PreparationUsefulness.js';
import { evaluateRune } from './BeneficialZones.js';
import { intervenePlan } from './Intervene.js';
import { SECONDARY_THREAT } from './TankMechanics.js';

const DAMAGE = new Set(['damage', 'damageTaunt', 'beamDamage', 'coneDamage', 'armorPiercingDamage', 'damageLifesteal', 'areaDamageLifesteal',
  'areaDamageLinkedHeal', 'allDamagePartyLinkedHeal', 'areaDamageLowestHeal', 'damageNearestHeal',
  'damageEscapeTeleport', 'damageEnemyTeleport']);
const HEALTH = new Set(['heal', 'healthCostHeal', 'partyHealthCostHeal', 'healMana', 'partyHealMana']);
const MANA = new Set(['restoreMana', 'healthToMana', 'manaDrain', 'partyManaOverTime']);

// Compare fractions of actual recipients' resources, not nominal target counts.
// A 300 ms floor prevents very short windups dominating; spending 25% of a resource
// doubles the cost denominator. These are bounded routine-use estimates, not cooldown policy.
const MIN_ACTION_MS = 300;
const RESOURCE_COST_WEIGHT = 4;

export function betterAssessment(a, b) {
  return a && a.score > 0 && (!b || a.tier > b.tier || a.tier === b.tier && a.score > b.score);
}

function assessment(unit, benefit, tier, windup, manaCost, healthCost = 0) {
  const cost = manaCost / Math.max(1, unit.maxMana) + healthCost;
  return { tier, benefit: Math.max(0, benefit), score: Math.max(0, benefit) / (Math.max(MIN_ACTION_MS, windup) / 1000)
    / (1 + RESOURCE_COST_WEIGHT * cost) };
}

// Expected ordinary damage uses current accuracy, armor and timed modifiers without
// rolling hits/crits, expiring shields or triggering reactions. It is not a combat simulation.
export function damageEstimate(scene, unit, target, amount, physical, time, piercing = 0, basic = false,
  opening = { remaining: unit.status.nextAttackBoost ?? 0 }, critBonus = 0) {
  opening.hitChance = 0;
  if (!target.alive || amount <= 0) return 0;
  const accuracy = Math.max(0, hitAccuracy(unit) + replacementChance(unit, 'hit', time));
  if (accuracy < (target.minimumAccuracy ?? 0)) return 0;
  let hit = Math.min(1, accuracy);
  if (time < (unit.status.blindUntil ?? 0)) hit *= 1 - (unit.status.blindChance ?? 0);
  if (target.statProgressionVersion === 2) hit *= 1 - Math.max(0, Math.min(.3,
    (target.dodge ?? 0) + replacementChance(target, 'dodge', time) + equipmentPerkBonus(target, 'dodge')));
  amount *= replacementMultiplier(unit, physical ? 'attack' : 'spell', time)
    * replacementMultiplier(unit, 'damage', time);
  amount *= 1 + equipmentPerkBonus(unit, 'damage', target, scene.partyUnits, { basic, spell: !physical });
  amount *= 1 - equipmentPerkBonus(target, 'reduction');
  if (time < (unit.status.damageBoostUntil ?? 0)) amount *= 1 + unit.status.damageBoost;
  if (time < (unit.status.enrageUntil ?? 0)) amount *= unit.status.enrageDamage;
  else if (time < (unit.status.exhaustedUntil ?? 0)) amount *= unit.status.exhaustedDamage;
  if (time < (unit.status.honorDamageUntil ?? 0)) amount *= 1 + unit.status.honorDamageBoost;
  if (time < scene.assaultUntil) amount *= 1 + scene.assaultBonus;
  if (unit.role !== 'Healer' && target.id === scene.focusDamageTargetId && time < scene.focusDamageUntil) amount *= 1.05;

  // Allocate once in recipient order to the first possible hit. A miss could pass
  // it onward at resolution; conservatively omit that extra probability branch.
  if (hit > 0) { amount *= 1 + opening.remaining; opening.remaining = 0; }
  if (time < (target.status.immuneUntil ?? 0)) return 0;
  opening.hitChance = hit;
  if (target.statProgressionVersion === 2 && physical) {
    const armor = (target.armor ?? 0) * replacementMultiplier(target, 'armor', time)
      * (time < (target.status.armorUntil ?? 0) ? target.status.armorMultiplier : 1);
    amount *= 1 - armorReduction(armor * (1 - piercing));
  }
  amount *= (target.damageTakenMultiplier ?? 1) * replacementMultiplier(target, 'reduction', time)
    * replacementMultiplier(target, 'vulnerability', time);
  if (!physical) amount *= replacementMultiplier(target, 'spellReduction', time);
  if (time < (target.status.damageReductionUntil ?? 0)) amount *= 1 - target.status.damageReduction;
  if (time < (target.status.damageTakenBoostUntil ?? 0)) amount *= 1 + target.status.damageTakenBoost;
  if (time < (target.status.shieldUntil ?? 0)) amount *= .35;
  if (time < (target.status.arcaneShieldUntil ?? 0)) amount *= !physical || unit.attackRange > 180 ? 0 : .55;
  amount *= 1 - (target.status.nextHitReduction ?? 0);
  const shield = time < (target.status.temporaryHpUntil ?? Infinity) ? target.status.temporaryHp ?? 0 : 0;
  const ordinary = Math.min(target.hp, Math.max(0, amount - shield));
  const chance = Math.max(0, (unit.critChance ?? 0) + equipmentPerkBonus(unit, 'crit', target)
    + replacementChance(unit, 'crit', time));
  const cap = unit.statProgressionVersion === 2 ? .4 : .95;
  const extra = Math.max(0, Math.min(cap, chance + critBonus) - Math.min(cap, chance));
  const critical = Math.min(target.hp, Math.max(0, amount * (unit.critMultiplier ?? 1.75) - shield));
  return (ordinary + extra * (critical - ordinary)) * hit;
}

function healthBenefit(scene, unit, target, amount, time, paidHealth = 0, nextHealBoost = unit.status.nextHealBoost ?? 0) {
  if (!target.alive || target.isDecoy) return { value: 0, tier: 0 };
  amount *= (1 + equipmentPerkBonus(unit, 'healing', target)) * (1 + equipmentPerkBonus(target, 'receivedHealing'));
  if (time < (unit.status.healingBoostUntil ?? 0)) amount *= 1 + unit.status.healingBoost;
  if (time < (unit.status.honorHealingUntil ?? 0)) amount *= 1 + unit.status.honorHealingBoost;
  if (time < (target.status.healingReductionUntil ?? 0)) amount *= 1 - target.status.healingReduction;
  amount *= 1 + nextHealBoost;
  const useful = Math.min(missingHealth(scene, target) + paidHealth, Math.max(0, amount));
  const urgent = target.hp / target.maxHp < .4
    || target.hp / target.maxHp < .8 && incomingPressure(scene, target) > 0;
  return { value: useful / target.maxHp * (1 + Math.min(1, healingUrgency(scene, target))),
    tier: useful > 0 ? urgent ? 2 : 1 : 0 };
}

// These are the same legal basic targets used by the class fallback. Queries do not
// update remembered targets or clear player orders while comparing alternatives.
export function basicCandidates(system, unit, time, preparations = unit.status.replacementPreparations ?? []) {
  const scene = system.scene, allies = system.allies();
  const priority = unit.role === 'Healer' ? scene.getHealerPriorityTarget(unit, false) : null;
  const healingNeeded = unit.role === 'Healer' && (priority || allies.some(ally => ally.hp / ally.maxHp < .8));
  const ordered = !healingNeeded && system.enemies().some(enemy => enemy.id === scene.attackTargets.get(unit.id));
  const result = [];
  if (unit.role === 'Healer' && !ordered && unit.canCast(time) && unit.canHeal(time)) {
    const injured = allies.filter(ally => missingHealth(scene, ally) > 0)
      .sort((a, b) => healingUrgency(scene, b) - healingUrgency(scene, a));
    const target = (priority ? [priority] : injured).find(ally => missingHealth(scene, ally) > 0
      && arenaDistance(unit, ally) <= unit.basicHealRange * 100);
    if (target) {
      const benefit = healthBenefit(scene, unit, target, abilityPower(unit, {}, unit.basicHealPower, true), time);
      result.push({ kind: 'mend', target, assessment: assessment(unit, benefit.value, benefit.tier,
        unit.healWindup, unit.basicHealManaCost ?? 0) });
    }
  }
  const preferred = scene.getPrimaryTarget(unit, false);
  const target = scene.movement?.basicAttackTarget(unit, preferred) ?? preferred;
  if (!healingNeeded && !unit.stealthed && target && scene.isWithinAttackReach(unit, target) && unit.canAttack(time)) {
    const attackType = ['Tank', 'Melee DPS'].includes(unit.role) ? 'melee' : unit.className === 'Ranger' ? 'ranged' : 'spell';
    let power = unit.attackPower, critBonus = 0;
    for (const prep of preparations) {
      if (prep.until > time && prep.ability.handler === 'nextCritBonus' && unit.basicAttackDamageType !== 'spell') critBonus += prep.ability.primary.potency;
      if (prep.until > time && (prep.ability.handler === 'nextPhysicalBoost' && unit.basicAttackDamageType !== 'spell')) {
        power *= 1 + prep.ability.primary.potency;
      }
    }
    const damage = damageEstimate(scene, unit, target, power, attackType !== 'spell', time, 0, true, undefined, critBonus);
    result.push({ kind: 'attack', target, attackType,
      assessment: assessment(unit, damage / target.maxHp, 1, unit.attackWindup, 0) });
  }
  return result;
}

export function evaluateAbility(system, unit, ability, target, time, context = null, basic = null, options = {}) {
  const handler = ability.handler;
  const tactical = usesTacticalAbility(ability);

  if (unit.stealthed) return null;
  if (handler === 'intervene') {
    context ??= createTacticalContext(system, time);
    const plan = intervenePlan(system, unit, target, ability, time, { context });
    if (!plan) return { benefit: 0, tier: 0, score: 0 };
    const damage = plan.mode === 'offensive' ? damageEstimate(system.scene, unit, target,
      replacementAmount(unit, target, ability.primary), true, time) / target.maxHp : 0;
    const value = evaluateTactical(context ?? createTacticalContext(system, time), unit, ability, target, damage);
    return assessment(unit, value.benefit, value.tier, ability.windup + plan.travelMs, 0);
  }
  if (PREPARATION_HANDLERS.has(handler)) return evaluatePreparation(system, unit, ability, target, time, context, evaluateAbility, basicCandidates);
  if (handler.startsWith('rune')) {
    const preview = options.prepared ? ability : preparedAbility(system, unit, ability, time);

    // Mixed prepared echoes need resolver-specific repeated-trigger accounting.
    if (preview.echoScale || preview.coveringFire || preview.manaReturn) return null;
    return evaluateRune(system, unit, preview, target, time,
      context ?? createTacticalContext(system, time), damageEstimate, basicCandidates(system, unit, time));
  }
  if (!tactical && !DAMAGE.has(handler) && !HEALTH.has(handler) && !MANA.has(handler)) return null;
  if (!options.prepared) ability = preparedAbility(system, unit, ability, time);

  // Echoes of mixed effects need their own repeated-recipient accounting. Keep those
  // on the existing path rather than inventing repeated control, healing or teleports.
  if (ability.echoScale && !['damage', 'damageTaunt', 'beamDamage', 'coneDamage', 'armorPiercingDamage'].includes(handler)) return null;
  if ((ability.coveringFire || ability.manaReturn) && !DAMAGE.has(handler)) return null;
  const scene = system.scene, cost = ability.manaCost ?? 0;
  let benefit = 0, tier = 1, dealt = 0, healthCost = 0;
  let nextHealBoost = unit.status.nextHealBoost ?? 0;
  const damageByEnemy = new Map();
  const healthPayments = new Map();
  for (const payer of ability.healthPayer === 'Every living ally' ? system.allies() : [unit]) {
    if (!ability.healthFraction) continue;
    const paid = Math.min(payer.hp - 1, Math.round(payer.hp * ability.healthFraction));
    healthPayments.set(payer, paid);
    healthCost += paid / payer.maxHp;
  }
  const addHealth = (ally, amount) => {
    const recovery = healthBenefit(scene, unit, ally, amount, time,
      (healthPayments.get(ally) ?? 0) + (options.demand?.get(ally) ?? 0), nextHealBoost);

    // Resolution spends this bonus on the first actual heal call, even at full HP.
    // Consume only the local estimate so comparing another action sees the same buff.
    if (ally.alive && !ally.isDecoy && amount > 0) nextHealBoost = 0;
    benefit += recovery.value; tier = Math.max(tier, recovery.tier);
  };
  const addMana = (ally, amount) => {
    if (!ally.alive || ally.maxMana <= 0) return;

    // Count the caster's payment before restoration, then subtract it once below.
    const missing = ally.maxMana - ally.mana + (ally === unit ? cost : 0);
    benefit += Math.min(missing, Math.max(0, amount)) / ally.maxMana;
  };
  if (DAMAGE.has(handler)) {
    const opening = { remaining: unit.status.nextAttackBoost ?? 0 };
    let noLandedHit = 1, primaryDealt = 0;
    for (const enemy of system.recipients(unit, target, ability)) {

      // Match Solar Strike's single combined hit, including any prepared extra damage.
      const power = replacementAmount(unit, enemy, ability.primary) * (handler === 'damageTaunt' ? 1 + (ability.echoScale ?? 0) : 1)
        + (handler === 'damageTaunt' && ability.coveringFire ? unit.attackPower * ability.coveringFire.power : 0);
      let amount = damageEstimate(scene, unit, enemy, power,
        ability.damageType === 'physical', time, handler === 'armorPiercingDamage' ? ability.secondary.potency : 0, false, opening, ability.criticalBonus ?? 0);
      const landedChance = amount > 0 ? opening.hitChance : 0;
      primaryDealt += amount;
      noLandedHit *= 1 - landedChance;
      if (ability.echoScale && handler !== 'damageTaunt') {
        const echo = damageEstimate(scene, unit, enemy, replacementAmount(unit, enemy,
          { ...ability.primary, potency: ability.primary.potency * ability.echoScale }), ability.damageType === 'physical',
          time, handler === 'armorPiercingDamage' ? ability.secondary.potency * ability.echoScale : 0,
          false, { remaining: 0 });
        amount += Math.min(Math.max(0, enemy.hp - amount), echo);
      }
      if (ability.coveringFire && amount > 0 && handler !== 'damageTaunt') {

        // Conservative lower bound: the extra hit follows a landed hit. Suppression
        // is omitted, and the resolver's damage type is retained despite the UI text.
        const extra = damageEstimate(scene, unit, enemy, unit.attackPower * ability.coveringFire.power,
          ability.damageType === 'physical', time, 0, false, { remaining: 0 });
        amount += Math.min(Math.max(0, enemy.hp - amount), extra * landedChance);
      }
      benefit += amount / enemy.maxHp;
      damageByEnemy.set(enemy, amount);
    }
    dealt = primaryDealt;
    const spread = SECONDARY_THREAT[ability.id];
    if (spread && dealt > 0) {

      // Crowd threat is useful only where control is actually lost. Keep this small
      // and bounded; it never substitutes secondary damage for a single-target hit.
      const influence = system.enemies().filter(enemy => enemy !== target
        && arenaDistance(enemy, target) <= spread.radius && enemy.currentTargetId !== unit.id
        && system.allies().some(ally => ally !== unit && ally.id === enemy.currentTargetId))
        .reduce((sum, enemy) => sum + .04 * spread.fraction / .25 * Math.min(2, 1 + system.rescuePriority(unit, enemy)), 0);
      benefit += Math.min(.12, influence);
    }
    if (ability.manaReturn && dealt > 0) {
      addMana(unit, Math.min(unit.maxMana * .1, dealt * ability.manaReturn.fraction));
      for (const ally of system.allies()) if (ally !== unit) addMana(ally, ally.maxMana * ability.manaReturn.party * (1 - noLandedHit));
    }
    if (handler === 'areaDamageLowestHeal' || handler === 'damageNearestHeal') {
      if (dealt > 0) for (const ally of system.offensiveHealingRecipients(unit, target, ability)) {
        addHealth(ally, replacementAmount(unit, ally, ability.secondary));
      }
    } else if (['damageLifesteal', 'areaDamageLifesteal', 'areaDamageLinkedHeal', 'allDamagePartyLinkedHeal'].includes(handler) && dealt > 0) {
      const recipients = handler.includes('Lifesteal') ? [unit] : system.offensiveHealingRecipients(unit, target, ability);
      const power = unit.spellPower != null ? unit.spellPower * replacementMultiplier(unit, 'spell', time) : unit.spellHealing;
      const cap = power * (1 + ((ability.rank ?? 1) - 1) * .08) * (handler === 'allDamagePartyLinkedHeal' ? .6 : .5);
      for (const ally of recipients) addHealth(ally, Math.min(dealt * ability.secondary.potency, cap));
    }
  } else if (HEALTH.has(handler)) {
    for (const ally of system.recipients(unit, target, ability, true)) {
      addHealth(ally, replacementAmount(unit, ally, ability.primary));
      if (handler === 'healMana' || handler === 'partyHealMana') addMana(ally, replacementAmount(unit, ally, ability.secondary));
    }
  } else if (handler === 'manaDrain') {
    addMana(unit, Math.min(target.mana, replacementAmount(unit, target, ability.primary)) * ability.secondary.potency);
  } else if (MANA.has(handler)) {
    for (const ally of system.recipients(unit, target, ability, true)) addMana(ally, replacementAmount(unit, ally, ability.primary));
  }
  if (tactical) {
    const value = evaluateTactical(context ?? createTacticalContext(system, time), unit, ability, target, benefit, damageByEnemy);
    const result = assessment(unit, value.benefit - healthCost, value.tier, ability.windup, cost, healthCost);

    // Spending an escape purely for offense requires substantial actual coverage and
    // twice the legal basic action's score. A missing basic is not a free escape cast.
    if (value.extraordinary && (value.benefit < .75 || result.score <= (basic?.score ?? 0) * 2)) result.score = 0;
    if (value.reserve) result.score /= 1 + Math.min(2, ability.cooldown / 30000);
    return result;
  }
  if (MANA.has(handler) || handler === 'healMana' || handler === 'partyHealMana') benefit -= cost / Math.max(1, unit.maxMana);
  benefit -= healthCost;

  // Mana-over-time is guaranteed restoration spread over time, not immediate Health.
  const delay = handler === 'partyManaOverTime' ? ability.duration / 2 : 0;
  return assessment(unit, benefit, tier, ability.windup + delay, cost, healthCost);
}
