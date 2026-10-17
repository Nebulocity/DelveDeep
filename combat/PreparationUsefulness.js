// One setup and one observed follow-up, never a recursive plan or saved action queue.
import { createTacticalContext } from './TacticalUsefulness.js';

export const PREPARATION_HANDLERS = new Set(['nextPhysicalBoost', 'nextSpellBoost', 'nextWindupReduction',
  'nextCritBonus', 'nextProtectionBoost', 'nextAssaultPotencyCost', 'nextRestorePotencyCost',
  'nextRestorePotencyDuration', 'nextAssaultAccuracyDamage', 'nextAssaultManaReturn', 'duplicateNextAssault']);
const MAX_WAIT_MS = 1500;
const MAX_COMBO_MS = 4000;

// Mirror cast's ordered preparation transformations on a detached ability. Resolution
// remains the owner of consumption, including last-wins fields and capped potency.
export function preparedAbility(system, unit, base, time, preparations = unit.status.replacementPreparations ?? []) {
  const ability = { ...base, primary: { ...base.primary }, secondary: { ...base.secondary } };
  const ready = preparations.filter(prep => prep.until > time && system.preparationMatches(prep.ability.handler, base));
  let cost = base.manaCost ?? 0;
  for (const prep of ready) if (['nextRestorePotencyCost', 'nextAssaultPotencyCost'].includes(prep.ability.handler)) {
    cost *= 1 - prep.ability.secondary.potency;
  }
  ability.manaCost = Math.max(0, Math.round(cost));
  for (const prep of ready) {
    const h = prep.ability.handler, x = prep.ability.primary.potency, y = prep.ability.secondary.potency;
    if (h === 'duplicateNextAssault') ability.echoScale = x;
    else if (h === 'nextWindupReduction') ability.windup = Math.max(100, ability.windup * (1 - x));
    else if (h === 'nextCritBonus') ability.criticalBonus = x;
    else if (h === 'nextAssaultManaReturn') ability.manaReturn = { fraction: x, party: y };
    else if (h === 'nextAssaultAccuracyDamage') ability.coveringFire = { fraction: x, power: y, duration: prep.ability.secondaryDuration };
    else {
      ability.primary.potency = Math.min(ability.primary.cap ?? Infinity, ability.primary.potency * (1 + x));
      if (h === 'nextProtectionBoost' || h === 'nextRestorePotencyDuration') {
        ability.duration = Math.min(ability.durationCap, ability.duration * (1 + y));
        ability.secondaryDuration = Math.min(ability.secondaryDurationCap, ability.secondaryDuration * (1 + y));
      }
    }
  }
  return ability;
}

function availableAt(unit, key, ability, time) {
  const slow = time < (unit.status.attackSlowUntil ?? 0) ? 1 - unit.status.attackSlow : 1;
  const cooldown = ability.cooldown * (unit.status.replacementCooldownFactors?.[key] ?? 1) / slow;
  return Math.max(time, (unit.lastAbilityAt[key] ?? -Infinity) + cooldown, unit.busyUntil ?? 0,
    unit.pendingAction ? unit.pendingAction.startAt + unit.pendingAction.duration : 0,
    unit.status.stunnedUntil ?? 0, unit.status.spellLockUntil ?? 0, unit.status.replacementChannel?.until ?? 0);
}

// Only inspect one layer of real immediate actions. Unknown effects retain their
// existing selection path instead of becoming a fictitious zero-value alternative.
function immediateAction(system, unit, time, context, evaluate, basics) {
  let score = Math.max(0, ...basics.map(action => action.assessment.score));
  let unknown = false;
  if (!unit.canStartAction(time) || !unit.canCast(time)) return { score, unknown };
  for (const [key, ability] of Object.entries(unit.abilities)) {
    if (!ability.replacement || PREPARATION_HANDLERS.has(ability.handler)
      || !unit.abilityReady(key, time) || !system.usable(unit, ability, time)) continue;
    const target = system.candidateTarget(unit, ability, context);
    if (!target) continue;
    const value = evaluate(system, unit, ability, target, time, context);
    if (value === null) unknown = true;
    else score = Math.max(score, value.score);
  }
  return { score, unknown };
}

