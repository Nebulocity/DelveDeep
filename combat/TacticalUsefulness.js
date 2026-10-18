// Tactical estimates read model state only. No routes, actions or forecasts are saved.
import { arenaDistance, NEAR_DISTANCE } from '../config/combatRanges.js';
import { armorReduction } from '../config/characterProgression.js';
import { abilityPower } from '../game/CharacterStats.js';
import { incomingPressure, missingHealth } from './CombatDecisions.js';
import { replacementAmount, replacementMultiplier, replacementChance } from './ReplacementEffects.js';
import { intervenePlan } from './Intervene.js';
import { equipmentPerkBonus } from '../game/EquipmentPerks.js';
import { HOLD_THE_LINE, INTERPOSE, INTERVENE, VIGILANCE, PERIMETER_RADIUS, PERIMETER_REDUCTION, perimeterOwner } from './TankMechanics.js';

export const TACTICAL_HANDLERS = new Set(['damageEscapeTeleport', 'damageEnemyTeleport', 'arenaRepositionTruce',
  'revive', 'lethalExchange', 'conditionalHeal', 'manaBasedShield', 'shieldReflect', 'shieldBurst',
  'armor', 'allyArmor', 'partyArmor', 'spellReduction', 'partyReduction', 'taunt', 'tauntReduction',
  'damageDebuffTaunt', 'damageTaunt', 'areaStun', 'conditionalStun', 'areaRoot', 'disarm', 'abilityLock',
  'decoyThreat', 'decoyAllyRescue', 'pairedEscape', 'escapeMovementBuff']);
export const TACTICAL_ALLY_HANDLERS = new Set(['lethalExchange', 'conditionalHeal', 'manaBasedShield',
  'shieldReflect', 'shieldBurst', 'armor', 'allyArmor', 'partyArmor', 'spellReduction', 'partyReduction']);

// Scope new support to these skills. Other intercept/counterattack kits retain their
// completed evaluation paths rather than inheriting a new handler-wide policy.
const TANK_TACTICAL_IDS = new Set([HOLD_THE_LINE, INTERPOSE, INTERVENE, VIGILANCE]);
export const usesTacticalAbility = ability => TACTICAL_HANDLERS.has(ability.handler) || TANK_TACTICAL_IDS.has(ability.id);
export const usesTacticalAllyTarget = ability => TACTICAL_ALLY_HANDLERS.has(ability.handler) || TANK_TACTICAL_IDS.has(ability.id);

// Observe at most one approaching hit per enemy over four seconds. These provisional
// thresholds describe serious loss and endangered survivors, not universal HP gates.
const HORIZON_MS = 4000;
const SERIOUS_LOSS = .35;
const ENDANGERED_HP = .4;
const MIN_SAFETY_GAIN = 60;
const PRESERVATION_COST = .1;

export function createTacticalContext(system, time) {
  const scene = system.scene, allies = system.allies(), enemies = system.enemies();
  const warnings = scene.activeTelegraphs ?? [];
  const warningsByEnemy = new Map(enemies.map(enemy => [enemy, warnings.filter(warning => warning.attacker === enemy)]));
  const observations = new Map();
  for (const ally of allies) {
    const pressure = incomingPressure(scene, ally);
    const threats = [];
    for (const enemy of enemies) {
      const action = enemy.pendingAction;
      if (action?.healingReservations) continue;
      if (!action && pressure <= 0) continue;
      const areas = warningsByEnemy.get(enemy);
      const warning = areas.find(area => arenaDistance(ally, area) <= area.radius);
      if (areas.length ? !warning : enemy.currentTargetId !== ally.id) continue;
      const skill = warning?.ability ?? (action && Object.values(enemy.abilities ?? {}).find(a => a.name === action.name));
      if (skill?.effect === 'heal') continue;
      const physical = skill ? skill.damageType === 'physical' : enemy.basicAttackDamageType !== 'spell';
      const distance = arenaDistance(enemy, ally), reach = enemy.attackRange ?? 100;
      const pursuing = !action && distance > reach;
      if (pursuing && (distance > reach + 90 || enemy.status.rootedUntil > time)) continue;
      const remaining = action ? Math.max(0, action.startAt + action.duration - time)
        : Math.max(0, (enemy.lastAttackAt ?? -Infinity) + enemy.attackCooldown - time)
          + enemy.attackWindup + (pursuing ? (distance - reach) / Math.max(1, enemy.moveSpeed) * 1000 : 0);
      if (remaining > HORIZON_MS || enemy.status.stunnedUntil > time + remaining
        || enemy.status.replacementTruceUntil > time + remaining) continue;
      if (!action && physical && enemy.status.replacementDisarmUntil > time + remaining) continue;
      let amount = skill ? abilityPower(enemy, skill) : physical ? enemy.attackPower : enemy.spellPower ?? enemy.spellDamage;
      amount *= Math.max(0, replacementMultiplier(enemy, physical ? 'attack' : 'spell', time))
        * Math.max(0, replacementMultiplier(enemy, 'damage', time));
      const rawAmount = amount;
      const armor = (ally.armor ?? 0) * replacementMultiplier(ally, 'armor', time)
        * (ally.status.armorUntil > time ? ally.status.armorMultiplier : 1);
      if (physical) amount *= 1 - armorReduction(armor);
      amount *= (ally.damageTakenMultiplier ?? 1) * Math.max(0, replacementMultiplier(ally, 'reduction', time));
      if (!physical) amount *= Math.max(0, replacementMultiplier(ally, 'spellReduction', time));
      if (ally.status.damageReductionUntil > time) amount *= 1 - ally.status.damageReduction;
      if (ally.status.shieldUntil > time) amount *= .35;
      if (ally.status.immuneUntil > time + remaining) amount = 0;
      if (ally.status.arcaneShieldUntil > time + remaining) amount *= !physical || reach > 180 ? 0 : .55;
      if (Number.isFinite(amount) && amount > 0) threats.push({ enemy, amount, rawAmount, physical, pending: Boolean(action),
        remaining, pursuing, area: Boolean(warning), warning, skill });
    }
    observations.set(ally, { threats, pressure,
      health: Math.min(ally.maxHp, ally.hp + Math.max(0, ally.maxHp - ally.hp - missingHealth(scene, ally))) });
  }
  const risk = (ally, start = 0, duration = HORIZON_MS) => {
    const observed = observations.get(ally);
    if (!observed) return { threats: [], incoming: 0, health: ally.hp, tier: 0, pressure: 0 };
    const threats = observed.threats.filter(hit => hit.remaining >= start && hit.remaining <= start + Math.min(HORIZON_MS, duration));
    const shield = ally.status.temporaryHpUntil > time ? ally.status.temporaryHp ?? 0 : 0;
    const incoming = Math.max(0, threats.reduce((sum, hit) => sum + hit.amount, 0) - shield);
    const tier = incoming <= 0 ? 0 : incoming >= observed.health ? 3
      : incoming >= ally.maxHp * SERIOUS_LOSS || observed.health - incoming <= ally.maxHp * ENDANGERED_HP ? 2 : 1;
    return { ...observed, threats, incoming, tier };
  };
  return { system, scene, time, allies, enemies, warnings, risk, intervenePlans: new Map(), interveneRouteBudget: { remaining: 192 } };
}

function locked(context, unit) {
  return context.scene.isPositionLocked(unit) || context.scene.manualTargets?.has(unit.id);
}

function safety(context, unit, point) {
  const clearance = Math.min(...context.enemies.map(enemy => arenaDistance(enemy, point) - (enemy.attackRange ?? 100)));
  const warning = context.warnings.some(area => arenaDistance(point, area) <= area.radius + (unit.bodyRadius ?? 20));
  return clearance - (warning ? 400 : 0);
}