export function evaluatePreparation(system, unit, setup, target, time, context, evaluate, basics) {
  context ??= createTacticalContext(system, time);
  const empty = { tier: 1, score: 0 };
  if (context.risk(unit, 0, setup.windup).tier >= 2) return empty;
  const recipients = setup.targetLabel === 'Allies' ? system.recipients(unit, target, setup, true) : [unit];
  const cost = setup.manaCost ?? 0;
  const healthCost = (setup.healthPayer === 'Every living ally' ? system.allies() : [unit])
    .reduce((sum, payer) => sum + Math.round(payer.hp * (setup.healthFraction ?? 0)) / payer.maxHp, 0);
  const actorBasics = basics(system, unit, time);
  const actorImmediate = immediateAction(system, unit, time, context, evaluate, actorBasics);
  const actorRate = actorImmediate.score;
  let gain = 0, longest = setup.windup, baseline = actorRate, unknown = false;
  let unknownImmediate = actorImmediate.unknown;
  for (const ally of recipients) {
    if (!ally.alive || ally.isDecoy || ally.stealthed || ally.criticalKnockback || ally.pendingAction
      || system.scene.manualTargets?.has(ally.id)) continue;

    // Do not build a chain over an unused preparation, even if its handler differs.
    if ((ally.status.replacementPreparations ?? []).some(prep => prep.until > time)) continue;
    const mana = ally.mana - (ally === unit ? cost : 0);
    const health = ally.hp - (ally === unit || setup.healthPayer === 'Every living ally'
      ? Math.round(ally.hp * (setup.healthFraction ?? 0)) : 0);
    const basicActions = basics(system, ally, time);
    const available = ally === unit ? actorImmediate : immediateAction(system, ally, time, context, evaluate, basicActions);
    let immediate = available.score, bestGain = 0, bestTime = setup.windup;
    unknownImmediate ||= available.unknown;
    const record = { ability: setup, until: time + setup.windup + setup.duration };
    const followups = Object.entries(ally.abilities).filter(([, a]) => a.replacement && !PREPARATION_HANDLERS.has(a.handler));
    for (const [key, base] of followups) {
      const currentTarget = system.candidateTarget(ally, base, context, null, true);
      const ordinaryNow = currentTarget && ally.abilityReady(key, time) && system.usable(ally, base, time)
        && ally.canStartAction(time) && ally.canCast(time)
        ? evaluate(system, ally, base, currentTarget, time, context) : null;
      const start = Math.max(time + setup.windup, availableAt(ally, key, base, time));
      const wait = start - time - setup.windup;
      if (wait > MAX_WAIT_MS || !system.usable(ally, base, start)
        || start < (ally.status.replacementTruceUntil ?? 0)) continue;
      if (base.healthFraction && (health / ally.maxHp < .25 || health <= Math.max(1, Math.round(health * base.healthFraction)))) continue;
      if (base.healthFraction && base.healthPayer === 'Every living ally' && system.allies().some(payer => {
        const remaining = payer.hp - (payer === unit || setup.healthPayer === 'Every living ally'
          ? Math.round(payer.hp * (setup.healthFraction ?? 0)) : 0);
        return remaining / payer.maxHp < .25 || remaining <= Math.max(1, Math.round(remaining * base.healthFraction));
      })) continue;
      const ordinary = preparedAbility(system, ally, base, start, []);
      const enhanced = preparedAbility(system, ally, base, start, [record]);
      const span = setup.windup + wait + enhanced.windup;
      if (span > Math.min(setup.duration, MAX_COMBO_MS) || enhanced.manaCost > mana) continue;
      if (!system.preparationMatches(setup.handler, base)) continue;

      // Only already observed hits can add near-future healing demand. This is a
      // deficit estimate, not a mutated party snapshot or a predicted combat turn.
      const demand = new Map(context.allies.map(recipient => [recipient,
        Math.min(context.risk(recipient, 0, span).incoming, Math.max(0, recipient.hp - 1))]));
      const followContext = { ...context, time: start,
        risk: (recipient, offset = 0, duration = MAX_COMBO_MS) => context.risk(recipient, start - time + offset, duration) };
      const followTarget = system.candidateTarget(ally, enhanced, followContext, demand, true);
      if (!followTarget) continue;
      const before = evaluate(system, ally, ordinary, followTarget, start, followContext, null, { prepared: true, demand });
      const after = evaluate(system, ally, enhanced, followTarget, start, followContext, null, { prepared: true, demand });
      if (after === null || before === null) { unknown = true; continue; }
      if (after.score <= 0 || ordinaryNow?.tier >= 2) continue;
      if (context.risk(ally, 0, span).tier === 3) continue;
      const netManaAlreadyScored = ['restoreMana', 'healthToMana', 'manaDrain', 'partyManaOverTime', 'healMana', 'partyHealMana'].includes(base.handler);
      const savedMana = netManaAlreadyScored ? 0 : Math.max(0, ordinary.manaCost - enhanced.manaCost) / Math.max(1, ally.maxMana);
      const lostTime = wait + enhanced.windup - ordinary.windup;
      const incremental = after.benefit - before.benefit + savedMana;
      const surplus = incremental - Math.max(immediate, before.score) * lostTime / 1000;

      // Waiting uses only current cooldowns; a near-expiry opportunity is discounted.
      const reliability = 1 - .5 * span / Math.max(1, setup.duration);
      if (surplus * reliability > bestGain) { bestGain = surplus * reliability; bestTime = span; }
    }
    if (['nextPhysicalBoost', 'nextCritBonus'].includes(setup.handler) && ally.basicAttackDamageType !== 'spell') {
      const plain = basicActions.find(action => action.kind === 'attack');
      const enhanced = basics(system, ally, time, [record]).find(action => action.kind === 'attack');
      if (plain && enhanced && setup.windup + ally.attackWindup <= Math.min(setup.duration, MAX_COMBO_MS)) {
        const surplus = enhanced.assessment.benefit - plain.assessment.benefit;
        if (surplus > bestGain) { bestGain = surplus; bestTime = setup.windup + ally.attackWindup; }
      }
    }
    if (ally === unit) baseline = immediate;
    gain += bestGain;
    longest = Math.max(longest, bestTime);
  }

  // Compare a productive follow-up with the same action plus ordinary uptime. The
  // setup's score is the immediate alternative plus only its net two-action advantage.
  // This avoids both counting a free full follow-up and making every short setup lose.
  gain -= actorRate * setup.windup / 1000 + cost / Math.max(1, unit.maxMana) + healthCost;
  gain /= 1 + .1 * Math.min(2, setup.cooldown / 30000);
  if (unknown) return null;
  if (gain <= 0) return empty;
  if (unknownImmediate) return null;
  return { tier: 1, score: baseline + gain / Math.max(.3, longest / 1000) };
}