function escapeLanding(context, unit, walking = false, range = 4) {
  const { system, time } = context;
  if (locked(context, unit) || unit.status.rootedUntil > time || unit.status.replacementCostRootUntil > time) return null;
  const points = walking ? [system.parent.escapePoint(unit, range)].filter(Boolean)
    : system.parent.surroundingPoints(unit, range * 100).filter(point => system.parent.canTeleport(unit, point));

  // The teleport resolver chooses maximum nearest-enemy distance, not our safety score.
  points.sort((a, b) => Math.min(...context.enemies.map(e => arenaDistance(e, b)))
    - Math.min(...context.enemies.map(e => arenaDistance(e, a))));
  const point = points[0];
  if (!point || safety(context, unit, point) < safety(context, unit, unit) + MIN_SAFETY_GAIN) return null;
  if (walking) {

    // A clear sampled straight route is sufficient, not necessary. Never call the
    // movement optimizer here: it can update hysteresis and navigation state.
    const movement = context.scene.movement;
    const blockers = [...movement.getLivingCombatUnits(), ...movement.getFallenPartyUnits()]
      .filter(other => other !== unit).map(other => ({ other,
        clearance: other.alive ? Math.min(movement.getRequiredUnitSpacing(unit, other), movement.config.normal)
          : movement.getRequiredUnitSpacing(unit, other), startDistance: arenaDistance(unit, other) }));
    const count = Math.max(1, Math.ceil(arenaDistance(unit, point) / 12));
    for (let i = 1; i <= count; i++) {
      const x = unit.arenaX + (point.x - unit.arenaX) * i / count;
      const y = unit.arenaY + (point.y - unit.arenaY) * i / count;
      if (context.scene.terrain?.isUnitBlocked(unit, x, y, 12)) return null;

      // Living units have steering clearance; fallen allies remain hard route obstacles
      // in the current movement model. An existing overlap may be exited, not deepened.
      if (blockers.some(({ other, clearance, startDistance }) =>
        arenaDistance(other, { x, y }) < Math.min(clearance, startDistance) - .001)) return null;
    }
  }
  return point;
}

function escapePrevention(context, ally, point, danger, start, walking = false) {
  const travel = walking ? arenaDistance(ally, point) / Math.max(1, ally.moveSpeed) * 1000 : 0;
  return danger.threats.filter(hit => hit.remaining >= start + travel && (hit.warning
    ? arenaDistance(point, hit.warning) > hit.warning.radius
    : !hit.skill && arenaDistance(point, hit.enemy) > (hit.enemy.attackRange ?? 100) + 28))
    .reduce((sum, hit) => sum + hit.amount, 0);
}

function rearLanding(context, enemy) {
  if (enemy.isBoss || locked(context, enemy)) return null;
  const { battlefield } = context.scene, { logicalWidth: width, logicalHeight: height } = battlefield;

  // Probe only the outer column from each real resolver corner. Missing an occupied
  // corner is conservative; random side choice and full search stay in resolution.
  for (const right of [false, true]) {
    const x = right ? width * .92 : width * .08;
    let rearY = height - 24;
    while (rearY > height * .5 && !battlefield.containsArenaPoint(x, rearY, 16)) rearY -= 12;
    for (let row = 0; row < 4; row++) {
      const point = { x, y: rearY - 36 - row * 60 };
      if (point.y >= height * .5 && battlefield.containsArenaPoint(x, point.y, 16)
        && arenaDistance(enemy, point) >= 240 && context.system.parent.canTeleport(enemy, point)) return point;
    }
  }
  return null;
}

function engagementCost(context, enemy) {
  const melee = context.allies.filter(ally => ['Tank', 'Melee DPS'].includes(ally.role)
    && context.scene.isWithinAttackReach(ally, enemy));
  const ordered = context.scene.focusTargetId === enemy.id
    || [...context.scene.attackTargets.values()].includes(enemy.id);
  const victim = context.allies.find(ally => ally.id === enemy.currentTargetId);
  const contained = victim?.role === 'Tank' && context.risk(victim).tier < 2;
  return melee.length * .1 + (ordered ? .15 : 0) + (contained ? .2 : 0);
}

function redundant(ally, ability, time) {
  return ally.status.replacementEffects?.some(effect => effect.key === ability.id + ':beneficial' && effect.until > time)
    || ally.status.replacementReactions?.some(reaction => reaction.kind === ability.handler && reaction.until > time)
    || ['manaBasedShield', 'shieldReflect', 'shieldBurst'].includes(ability.handler)
      && ally.status.temporaryHp > 0 && ally.status.temporaryHpUntil > time;
}

function armorAt(unit, time) {
  return (unit.armor ?? 0) * replacementMultiplier(unit, 'armor', time)
    * (unit.status.armorUntil > time ? unit.status.armorMultiplier : 1);
}

// A conservative post-defense transfer estimate, not a hit roll or future simulation.
function interceptedDamage(unit, hit, ability, time) {
  if (unit.status.immuneUntil > time + hit.remaining) return 0;
  let amount = hit.rawAmount * (1 - ability.secondary.potency);
  if (hit.physical) amount *= 1 - armorReduction(armorAt(unit, time));
  amount *= (unit.damageTakenMultiplier ?? 1) * Math.max(0, replacementMultiplier(unit, 'reduction', time));
  if (!hit.physical) amount *= Math.max(0, replacementMultiplier(unit, 'spellReduction', time));
  if (unit.status.damageReductionUntil > time) amount *= 1 - unit.status.damageReduction;
  if (unit.status.shieldUntil > time) amount *= .35;
  if (unit.status.arcaneShieldUntil > time + hit.remaining) amount *= !hit.physical || hit.enemy.attackRange > 180 ? 0 : .55;
  return Math.max(0, amount);
}

function reviveValue(context, target, ability) {
  const { allies, enemies, risk } = context;
  if (target.alive || target.noReviveThisBattle || target.delvesUsed?.honorSacrifice || !enemies.length) return { benefit: 0, tier: 0 };
  const missingRole = ['Healer', 'Tank'].includes(target.role) && !allies.some(ally => ally.role === target.role);
  const danger = Math.max(0, ...allies.map(ally => risk(ally).tier));
  const remaining = enemies.reduce((sum, enemy) => sum + enemy.hp, 0);
  const partyHit = allies.reduce((sum, ally) => sum + Math.max(ally.attackPower ?? 0, ally.spellPower ?? 0), 0);
  const substantial = remaining > partyHit * 2;
  const crisis = danger >= 2 && (allies.length <= 2 || missingRole);

  // Preserve a scarce DPS revival while a viable party can finish this fight alone.
  // Heavy attrition or a missing essential role permits decisive recovery.
  if (ability.oncePerEncounter && !missingRole && !crisis && !(allies.length <= 2 && substantial)) return { benefit: 0, tier: 0 };
  if (!substantial && !crisis) return { benefit: 0, tier: 0 };
  const health = Math.min(1, ability.primary.potency);
  const mana = target.maxMana > 0 ? Math.min(1, ability.secondary.potency) : 0;
  return { benefit: (health + mana * .25) * (missingRole ? 2 : 1), tier: crisis ? 3 : missingRole ? 2 : 1 };
}

export function interveneRescueValue(context, unit, target, ability, plan) {
  const empty = { benefit: 0, tier: 0 };
  const { allies, time, risk } = context;
  const guard = target.status.replacementIntercept;
  if (guard?.until > time && allies.some(ally => ally.id === guard.ownerId)
    || target.status.interceptUntil > time && target.status.interceptSource?.alive
    || allies.some(ally => ally !== unit && ally.pendingAction?.interceptionTargetId === target.id)) return empty;
  const arrival = ability.windup + plan.travelMs;
  const danger = risk(target, arrival, ability.duration);

  // Basic windups and near-ready basic attacks are trustworthy single-target observations.
  // Unclassified monster skills remain conservative instead of promising an area rescue.
  const hit = danger.threats.filter(hit => !hit.area && !hit.skill && hit.remaining > arrival + 50)
    .sort((a, b) => a.remaining - b.remaining)[0];
  if (!hit) return empty;
  const tier = hit.amount >= danger.health ? 3
    : hit.amount >= target.maxHp * SERIOUS_LOSS || danger.health - hit.amount <= target.maxHp * ENDANGERED_HP ? 2 : 1;
  // Preserve an already committed rescue during its last few steps. The mobility
  // threshold only prevents choosing a routine stationary cast in the first place.
  if (hit.amount < target.maxHp * .08 && tier < 2
    || !plan.committed && plan.distance < 24 && tier < 2) return empty;
  const transfer = interceptedDamage(unit, hit, ability, time), own = risk(unit, 0, hit.remaining);
  if (transfer + own.incoming >= own.health) return empty;
  let benefit = hit.amount / target.maxHp * (target.role === 'Healer' ? 1.3 : 1) - transfer / unit.maxHp;
  if (unit.className === 'Oathwarden') benefit *= 1.25;
  return { benefit: Math.max(0, benefit), tier, attackerId: hit.enemy.id, remaining: hit.remaining };
}

export function tacticalAllyTarget(context, unit, ability) {
  const candidates = ability.handler === 'revive' ? context.scene.partyUnits.filter(ally => !ally.alive)
    : ability.targetLabel === 'Self' ? [unit] : context.allies;
  let best = null, value = null;
  for (const ally of candidates) {
    if (arenaDistance(unit, ally) > ability.range * 100 || ability.targetLabel === 'Single other ally' && ally === unit) continue;
    if (['pairedEscape', 'decoyAllyRescue'].includes(ability.handler)) {
      const criticalInjury = ally.hp / ally.maxHp < .25 && missingHealth(context.scene, ally) > 0;
      const imminentDanger = context.risk(ally, ability.windup, ability.duration).tier >= 2;
      if (ally === unit || !criticalInjury && !imminentDanger) continue;
    }
    const current = evaluateTactical(context, unit, ability, ally);
    if (current.benefit > 0 && (!value || current.tier > value.tier
      || current.tier === value.tier && current.benefit > value.benefit)) { best = ally; value = current; }
  }
  return best;
}

export function evaluateTactical(context, unit, ability, target, damage = 0, damageByEnemy = new Map()) {
  const { system, scene, time, allies, enemies, risk } = context;
  const h = ability.handler, start = ability.windup, duration = ability.duration || HORIZON_MS;
  let benefit = 0, tier = 1, emergencyRelief = false;
  const credit = (ally, prevented, danger = risk(ally, start, duration)) => {
    if (prevented <= 0) return;
    const saved = Math.min(danger.incoming, prevented);
    benefit += saved / ally.maxHp;
    if (danger.tier >= 2 && (saved >= Math.min(danger.incoming, ally.maxHp * SERIOUS_LOSS)
      || danger.incoming >= danger.health && danger.incoming - saved < danger.health)) emergencyRelief = true;
    tier = Math.max(tier, danger.tier);
  };
  if (ability.id === INTERVENE) {
    const plan = intervenePlan(system, unit, target, ability, time, { context });
    if (!plan) return { benefit: 0, tier: 0 };
    if (plan.mode === 'offensive') {
      const ordered = system.commandedEnemy(unit) ?? enemies.find(enemy => enemy.id === scene.focusTargetId);
      if (ordered && ordered !== target || damage <= 0) return { benefit: 0, tier: 0 };
      const own = risk(unit, 0, start + plan.travelMs);
      if (own.incoming >= own.health) return { benefit: 0, tier: 0 };
      const walkingSaved = arenaDistance(unit, plan.point) / Math.max(1, unit.moveSpeed) - plan.travelMs / 1000;
      benefit = damage + Math.min(.3, Math.max(0, walkingSaved) * .08)
        + Math.min(2, plan.coverage) * .025 + Math.min(1, system.rescuePriority(unit, target)) * .08;
      if (unit.className === 'Oathwarden') benefit *= .75;
    } else {
      const value = interveneRescueValue(context, unit, target, ability, plan);
      benefit = value.benefit; tier = value.tier;
    }
  } else if (ability.id === INTERPOSE) {
    const existing = target.status.replacementIntercept;
    if (target === unit || !target.alive || arenaDistance(unit, target) > ability.range * 100
      || existing?.until > time && allies.some(ally => ally.id === existing.ownerId)
      || target.status.interceptUntil > time && target.status.interceptSource?.alive
      || allies.some(ally => ally !== unit && ally.pendingAction?.interceptionTargetId === target.id)) return { benefit: 0, tier: 0 };
    const danger = risk(target, start, duration);
    const hit = danger.threats.filter(hit => hit.pending && !hit.area).sort((a, b) => a.remaining - b.remaining)[0];
    if (!hit) return { benefit: 0, tier: 0 };
    const hitTier = hit.amount >= danger.health ? 3
      : hit.amount >= target.maxHp * SERIOUS_LOSS || danger.health - hit.amount <= target.maxHp * ENDANGERED_HP ? 2 : 1;
    if (hit.amount < target.maxHp * .08 && hitTier < 2) return { benefit: 0, tier: 0 };
    const transferred = interceptedDamage(unit, hit, ability, time);
    const own = risk(unit, 0, hit.remaining);
    if (transferred + own.incoming >= own.health) return { benefit: 0, tier: 0 };
    credit(target, hit.amount, { ...danger, incoming: hit.amount, tier: hitTier });
    benefit -= transferred / unit.maxHp;
    benefit *= 1 - .15 * Math.min(1, arenaDistance(unit, target) / (ability.range * 100));
  } else if (ability.id === HOLD_THE_LINE) {
    const ordered = system.commandedEnemy(unit) ?? enemies.find(enemy => enemy.id === scene.focusTargetId);
    if (scene.manualTargets?.has(unit.id) || ordered && !scene.isWithinAttackReach(unit, ordered)
      || !enemies.some(enemy => arenaDistance(unit, enemy) <= NEAR_DISTANCE)) return { benefit: 0, tier: 0 };
    const engaged = enemies.some(enemy => scene.isWithinAttackReach(unit, enemy));
    const nearby = allies.filter(ally => ally !== unit && arenaDistance(unit, ally) <= PERIMETER_RADIUS);
    const guarding = nearby.some(ally => risk(ally, start, duration).tier >= 2);
    if (!engaged && !guarding) return { benefit: 0, tier: 0 };
    const danger = risk(unit, start, duration), armor = armorAt(unit, time);
    const fraction = (armorReduction(armor * (1 + ability.primary.potency)) - armorReduction(armor))
      / Math.max(.01, 1 - armorReduction(armor));
    credit(unit, danger.threats.filter(hit => hit.physical).reduce((sum, hit) => sum + hit.amount, 0) * fraction, danger);
    for (const ally of nearby) {
      if (!perimeterOwner(scene, ally, time)) credit(ally, risk(ally, start, duration).incoming * PERIMETER_REDUCTION);
    }
    const preferred = scene.getPrimaryTarget(unit, false);
    if (!engaged || preferred && !scene.isWithinAttackReach(unit, preferred)) benefit -= guarding ? .04 : .1;
  } else if (ability.id === VIGILANCE) {
    const danger = risk(unit, start, duration);
    const block = Math.min(.35, Math.max(0, (unit.block ?? 0) + replacementChance(unit, 'block', time)
      + equipmentPerkBonus(unit, 'block') + (unit.status.leaderBlockUntil > time ? unit.status.leaderBlockBonus ?? 0 : 0)));
    const extraBlock = Math.max(0, Math.min(.35 - block, ability.primary.potency));
    const armor = armorReduction(armorAt(unit, time));
    for (const hit of danger.threats.filter(hit => hit.physical)) {
      const reduction = extraBlock * Math.min(armor, 1 - armor) / Math.max(.01, 1 - armor);
      const stun = hit.enemy.controlImmunities?.includes('stun') ? 0 : Math.min(.15, ability.secondaryDuration / 10000) * (block + extraBlock);
      credit(unit, hit.amount * Math.min(1, reduction + stun), danger);
    }
  } else if (h === 'damageTaunt') {
    for (const enemy of system.recipients(unit, target, ability)) {
      if ((damageByEnemy.get(enemy) ?? 0) >= enemy.hp) continue;
      const urgency = system.rescuePriority(unit, enemy);
      if (!urgency || unit.hp / unit.maxHp < .4) continue;
      benefit += urgency * .08;
      for (const ally of allies.filter(ally => ally !== unit)) {
        const danger = risk(ally, start, ability.tauntDuration);
        credit(ally, danger.threats.filter(hit => hit.enemy === enemy).reduce((sum, hit) => sum + hit.amount, 0) * .5, danger);
      }
    }
    return { benefit: benefit + damage, tier };
  } else if (h === 'revive') return reviveValue(context, target, ability);
  else if (TACTICAL_ALLY_HANDLERS.has(h)) {
    const recipients = system.recipients(unit, target, ability, true);
    for (const ally of recipients) {
      if (redundant(ally, ability, time)) continue;
      const danger = risk(ally, start, duration);
      if (!danger.incoming) continue;
      if (h === 'lethalExchange') {
        if (danger.tier === 3) credit(ally, danger.incoming, danger);
      } else if (h === 'conditionalHeal') {
        const after = danger.health - danger.incoming;
        if (after > 0 && after < ally.maxHp * .25) credit(ally, replacementAmount(unit, ally, ability.primary), danger);
      } else if (['manaBasedShield', 'shieldReflect', 'shieldBurst'].includes(h)) {
        credit(ally, replacementAmount(unit, ally, ability.primary), danger);
      } else {
        const eligible = danger.threats.filter(hit => h === 'spellReduction' ? !hit.physical : h === 'partyReduction' || hit.physical);
        let fraction = ability.primary.potency;
        if (['armor', 'allyArmor', 'partyArmor'].includes(h)) {
          const armor = (ally.armor ?? 0) * replacementMultiplier(ally, 'armor', time)
            * (ally.status.armorUntil > time ? ally.status.armorMultiplier : 1);
          fraction = (armorReduction(armor * (1 + fraction)) - armorReduction(armor)) / Math.max(.01, 1 - armorReduction(armor));
        }
        credit(ally, eligible.reduce((sum, hit) => sum + hit.amount, 0) * fraction, danger);
      }
    }
  } else if (h === 'damageEscapeTeleport') {
    const danger = risk(unit, start);
    const landing = danger.tier >= 2 && escapeLanding(context, unit);
    if (landing) credit(unit, escapePrevention(context, unit, landing, danger, start), danger);
    // Damage must independently justify spending the escape if no meaningful rescue exists.
    return { benefit: benefit + damage, tier, extraordinary: benefit <= 0, reserve: true };
  } else if (h === 'damageEnemyTeleport') {
    let disruption = 0;
    for (const enemy of system.recipients(unit, target, ability)) {
      const landing = rearLanding(context, enemy);
      const expectedDamage = damageByEnemy.get(enemy) ?? 0;
      if (!landing || expectedDamage <= 0 || expectedDamage >= enemy.hp) continue;
      disruption += engagementCost(context, enemy);
      if (enemy.controlImmunities?.includes('root') || enemy.basicAttackDamageType === 'spell') continue;
      for (const ally of allies) {
        const danger = risk(ally, start, ability.secondaryDuration);
        if (arenaDistance(landing, ally) <= (enemy.attackRange ?? 100) + 28) continue;

        // Relocation does not cancel a pending cast or its captured warning center.
        const prevented = danger.threats.filter(hit => hit.enemy === enemy && !hit.area && !hit.skill
          && (!hit.pending || arenaDistance(enemy, ally) <= enemy.attackRange)).reduce((sum, hit) => sum + hit.amount, 0);
        credit(ally, prevented, danger);
      }
    }
    return { benefit: benefit + damage - disruption, tier, extraordinary: benefit <= disruption, reserve: true };
  } else if (h === 'arenaRepositionTruce') {
    if (allies.some(ally => scene.manualTargets?.has(ally.id))) return { benefit: 0, tier: 0 };
    let actionable = false, disruption = 0;
    for (const enemy of enemies) {
      if (enemy.isBoss || locked(context, enemy) || enemy.status.replacementTruceUntil > time) continue;
      for (const ally of allies) {
        const danger = risk(ally, start, duration);
        const prevented = danger.threats.filter(hit => hit.enemy === enemy).reduce((sum, hit) => sum + hit.amount, 0);
        if (prevented > 0) actionable = true;
        credit(ally, prevented, danger);
      }
      disruption += engagementCost(context, enemy);
    }
    for (const ally of allies) if (!locked(context, ally) && ['Tank', 'Melee DPS'].includes(ally.role)) disruption += .1;
    if (!actionable || !emergencyRelief) return { benefit: 0, tier: 0 };
    benefit -= disruption;
  } else if (['decoyThreat', 'decoyAllyRescue', 'pairedEscape', 'escapeMovementBuff'].includes(h)) {
    if (h === 'pairedEscape' && scene.manualTargets?.has(target.id)) return { benefit: 0, tier: 0 };
    const recipients = h === 'pairedEscape' ? [unit, target] : [h === 'decoyAllyRescue' ? target : unit];
    for (const ally of recipients) {
      const danger = risk(ally, start, duration);
      if (!danger.incoming || h !== 'decoyThreat' && locked(context, ally)) continue;
      if (h === 'decoyThreat') {
        if (!system.parent.escapePoint(unit, 6)) continue;
        credit(ally, Math.min(replacementAmount(unit, ally, ability.primary), danger.threats
          .filter(hit => !hit.enemy.isBoss && !hit.pending && hit.enemy.currentTargetId === ally.id)
          .reduce((sum, hit) => sum + hit.amount, 0)), danger);
      } else if (h === 'decoyAllyRescue') {
        const point = system.parent.adjacentPoint(ally, unit);
        if (point && safety(context, ally, point) >= safety(context, ally, ally)) {
          if (safety(context, ally, point) >= safety(context, ally, ally) + MIN_SAFETY_GAIN) {
            credit(ally, escapePrevention(context, ally, point, danger, start), danger);
          }
          benefit += Math.min(missingHealth(scene, ally), replacementAmount(unit, ally, ability.secondary)) / ally.maxHp;
          tier = Math.max(tier, danger.tier);
        }
      } else {
        const point = escapeLanding(context, ally, true);
        if (point) credit(ally, escapePrevention(context, ally, point, danger, start, true), danger);
      }
    }
  } else {
    const kind = { areaStun: 'stun', conditionalStun: 'stun', areaRoot: 'root', disarm: 'disarm', abilityLock: 'abilityLock' }[h];
    const taunt = ['taunt', 'tauntReduction', 'damageDebuffTaunt'].includes(h);
    for (const enemy of system.recipients(unit, target, ability)) {
      const canTaunt = taunt && system.canTaunt(enemy);
      if (ability.threatPulseInterval && !system.rescuePriority(unit, enemy)) continue;
      if (kind && enemy.controlImmunities?.includes(kind)) continue;
      const status = { stun: 'stunnedUntil', root: 'rootedUntil', disarm: 'replacementDisarmUntil', abilityLock: 'spellLockUntil' }[kind];
      if (status && enemy.status[status] > time + start) continue;
      if (enemy.hp <= unit.attackPower && !enemy.pendingAction) continue;
      for (const ally of allies) {
        const danger = risk(ally, start, duration);
        const threats = danger.threats.filter(hit => hit.enemy === enemy && (kind === 'stun'
          || kind === 'root' && hit.pursuing && hit.physical
          || kind === 'disarm' && !hit.pending && hit.physical
          || kind === 'abilityLock' && !hit.pending && Object.entries(enemy.abilities ?? {})
            .some(([key, a]) => a.effect !== 'heal' && enemy.abilityReady(key, time))
          || canTaunt && (ally !== unit || hit.pending)));
        let prevented = threats.reduce((sum, hit) => sum + hit.amount, 0);
        if (kind === 'abilityLock') prevented *= .25;
        if (taunt && ally !== unit) prevented *= unit.hp / unit.maxHp >= .4 ? .5 : 0;
        credit(ally, prevented, danger);
        if (canTaunt && ally !== unit && threats.length
          && (ability.id === 'ability_v2_gladiator_defiant_roar' || h === 'damageDebuffTaunt')) {
          const urgency = Math.min(2, system.rescuePriority(unit, enemy));
          benefit += .04 * urgency * (ally.role === 'Healer' ? 1.5 : 1);
        }
        if (h === 'damageDebuffTaunt') credit(ally, danger.threats.filter(hit => hit.enemy === enemy)
          .reduce((sum, hit) => sum + hit.amount, 0) * ability.primary.potency, danger);
      }
    }
    if (h === 'tauntReduction') credit(unit, risk(unit, start, duration).incoming * ability.secondary.potency);
    if (ability.threatPulseInterval && !(unit.status.replacementShelter?.until > time + start)) {
      const seconds = ability.threatPulseDuration / 1000;
      const pulseThreat = system.shelterThreat(unit, ability);
      for (const enemy of enemies) {
        const victim = allies.find(ally => ally.id === enemy.currentTargetId);
        if (victim && victim !== unit && victim.role === 'Tank' && victim.hp / victim.maxHp >= .4
          && !system.rescuePriority(unit, enemy)) continue;
        const distance = arenaDistance(unit, enemy);

        // Credit approaching enemies only when their current ally destination is inside
        // Shelter. Resolution still checks the live radius on every individual pulse.
        const arrival = distance <= ability.radius ? 0 : victim && arenaDistance(unit, victim) <= ability.radius
          ? (distance - ability.radius) / Math.max(1, enemy.moveSpeed ?? 0) : Infinity;
        if (arrival >= seconds) continue;
        const table = scene.enemyThreat.get(enemy.id) ?? new Map();
        const own = table.get(unit.id) ?? 0;
        const leader = Math.max(0, ...allies.filter(ally => ally !== unit).map(ally => table.get(ally.id) ?? 0));
        const generated = pulseThreat * Math.floor((seconds - arrival) * 1000 / ability.threatPulseInterval);
        const needed = Math.max(pulseThreat, leader - own + pulseThreat * 2);
        if (own > leader + pulseThreat * 2 && !system.rescuePriority(unit, enemy)) continue;
        benefit += .12 * Math.min(1, generated / needed) * (arrival ? .5 : 1);
      }
    }
  }

  // Long cooldowns carry a modest opportunity cost. Only real emergency benefit
  // passes the extra once-only gate; unsupported handlers never enter this function.
  if ((ability.oncePerEncounter || ability.oncePerWave) && tier < 2) return { benefit: 0, tier: 0 };
  if (tier < 2) benefit -= PRESERVATION_COST * Math.min(2, ability.cooldown / 30000);
  return { benefit: Math.max(0, benefit), tier };
}
