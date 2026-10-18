// Replacement skills share targeting, modifiers, and saved timed records. Every handler
// uses the same combat clock as ordinary attacks, including paused and offline battles.

import GameState from '../game/GameState.js';
import { equippedItem, consumePotionCharge } from '../game/Equipment.js';
import { getPotionDefinition } from '../data/items.js';
import { arenaDistance, ADJACENT_DISTANCE, NEAR_DISTANCE } from '../config/combatRanges.js';
import { incomingPressure, missingHealth, healingUrgency, reserveHealing } from './CombatDecisions.js';
import { replacementAmount, replacementMultiplier, refreshReplacementTiming } from './ReplacementEffects.js';
import { findAbilityEffect } from '../data/abilityEffects.js';
import { rememberBarmaidIntercept } from '../data/barmaidAbilityEffects.js';
import { hasAssaultAbilityEffect } from './AssaultAbilityEffects.js';
import { CLASS_DEFINITIONS } from '../data/classes.js';
import { abilityAllowed, CLASS_RESTRICTED_ABILITIES, rankedReplacementAbility } from '../data/replacementAbilities.js';
import { retireUmbralDecoy } from './UmbralDecoyEffects.js';
import { isRune, runeTarget, resolveRune, tickRune, runesAfterDamage } from './RunedanceSystem.js';
import { basicCandidates, betterAssessment, evaluateAbility } from './AbilityUsefulness.js';
import { preparedAbility } from './PreparationUsefulness.js';
import { createTacticalContext, tacticalAllyTarget, usesTacticalAbility, usesTacticalAllyTarget, evaluateTactical, interveneRescueValue } from './TacticalUsefulness.js';
import { intervenePlan, interveneLocked, interveneSpeed } from './Intervene.js';
import { INTERVENE, canTankTaunt, spreadHitThreat, SECONDARY_THREAT } from './TankMechanics.js';

// A modifier names the actual stat changed. Negative fractions reduce that stat; chance
// fields add percentage points. Recipient choice is handled separately from the modifier.
const PRIMARY_MODIFIERS = {
  armor: 'armor', allyArmor: 'armor', partyArmor: 'armor', armorHeal: 'armor', armorCooldownBuff: 'armor',
  armorSelfRoot: 'armor', healthCostPartyArmor: 'armor', spellReduction: 'spellReduction', partyReduction: 'reduction',
  dodgeBuff: 'dodge', critBuff: 'crit', allyCrit: 'crit', partyAccuracy: 'hit', dodgeNextWindup: 'dodge',
  movementSlow: 'movementSlow', slowDamage: 'movementSlow', movementNextWindup: 'movement', escapeMovementBuff: 'movement',
  speedBuff: 'speed', speedNextWindup: 'speed', damageBoostArmorPenalty: 'damage', attackBuffTaunt: 'attack',
  accuracyDebuff: 'accuracyPenalty', areaAccuracyDebuff: 'accuracyPenalty', accuracyDebuffDamage: 'accuracyPenalty',
  areaOutgoingDebuff: 'outgoingPenalty', attackDebuffDamage: 'attackPenalty', damageDebuffTaunt: 'outgoingPenalty',
  partyHealthCostEnemyDebuff: 'powerPenalty', enemySpeedPartyArmor: 'speedPenalty', mark: 'vulnerability'
};
const SECONDARY_MODIFIERS = {
  damageAttackDebuff: 'attackPenalty', damageOutgoingDebuff: 'outgoingPenalty', damageAccuracyDebuff: 'accuracyPenalty',
  damageArmorDebuff: 'armorPenalty', damageArmorSpellDebuff: 'armorSpellPenalty', damageVulnerability: 'vulnerability',
  damageWindupDebuff: 'windup', damageSpeedBuff: 'speed', healReduction: 'reduction', healthCostHealDamageBuff: 'power',
  enemySpeedPartyArmor: 'armor', armorCooldownBuff: 'cooldown'
};
const SETUPS = new Set(['nextPhysicalBoost', 'nextSpellBoost', 'nextWindupReduction', 'nextCritBonus', 'nextProtectionBoost',
  'nextAssaultPotencyCost', 'nextRestorePotencyCost', 'nextRestorePotencyDuration', 'nextAssaultAccuracyDamage', 'nextAssaultManaReturn', 'duplicateNextAssault']);
const ZONES = new Set(['slowGroundZone', 'slowDamageZone', 'entryStunZone', 'poisonTrap', 'healingAura']);
const SHIELDS = new Set(['manaBasedShield', 'shieldReflect', 'shieldBurst']);
const PERIODIC_PRIMARY = new Set(['damageOverTime', 'healingOverTime', 'healthCostHealingOverTime', 'partyManaOverTime']);
const REFILLS = new Set(['restoreCharges', 'restoreChargesNextBoost', 'partyRestoreCharges']);
const REACTIONS = new Set(['conditionalHeal', 'blockStun', 'counterattackWindow', 'reactiveSiphon', 'reflectLinkedHeal', 'criticalPotionReaction', 'lethalExchange', 'damageActionPunishment']);
const OFFENSIVE_ALLY_HEALS = new Set(['areaDamageLowestHeal', 'damageNearestHeal', 'areaDamageLinkedHeal', 'allDamagePartyLinkedHeal']);

export default class ReplacementAbilitySystem {
  constructor(parent) {
    this.parent = parent;
    this.scene = parent.scene;
    this.reactionDepth = 0;
    this.zoneViews = new Map();
    this.scene.events?.once?.('shutdown', () => {
      for (const view of this.zoneViews.values()) view.destroy();
      this.zoneViews.clear();
      this.clearShelters();
    });
  }

  // Unit IDs reconnect naturally after restore. Decoys are separate from the party so
  // they cannot earn XP, receive party healing, or occupy an adventurer slot.
  units() { return [...this.scene.partyUnits, ...this.scene.enemies, ...(this.scene.abilityDecoys ?? [])]; }
  unit(id) { return this.units().find(unit => unit.id === id); }
  allies() { return this.scene.partyUnits.filter(unit => unit.alive); }
  enemies() { return this.scene.getLivingEnemies(); }
  now() { return this.scene.time.now; }

  clearShelters() {
    for (const unit of this.scene.partyUnits ?? []) delete unit.status.replacementShelter;
  }

  canTaunt(enemy) {
    return canTankTaunt(enemy);
  }

  // Feed a nearby productive Roar cluster into ordinary tank pursuit. No movement
  // state, route controller or destination survives this read-only target choice.
  roarPursuitTarget(unit, time) {
    const ability = Object.entries(unit.abilities).find(([key, ability]) => ability.id === 'ability_v2_gladiator_defiant_roar'
      && unit.abilityReady(key, time) && this.usable(unit, ability, time))?.[1];
    if (!ability || this.scene.isPositionLocked(unit) || this.scene.manualTargets?.has(unit.id)) return null;
    const threats = this.enemies().filter(enemy => this.canTaunt(enemy) && this.allies().some(ally => ally !== unit
      && enemy.currentTargetId === ally.id && (!enemy.pendingAction?.healingReservations)
      && (enemy.pendingAction || arenaDistance(enemy, ally) <= (enemy.attackRange ?? 100) + 90)));
    if (threats.filter(enemy => arenaDistance(unit, enemy) <= ability.radius).length >= 2) return null;
    const candidates = threats.filter(enemy => arenaDistance(unit, enemy) <= ability.radius + NEAR_DISTANCE);
    const count = enemy => threats.filter(other => arenaDistance(enemy, other) <= ability.radius).length;
    const ranked = candidates.filter(enemy => count(enemy) >= 2).sort((a, b) => count(b) - count(a)
      || arenaDistance(unit, a) - arenaDistance(unit, b));
    const best = ranked[0], previous = ranked.find(enemy => enemy.id === unit.autoTargetId);
    return best && previous && count(previous) === count(best)
      && arenaDistance(unit, previous) <= arenaDistance(unit, best) + 80 ? previous : best ?? null;
  }

  // Read both live targeting and accumulated threat so an expiring taunt cannot hide
  // an ally who will immediately regain aggro. Securely held enemies need no rescue.
  rescuePriority(caster, enemy) {
    if (!this.canTaunt(enemy)) return 0;
    const table = this.scene.enemyThreat.get(enemy.id) ?? new Map();
    const own = table.get(caster.id) ?? 0;
    const threatened = this.allies().filter(ally => ally !== caster && (ally.role !== 'Tank' || ally.hp / ally.maxHp < .4)
      && (enemy.currentTargetId === ally.id
      || enemy.pendingAction?.targetId === ally.id || (table.get(ally.id) ?? 0) > own));
    if (!threatened.length) return 0;
    return Math.max(...threatened.map(ally => (ally.role === 'Tank' ? .5 : 1)
      + 1 - ally.hp / ally.maxHp));
  }

  shelterThreat(caster, ability) {
    return Math.max(1, Math.max(caster.attackPower ?? 0, caster.spellPower ?? caster.spellDamage ?? 0)
      * ability.threatPulsePower * (caster.threatMultiplier ?? 1));
  }

  // Use the shared threat lift and action cancellation with this cast's resolved
  // duration. Filter immunity first, including bosses, before forcing any target.
  dawnwardenTaunt(caster, enemies, ability, time, duration) {
    const affected = this.scene.applyTankTaunt(caster, enemies, ability.id, time, false, { ...ability, duration });
    if (!affected.length) return;
    this.scene.combatLog?.add('taunt', `${caster.name}: ${ability.name} taunts ${affected.length} enemies for ${duration / 1000}s.`, {
      actorId: caster.id, abilityId: ability.id, targetIds: affected.map(enemy => enemy.id), durationMs: duration
    });
  }

  // Refresh a named effect instead of stacking every cast. The record is plain data and
  // includes a removable flag so cleanse and dispel cannot erase encounter restrictions.
  modifier(target, caster, ability, changes, duration, harmful = false) {
    if (!target?.alive || duration <= 0) return;
    const list = target.status.replacementEffects ??= [];
    const key = `${ability.id}:${harmful ? 'harmful' : 'beneficial'}`;
    const current = list.find(effect => effect.key === key);
    const diagnosticFresh = !current || current.until <= this.now();
    const record = { key, ownerId: caster.id, until: this.now() + duration, changes, harmful, removable: !ability.id.endsWith(':cost') };
    if (current) Object.assign(current, record);
    else list.push(record);
    if (this.scene.combatLog?.diagnostics?.enabled && (diagnosticFresh || duration > 100)) {
      this.scene.combatLog.diagnostics.emit('modifier_applied', { actorId: caster.id, targetId: target.id,
        abilityId: ability.id, ability: ability.name, changes, durationMs: duration, harmful,
        cause: this.scene.combatLog.diagnostics.context });
    }
    refreshReplacementTiming(target, this.now());
  }

  changes(kind, value) {
    const simple = { armor: { armor: value }, spellReduction: { spellReduction: -value }, reduction: { reduction: -value },
      dodge: { dodge: value }, crit: { crit: value }, hit: { hit: value }, movement: { movement: value }, speed: { speed: value },
      movementSlow: { movement: -value }, damage: { damage: value }, attack: { attack: value }, windup: { windup: value },
      accuracyPenalty: { hit: -value }, outgoingPenalty: { damage: -value }, attackPenalty: { attack: -value },
      armorPenalty: { armor: -value }, vulnerability: { vulnerability: value }, cooldown: { cooldown: -value },
      powerPenalty: { attack: -value, spell: -value }, power: { attack: value, spell: value },
      armorSpellPenalty: { armor: -value, spell: -value }, speedPenalty: { speed: -value } };
    return simple[kind] ?? {};
  }

  // Geometry is continuous. A line uses projection onto the caster-to-target direction;
  // a cone uses its angle, not a hidden tile or a snapped destination.
  recipients(caster, target, ability, allies = false) {
    if (ability.replacementOrigin) caster = { ...caster, ...ability.replacementOrigin };
    const candidates = allies ? this.allies() : this.enemies();
    if (ability.handler === 'damageTaunt') {
      if (!candidates.includes(target)) return [];

      // Snapshot around the primary only, before any damage can kill or displace it.
      const adjacent = candidates.filter(enemy => enemy !== target && arenaDistance(enemy, target) <= ADJACENT_DISTANCE);
      adjacent.sort((a, b) => this.rescuePriority(caster, b) - this.rescuePriority(caster, a)
        || arenaDistance(a, target) - arenaDistance(b, target) || String(a.id).localeCompare(String(b.id)));
      return [target, ...adjacent].slice(0, ability.maxTargets);
    }
    const center = ability.anchor === 'Caster' ? caster : target;
    let result;
    if (ability.shape === 'Circle') result = candidates.filter(unit => arenaDistance(unit, center) <= ability.radius);
    else if (ability.shape === 'Line' || ability.shape === 'Cone') {
      const dx = target.arenaX - caster.arenaX, dy = target.arenaY - caster.arenaY;
      const length = Math.hypot(dx, dy) || 1;
      result = candidates.filter(unit => {
        const ux = unit.arenaX - caster.arenaX, uy = unit.arenaY - caster.arenaY;
        const along = (ux * dx + uy * dy) / length;
        if (ability.shape === 'Line') return along >= 0 && along <= ability.range * 100 && Math.abs(ux * dy - uy * dx) / length <= ability.width / 2;
        return Math.hypot(ux, uy) <= ability.radius && along / Math.max(1, Math.hypot(ux, uy)) >= Math.cos(ability.width * Math.PI / 360);
      });
    } else if (ability.targetLabel === 'Allies' || ability.targetLabel === 'Enemies' && ability.maxTargets === 'All') result = candidates;
    else result = [target];
    return result.filter(unit => unit?.alive).slice(0, ability.maxTargets === 'All' ? Infinity : ability.maxTargets);
  }

  // Entry pack identity remains in the battle save even when permanent inventory removes
  // an empty pack. Temporary charges cannot be sold, carried home, or exceed capacity.
  initializePotion(unit) {
    if (unit.isEnemy || unit.isDecoy || unit.replacementPotion !== undefined) return;
    const hero = GameState.roster.find(hero => hero.id === unit.id);
    const item = hero && equippedItem(hero, 'potion', GameState);
    const definition = getPotionDefinition(item?.itemId);
    unit.replacementPotion = definition ? { id: item.id, itemId: item.itemId, capacity: definition.uses, temporary: 0 } : null;
  }

  potion(unit, initialize = true) {
    if (initialize) this.initializePotion(unit);
    const saved = unit.replacementPotion;
    if (!saved) return null;
    const item = GameState.inventory.equipment.find(item => item.id === saved.id);
    const definition = getPotionDefinition(saved.itemId);
    return { saved, definition, item: { ...(item ?? { itemId: saved.itemId }), charges: (item?.charges ?? 0) + saved.temporary } };
  }

  consumePotion(unit) {
    const pack = this.potion(unit);
    if (!pack?.item.charges) return false;
    const free = unit.status.replacementFreeItem;
    if (free?.until > this.now()) { unit.status.replacementFreeItem = null; return true; }
    if (pack.saved.temporary > 0) { pack.saved.temporary--; return true; }
    return consumePotionCharge(unit.id, GameState);
  }

  refill(unit, fraction) {
    const pack = this.potion(unit);
    if (!pack) return;
    const added = Math.min(pack.saved.capacity - pack.item.charges, Math.max(1, Math.round(pack.saved.capacity * fraction)));
    pack.saved.temporary += Math.max(0, added);
  }

  // Setup records apply to one committed action and are saved with the unit. Health
  // costs are paid directly, without triggering damage reactions or bypassing safety.
  affordable(unit, ability) {
    const payers = ability.healthPayer === 'Every living ally' ? this.allies() : [unit];
    return !ability.healthFraction || payers.every(payer => payer.hp / payer.maxHp >= 0.25
      && payer.hp > Math.max(1, Math.round(payer.hp * ability.healthFraction)));
  }

  // A prepared Mana discount is checked before offering the action. It is still paid
  // once at commitment, so a character can use a discounted spell they could not afford
  // at its full cost without creating or refunding an extra cast.
  manaCost(unit, ability, time) {
    let cost = ability.manaCost ?? 0;
    for (const prep of unit.status.replacementPreparations ?? []) {
      if (prep.until > time && ['nextRestorePotencyCost', 'nextAssaultPotencyCost'].includes(prep.ability.handler)
        && this.preparationMatches(prep.ability.handler, ability)) cost *= 1 - prep.ability.secondary.potency;
    }
    return Math.max(0, Math.round(cost));
  }

  usable(unit, ability, time) {
    if (CLASS_RESTRICTED_ABILITIES[ability.id] && !abilityAllowed(unit.className, ability)) return false;
    const used = unit.delvesUsed ?? {};
    if (!this.affordable(unit, ability)) return false;
    if (ability.oncePerEncounter && used[ability.id] !== undefined) return false;
    if (ability.oncePerWave && used[ability.id] === this.scene.currentWaveIndex) return false;
    return !unit.status.replacementChannel || unit.status.replacementChannel.until <= time;
  }

  // Match the resolver's beneficiaries, including proximity and single-ally selection.
  offensiveHealingRecipients(caster, target, ability) {
    const allies = this.allies(), handler = ability.handler;
    if (handler === 'allDamagePartyLinkedHeal') return allies;
    if (handler === 'areaDamageLinkedHeal') return allies.filter(ally => arenaDistance(ally, target) <= 200);
    if (handler === 'areaDamageLowestHeal' || handler === 'damageNearestHeal') {
      return allies.filter(ally => ally.hp < ally.maxHp).sort((a, b) => handler === 'damageNearestHeal'
        ? arenaDistance(a, target) - arenaDistance(b, target) : a.hp / a.maxHp - b.hp / b.maxHp).slice(0, 1);
    }
    return [];
  }

  // Self-lifesteal cannot stand in for treating another party member.
  allowsHealerOffense(unit, target, ability) {
    if (unit.role !== 'Healer' || ability.category !== 'Assault'
      || !this.allies().some(ally => ally.hp / ally.maxHp < .8)) return true;
    return ability.secondary.potency > 0 && this.offensiveHealingRecipients(unit, target, ability)
      .some(ally => ally !== unit && missingHealth(this.scene, ally) > 0);
  }

  interveneTarget(unit, ability, context) {
    const ordered = this.commandedEnemy(unit) ?? this.enemies().find(enemy => enemy.id === this.scene.focusTargetId);
    const enemies = ordered ? [ordered] : this.enemies().slice().sort((a, b) => arenaDistance(unit, a) - arenaDistance(unit, b)).slice(0, 8);
    const candidates = [...this.allies().filter(ally => ally !== unit), ...enemies];
    let best = null, value = null;
    for (const target of candidates) {
      const current = evaluateAbility(this, unit, ability, target, this.now(), context);
      if (betterAssessment(current, value)) { best = target; value = current; }
    }
    return best;
  }

  target(unit, ability, context = null, demand = null) {
    if (ability.handler === 'intervene') return this.interveneTarget(unit, ability, context ?? createTacticalContext(this, this.now()));
    if (isRune(ability)) return runeTarget(this, unit, ability);
    const enemies = this.enemies(), allies = this.allies();
    if (!enemies.length) return null;
    const inRange = other => arenaDistance(unit, other) <= ability.range * 100;
    const injured = allies.filter(inRange).filter(ally => {
      const missing = missingHealth(this.scene, ally) + (demand?.get(ally) ?? 0);
      const power = replacementAmount(unit, ally, ability.primary);
      return missing > 0 && (ally.hp / ally.maxHp < .4 || missing >= Math.min(power * .35, ally.maxHp * .15));
    })
      .sort((a, b) => healingUrgency(this.scene, b) - healingUrgency(this.scene, a));
    const threatened = allies.filter(inRange).sort((a, b) => incomingPressure(this.scene, b) - incomingPressure(this.scene, a));
    const handler = ability.handler;
    const healingPriority = unit.role === 'Healer' ? this.scene.getHealerPriorityTarget?.(unit, false) : null;
    const priorityIndex = injured.indexOf(healingPriority);
    if (priorityIndex >= 0) injured.unshift(...injured.splice(priorityIndex, 1));
    if (['remainingCooldownReduction', 'partyCooldownReduction', 'partyOneCooldownReduction'].includes(handler)
      && !(handler === 'remainingCooldownReduction' ? [unit] : allies).some(ally => this.runningCooldowns(ally, null, handler === 'partyOneCooldownReduction').length)) return null;
    if (unit.role === 'Healer' && allies.some(ally => ally.hp / ally.maxHp < .8) && ability.category === 'Assault'
      && !OFFENSIVE_ALLY_HEALS.has(handler)) return null;
    if (handler === 'stealthStrike' && !unit.stealthed) return null;
    if (handler === 'stealth' && unit.stealthed) return null;
    if (handler === 'revive') return tacticalAllyTarget(context ?? createTacticalContext(this, this.now()), unit, ability);
    if (handler === 'reactiveSiphon' && !this.trainedSkill(unit, 'Siphon')) return null;
    if (handler === 'manaDrain' && !enemies.some(enemy => enemy.mana > 0 && inRange(enemy))) return null;
    if (handler === 'channelNextSpellMana' && (unit.mana / unit.maxMana > .6 || incomingPressure(this.scene, unit) > .5)) return null;
    if (REFILLS.has(handler) && !(handler === 'partyRestoreCharges' ? allies : [unit]).some(ally => {
      const pack = this.potion(ally, false); return pack && pack.item.charges < pack.saved.capacity;
    })) return null;
    if (handler === 'freeItemUse' && !this.potion(unit, false)?.item.charges) return null;
    if (handler === 'freeItemUse' && unit.status.replacementFreeItem?.until > this.now()) return null;
    if (handler === 'criticalPotionReaction' && this.potion(unit, false)?.definition.effect.resource !== 'hp') return null;
    if (handler === 'restoreMana' || handler === 'healthToMana') { if (unit.mana / unit.maxMana > .7) return null; }
    if (handler === 'pairedEscape' || handler === 'decoyAllyRescue') {
      return tacticalAllyTarget(context ?? createTacticalContext(this, this.now()), unit, ability);
    }
    if (handler === 'escapeMovementBuff') {
      const danger = (context ?? createTacticalContext(this, this.now())).risk(unit, ability.windup, ability.duration);
      if (this.scene.isPositionLocked(unit) || unit.hp / unit.maxHp >= .25 && danger.tier < 2) return null;
    }
    if (handler === 'enemyForcedAttack' && enemies.filter(enemy => !enemy.isBoss).length < 2) return null;
    const preparations = unit.status.replacementPreparations ?? [];
    if (SETUPS.has(handler) && preparations.some(prep => prep.ability.id === ability.id && prep.until > this.now())) return null;
    if (unit.status.replacementEffects?.some(effect => effect.key.startsWith(ability.id + ':') && effect.until > this.now())) return null;
    if (ZONES.has(handler) && unit.status.replacementZones?.some(zone => zone.ability.id === ability.id && zone.until > this.now() && zone.wave === this.scene.currentWaveIndex)) return null;
    if (REACTIONS.has(handler) && this.units().some(other => other.status.replacementReactions?.some(reaction => reaction.ability.id === ability.id && reaction.ownerId === unit.id && reaction.until > this.now()))) return null;

    // Protection can be useful before injury. Rank actual threatened beneficiaries,
    // retaining range, active-effect guards and the resolver's self/party geometry.
    if (usesTacticalAllyTarget(ability)) {
      return tacticalAllyTarget(context ?? createTacticalContext(this, this.now()), unit, ability);
    }

    // Party Mana recovery uses the existing below-70% policy independently of injury.
    // Mixed recovery keeps the useful healing target first, including healer orders.
    if (handler === 'partyManaOverTime' || handler === 'partyHealMana') {
      const effect = handler === 'partyManaOverTime' ? ability.primary : ability.secondary;
      const manaTarget = this.recipients(unit, unit, ability, true).find(ally => inRange(ally)
        && ally.maxMana > 0 && ally.mana / ally.maxMana < .7 && replacementAmount(unit, ally, effect) > 0);
      return (handler === 'partyHealMana' ? injured[0] : null) ?? manaTarget ?? null;
    }
    if (ability.targetLabel === 'Self') {
      if (SHIELDS.has(handler) && (incomingPressure(this.scene, unit) < .5
        || unit.status.temporaryHp > 0 && unit.status.temporaryHpUntil > this.now())) return null;
      if (ability.category === 'Restore' && (ability.primary.healing || ability.primary.basis === 'Caster Spell Healing') && unit.hp / unit.maxHp > .8 && !demand?.get(unit)) return null;
      return unit;
    }
    if (ability.targetLabel === 'Ground position') {
      const near = enemies.filter(inRange)[0];
      return near ? { arenaX: near.arenaX, arenaY: near.arenaY, alive: true } : null;
    }
    if (ability.targetLabel === 'All combatants') return unit;
    const friendly = ability.targetLabel.includes('ally') || ability.targetLabel === 'Allies';
    if (friendly) {
      if (ability.anchor === 'Caster') return ability.category === 'Restore' && !allies.some(ally => ally.hp / ally.maxHp < .85 || demand?.get(ally) > 0) ? null : unit;
      let list = ability.category === 'Restore' ? injured : threatened;
      if (handler === 'cleanse' || handler === 'cleanseSlowResistance') list = allies.filter(inRange).filter(ally => this.hasRemovableHarm(ally));
      if (SHIELDS.has(handler)) list = list.filter(ally => !(ally.status.temporaryHp > 0 && ally.status.temporaryHpUntil > this.now()));
      list = list.filter(ally => !ally.status.replacementEffects?.some(effect => effect.key === ability.id + ':beneficial' && effect.until > this.now()));
      const chosen = list.find(ally => ability.targetLabel !== 'Single other ally' || ally !== unit);
      if (ability.category === 'Protect' && (!chosen || incomingPressure(this.scene, chosen) < .5)) return null;
      return chosen;
    }

    // Pan Drop uses the Barmaid's current position. Save it until a nearby enemy
    // can actually be stunned, rather than spending its cooldown across the arena.
    if (handler === 'areaStun') return this.recipients(unit, unit, ability).some(enemy =>
      !enemy.controlImmunities?.includes('stun') && !(enemy.status.stunnedUntil > this.now())) ? unit : null;
    if (ability.range === 0) return this.allowsHealerOffense(unit, unit, ability) ? unit : null;
    const preferred = this.scene.getPrimaryTarget(unit, false);
    const eligible = this.enemyCandidates(unit, ability);
    if (SECONDARY_THREAT[ability.id]) {
      const ordered = this.commandedEnemy(unit) ?? enemies.find(enemy => enemy.id === this.scene.focusTargetId);
      if (ordered) return eligible.includes(ordered) ? ordered : null;
    }
    if (handler === 'damageDebuffTaunt') {
      const ordered = this.commandedEnemy(unit) ?? enemies.find(enemy => enemy.id === this.scene.focusTargetId);
      if (ordered) return eligible.includes(ordered) ? ordered : null;
      const tactical = context ?? createTacticalContext(this, this.now());
      const values = new Map(eligible.map(enemy => [enemy, evaluateTactical(tactical, unit, ability, enemy)]));
      return eligible.sort((a, b) => values.get(b).tier - values.get(a).tier
        || values.get(b).benefit - values.get(a).benefit || arenaDistance(unit, a) - arenaDistance(unit, b))[0];
    }
    if (handler === 'damageTaunt') {
      const ordered = this.commandedEnemy(unit);
      if (eligible.includes(ordered)) return ordered;
      const score = enemy => this.recipients(unit, enemy, ability)
        .reduce((sum, other) => sum + this.rescuePriority(unit, other) * 2 + 1, 0);
      return eligible.sort((a, b) => score(b) - score(a)
        || Number(b === preferred) - Number(a === preferred)
        || arenaDistance(unit, a) - arenaDistance(unit, b) || String(a.id).localeCompare(String(b.id)))[0];
    }
    const chosen = eligible.includes(preferred) ? preferred : eligible[0];
    if (handler === 'rearStrike' && chosen && !this.isBehind(unit, chosen)) return null;
    return chosen;
  }

  enemyCandidates(unit, ability) {
    const handler = ability.handler;
    let eligible = this.enemies().filter(enemy => arenaDistance(unit, enemy) <= ability.range * 100);
    if (handler === 'conditionalStun' || handler === 'damageDebuffTaunt') eligible = eligible.filter(enemy => enemy.currentTargetId && enemy.currentTargetId !== unit.id);
    if (handler === 'manaDrain') eligible = eligible.filter(enemy => enemy.mana > 0);
    if (handler === 'enemyForcedAttack') eligible = eligible.filter(enemy => !enemy.isBoss);
    if (handler === 'disarm') eligible = eligible.filter(enemy => enemy.basicAttackDamageType !== 'spell');
    if (handler === 'dispel') eligible = eligible.filter(enemy => enemy.status.replacementEffects?.some(effect => !effect.harmful && effect.removable && effect.until > this.now()));
    eligible = eligible.filter(enemy => this.allowsHealerOffense(unit, enemy, ability));
    return eligible;
  }

  // Explicit Attack wins over live Focus. Reading orders never clears or remembers
  // them; the scene continues to own command expiry and target lifecycle.
  commandedEnemy(unit) {
    const enemies = this.enemies();
    return enemies.find(enemy => enemy.id === this.scene.attackTargets.get(unit.id))
      ?? (this.now() < (this.scene.focusDamageUntil ?? 0)
        ? enemies.find(enemy => enemy.id === this.scene.focusTargetId) : null);
  }

  // Optimize only within anchors whose real, capped recipient set includes the order.
  // If none can include it, preserve the ordinary legal fallback.
  commandAnchors(unit, candidates, recipients) {
    const ordered = this.commandedEnemy(unit);
    if (!ordered) return candidates;
    const including = candidates.filter(candidate => recipients(candidate).includes(ordered));
    return including.length ? including : candidates;
  }

  // The same read-only query serves previews and the final commitment recheck.
  candidateTarget(unit, ability, context = null, demand = null, previewed = false) {
    if (!previewed && !SETUPS.has(ability.handler)) ability = preparedAbility(this, unit, ability, this.now());
    let target = this.target(unit, ability, context, demand);
    if (!target) return null;
    const aimed = ability.shape === 'Circle' && (ability.anchor === 'Target'
      || ability.anchor === 'Ground position' && ability.targetLabel === 'Ground position')
      || ['Line', 'Cone'].includes(ability.shape);
    if (!isRune(ability) && !usesTacticalAllyTarget(ability) && aimed
      && target !== this.scene.getHealerPriorityTarget?.(unit, false)) {
      let candidates = ability.target === 'ally'
        ? this.allies().filter(other => arenaDistance(unit, other) <= ability.range * 100)
        : this.enemyCandidates(unit, ability);
      if (ability.handler === 'rearStrike') candidates = candidates.filter(other => this.isBehind(unit, other));
      if (ability.target !== 'ally') candidates = this.commandAnchors(unit, candidates,
        other => this.recipients(unit, other, ability));
      target = candidates.sort((a, b) => this.areaScore(unit, b, ability) - this.areaScore(unit, a, ability))[0] ?? target;
    }
    return target;
  }

  // Routine candidates compete with basics up to the existing unsupported boundary.
  // A genuinely urgent tactical action can cross it without assigning unknown skills a score.
  update(unit, time, delta = 0) {
    if (!unit.status) return { kind: 'legacy' };

    // Hold the Line gives up its movement lock once every monster is beyond Near
    // reach, so the tank can resume pursuing them while keeping the armor buff.
    if ((unit.status.replacementCostRootUntil ?? 0) > time
      && !this.enemies().some(enemy => arenaDistance(unit, enemy) <= NEAR_DISTANCE)) {
      unit.status.replacementCostRootUntil = time;
    }

    const escape = unit.status.replacementEscape;
    if (escape?.until > time && !this.scene.isPositionLocked(unit)) {
      unit.moveToward(escape.point.x, escape.point.y, delta, 12);
      return { kind: 'acted' };
    }
    if (!unit.canStartAction(time) || !unit.canCast(time)) return { kind: 'legacy' };
    const choices = Object.entries(unit.abilities).filter(([key, ability]) => ability.replacement
      && unit.abilityReady(key, time) && this.usable(unit, ability, time))
      .sort((a, b) => this.priority(unit, a[1]) - this.priority(unit, b[1]));
    if (!Object.values(unit.abilities).some(ability => ability.replacement)) return { kind: 'legacy' };
    const diagnostic = this.scene.combatLog?.diagnostics;
    const trace = diagnostic?.ai ? { candidates: [], rejected: [] } : null;
    const basics = basicCandidates(this, unit, time);
    let basic = null;
    for (const candidate of basics) if (betterAssessment(candidate.assessment, basic?.assessment)) basic = candidate;
    const context = choices.some(([, ability]) => usesTacticalAbility(ability) || SETUPS.has(ability.handler)
      || isRune(ability)) ? createTacticalContext(this, time) : null;
    let best = null, unsupported = null, emergency = null;
    for (const [key, ability] of choices) {
      if (!unit.abilityReady(key, time) || !this.usable(unit, ability, time)) continue;
      if (unsupported && !usesTacticalAbility(ability) && !isRune(ability)) continue;
      const target = this.candidateTarget(unit, ability, context);
      if (!target) { if (trace && trace.rejected.length < 3) trace.rejected.push({ ability: ability.name, reason: 'no_eligible_target' }); continue; }
      const assessment = evaluateAbility(this, unit, ability, target, time, context, basic?.assessment);
      if (trace) {
        trace.candidates.push({ abilityId: ability.id, ability: ability.name, targetId: target.id ?? null,
          score: assessment?.score ?? null, tier: assessment?.tier ?? null, benefit: assessment?.benefit ?? null,
          scoreAvailability: assessment ? 'existing_evaluator' : 'no comparable score available' });
        trace.candidates.sort((a, b) => (b.tier ?? -1) - (a.tier ?? -1) || (b.score ?? -1) - (a.score ?? -1));
        trace.candidates.length = Math.min(3, trace.candidates.length);
      }
      if (assessment === null) {
        unsupported ??= { key, ability, target };
        continue;
      }
      const candidate = { key, ability, target, assessment };
      if ((usesTacticalAbility(ability) || isRune(ability)) && assessment.tier >= 2
        && betterAssessment(assessment, emergency?.assessment)) emergency = candidate;
      if (!unsupported && betterAssessment(assessment, best?.assessment)) best = candidate;
    }
    let selected = best && betterAssessment(best.assessment, basic?.assessment) ? best
      : best && basic ? null : unsupported;
    if (!unit.stealthed && emergency && betterAssessment(emergency.assessment, basic?.assessment)
      && (!selected?.assessment || betterAssessment(emergency.assessment, selected.assessment))) selected = emergency;
    if (trace) diagnostic.decision(unit, { ...trace, selectedAbility: selected?.ability?.name ?? basic?.kind ?? null,
      score: selected?.assessment?.score ?? basic?.assessment?.score ?? null,
      basicScore: basic?.assessment?.score ?? null,
      selection: selected ? 'ability_selected_before_commit_recheck' : basic ? 'basic_selected' : 'no_useful_action_selected' });
    if (selected) {
      const { key, ability, target } = selected;
      const freshContext = selected.assessment ? createTacticalContext(this, time) : null;
      const current = unit.abilities[key] === ability && unit.abilityReady(key, time) && this.usable(unit, ability, time)
        ? this.candidateTarget(unit, ability, freshContext) : null;
      const sameTarget = current === target || current && !target.id
        && current.arenaX === target.arenaX && current.arenaY === target.arenaY;
      const reassessed = sameTarget && freshContext
        ? evaluateAbility(this, unit, ability, target, time, freshContext, basic?.assessment) : null;
      if (sameTarget && (!selected.assessment || betterAssessment(reassessed, basic?.assessment))
        && this.cast(unit, target, key, time)) {
        this.scene.getPrimaryTarget(unit);
        this.scene.getHealerPriorityTarget?.(unit);
        return { kind: 'acted' };
      }
    }
    return basic ? { kind: 'basic', action: basic } : { kind: 'movement' };
  }

  interveneEvent(unit, target, ability, phase, details = {}) {
    const diagnostic = this.scene.combatLog?.diagnostics;
    if (diagnostic?.enabled && phase === 'committed') {
      const active = diagnostic.state().active[diagnostic.actionId(unit)];
      if (active) Object.assign(active, { mode: ability.interveneMode, destination: ability.interveneTravel.point,
        scheduledCompletionAt: this.now() + ability.windup + this.interveneRemainingMs(unit, ability) });
    }
    diagnostic?.emit('action_phase', { actionId: diagnostic.actionId(unit), actorId: unit.id,
      abilityId: ability.id, targetId: target.id, mode: ability.interveneMode,
      stateAfter: 'intervene_' + phase, position: { x: unit.arenaX, y: unit.arenaY }, ...details });
  }

  interveneRemainingMs(unit, ability) {
    const travel = ability.interveneTravel;
    let from = { x: unit.arenaX, y: unit.arenaY }, distance = 0;
    for (const point of travel.waypoints.slice(travel.routeIndex)) {
      distance += arenaDistance(from, point); from = point;
    }
    return distance / Math.max(1, interveneSpeed(unit, this.now())) * 1000;
  }

  interveneRescue(unit, target, ability, time, travelling = false) {
    const travel = ability.interveneTravel;
    let from = { x: unit.arenaX, y: unit.arenaY }, distance = 0;
    for (const point of travel.waypoints.slice(travel.routeIndex)) {
      distance += arenaDistance(from, point); from = point;
    }
    const value = interveneRescueValue(createTacticalContext(this, time), unit, target,
      travelling ? { ...ability, windup: 0 } : ability,
      { distance, committed: travelling, travelMs: distance / Math.max(1, interveneSpeed(unit, time)) * 1000 });
    return value.benefit > 0;
  }

  refreshInterveneRoute(unit, target, ability, time, launch = false) {
    const travel = ability.interveneTravel, failure = {};
    if (!launch) travel.replans++;
    travel.lastPlanAt = time;
    const plan = intervenePlan(this, unit, target, ability, time, { travelling: true,
      context: createTacticalContext(this, time), origin: travel.origin,
      remainingDistance: ability.range * ADJACENT_DISTANCE - travel.travelled,
      attackerId: travel.attackerId, allowBrace: travel.brace, failure });
    if (!plan) { travel.routeBlocked = failure; return false; }
    Object.assign(travel, { point: plan.point, waypoints: plan.waypoints, routeIndex: 0,
      targetPosition: { x: target.arenaX, y: target.arenaY }, routeBlocked: null });
    const diagnostic = this.scene.combatLog?.diagnostics;
    const active = diagnostic?.enabled && diagnostic.state().active[diagnostic.actionId(unit)];
    if (active) Object.assign(active, { destination: plan.point, waypoints: plan.waypoints,
      scheduledCompletionAt: time + this.interveneRemainingMs(unit, ability) });
    return true;
  }

  // Saved classAbility events advance real distance on the shared combat clock.
  // Refresh the stale windup landing before travel, then permit only four timed replans.
  resolveIntervene(unit, action, target, ability) {
    const scene = this.scene, time = this.now(), travel = ability.interveneTravel;
    if (!travel || !Array.isArray(travel.waypoints) || !Number.isFinite(travel.replans)
      || !abilityAllowed(unit.className, ability)) {
      unit.finishAction('failed', 'state_invalidated', 'Intervene class or travel state is invalid');
      return;
    }
    action.intervene = travel;
    const fail = (reason, explanation, blockage = { reason }) => {
      travel.failure = blockage;
      unit.finishAction('failed', reason, explanation);
    };
    const schedule = () => scene.scheduleBattleEvent(33, scene.actionEvent('classAbility', unit, target, { ability }),
      () => this.parent.resolveCast(unit, action, target, ability));
    if (!scene.isActionCurrent(unit, action, target)) return;
    const mode = this.enemies().includes(target) ? 'offensive' : this.allies().includes(target) ? 'defensive' : null;
    if (target.id !== travel.targetId || mode !== ability.interveneMode)
      return fail('state_invalidated', 'Intervene committed target or side changed', { reason: 'target_invalid' });
    if (interveneLocked(scene, unit, time) || !unit.canCast(time)) {
      const command = scene.isPositionLocked(unit) ? 'hold' : scene.manualTargets?.has(unit.id) ? 'move' : null;
      return fail('movement_cancelled', 'Intervene interrupted by control or a Party Leader movement order',
        { reason: command ? 'command' : 'control_or_displacement', command });
    }
    if (arenaDistance(unit, travel.expected) > 1)
      return fail('movement_cancelled', 'Intervene interrupted by external displacement', { reason: 'external_displacement' });
    if (time > travel.deadline) return fail('target_out_of_range', 'Intervene travel timed out', { reason: 'timeout' });
    if (arenaDistance(travel.origin, target) > ability.range * ADJACENT_DISTANCE)
      return fail('target_out_of_range', 'Intervene target left authored reach', { reason: 'target_movement' });
    if (!travel.launched) {
      travel.launched = true;
      this.refreshInterveneRoute(unit, target, ability, time, true);
    }
    let collision = scene.movement.rushClearanceContext(unit, target);
    const contact = () => mode === 'offensive' ? scene.isWithinAttackReach(unit, target)
      : arenaDistance(unit, target) <= ADJACENT_DISTANCE;
    const landingBlock = scene.movement.rushStandingBlock(unit, travel.point, collision);
    const needsRoute = travel.routeBlocked || landingBlock || arenaDistance(travel.targetPosition, target) > 24
      || travel.routeIndex >= travel.waypoints.length && !contact();
    if (needsRoute && time - travel.lastPlanAt >= 150 && travel.replans < 4) {
      this.refreshInterveneRoute(unit, target, ability, time);
      collision = scene.movement.rushClearanceContext(unit, target);
    }
    if (travel.routeBlocked) {
      if (travel.replans >= 4) return fail('movement_cancelled', 'Intervene has no safe bounded route', travel.routeBlocked);
      travel.lastAt = time;
      schedule();
      return;
    }
    if (mode === 'defensive' && !this.interveneRescue(unit, target, ability, time, true))
      return fail('state_invalidated', 'Intervene no longer has a safe imminent single-target rescue', { reason: 'rescue_invalid' });
    let available = Math.min(ability.range * ADJACENT_DISTANCE - travel.travelled,
      interveneSpeed(unit, time) * Math.max(0, time - travel.lastAt) / 1000);
    travel.lastAt = time;
    while (available > .001 && travel.routeIndex < travel.waypoints.length) {
      const waypoint = travel.waypoints[travel.routeIndex];
      const start = { x: unit.arenaX, y: unit.arenaY }, distance = arenaDistance(start, waypoint);
      if (distance <= .001) { travel.routeIndex++; continue; }
      const step = Math.min(distance, available);
      const point = { x: start.x + (waypoint.x - start.x) * step / distance,
        y: start.y + (waypoint.y - start.y) * step / distance };
      const blockage = scene.movement.rushSegmentBlock(unit, start, point, collision);
      if (blockage) { travel.routeBlocked = blockage; break; }
      unit.spriteVisual?.play('walk', { arenaX: waypoint.x, arenaY: waypoint.y });
      unit.setArenaPosition(point.x, point.y);
      travel.expected = point;
      travel.travelled += step; available -= step;
      if (!travel.begun && travel.travelled > 1) {
        travel.begun = true;
        travel.startedAt = time;
        this.interveneEvent(unit, target, ability, 'movement_started', { origin: travel.origin, destination: travel.point, waypoints: travel.waypoints });
      }
      if (distance - step <= .001) travel.routeIndex++;
    }
    if (travel.routeIndex >= travel.waypoints.length && !travel.routeBlocked) {
      const arrivalBlock = scene.movement.rushStandingBlock(unit, { x: unit.arenaX, y: unit.arenaY }, collision);
      if (!contact() || arrivalBlock) {
        travel.routeBlocked = arrivalBlock ?? { reason: 'target_movement' };
      } else {
        travel.movementFinished = true;
        const brace = !travel.begun;
        this.interveneEvent(unit, target, ability, brace ? 'brace' : 'movement_finished',
          { distance: travel.travelled, travelMs: brace ? 0 : time - travel.startedAt, replans: travel.replans });
        if (mode === 'offensive') {
          unit.spriteVisual?.play('attack', target);
          this.damage(unit, target, replacementAmount(unit, target, ability.primary), ability);
        } else {
          unit.spriteVisual?.play('block', target);
          this.resolve(unit, target, { ...ability, handler: 'intercept' }, time);
          this.interveneEvent(unit, target, ability, 'guard_registered', { reduction: ability.secondary.potency,
            expiresAt: time + ability.duration });
        }
        unit.finishAction('resolved', 'completed', 'Intervene reached its committed target and resolved one mode');
        return;
      }
    }
    if (travel.travelled >= ability.range * ADJACENT_DISTANCE - .001)
      return fail('target_out_of_range', 'Intervene exhausted its travel budget', { reason: 'travel_budget' });
    if (travel.routeBlocked && travel.replans >= 4)
      return fail('movement_cancelled', 'Intervene route remained blocked after limited replanning', travel.routeBlocked);
    schedule();
  }

  // Useful recovery per Mana and windup distinguishes two ready Restore choices.
  // Critical allies favor immediate recovery over starting a slower periodic effect.
  priority(unit, ability) {
    if (unit.stealthed && ability.category === 'Assault') return ability.handler === 'stealthStrike' ? -2000 : -1000;
    const group = ['Restore', 'Protect', 'Prepare', 'Assault'].indexOf(ability.category);
    if (group !== 0) return group * 1000;
    const allies = this.allies().filter(ally => arenaDistance(unit, ally) <= ability.range * 100);
    const useful = Math.max(0, ...allies.map(ally => Math.min(missingHealth(this.scene, ally), replacementAmount(unit, ally, ability.primary))));
    const efficiency = useful / Math.max(1, this.manaCost(unit, ability, this.now())) * 1000 / Math.max(100, ability.windup);
    const delayed = PERIODIC_PRIMARY.has(ability.handler) && allies.some(ally => ally.hp / ally.maxHp < .4);
    return (delayed ? 500 : 0) - Math.min(499, efficiency);
  }

  areaScore(unit, target, ability) {
    return this.recipients(unit, target, ability, ability.target === 'ally').reduce((score, recipient) => score + (ability.target === 'ally' ? missingHealth(this.scene, recipient) : 1), 0);
  }

  cast(unit, target, key, time) {
    const base = unit.abilities[key];
    if (!base || !this.usable(unit, base, time) || !unit.abilityReady(key, time)) return false;
    if (base.handler === 'damageTaunt' && (!this.enemies().includes(target)
      || arenaDistance(unit, target) > base.range * ADJACENT_DISTANCE)) return false;
    if (base.handler === 'manaDrain' && (!this.enemies().includes(target) || target.mana <= 0
      || arenaDistance(unit, target) > base.range * 100)) return false;
    if (base.handler === 'stealthStrike' && !unit.stealthed) return false;
    let ability = { ...base, primary: { ...base.primary }, secondary: { ...base.secondary } };
    if (base.handler === 'intervene') {
      const plan = intervenePlan(this, unit, target, base, time, { context: createTacticalContext(this, time) });
      if (!plan) return false;
      ability.interveneMode = plan.mode;
      ability.interveneTravel = { point: plan.point, waypoints: plan.waypoints, routeIndex: 0,
        mode: plan.mode, origin: { x: unit.arenaX, y: unit.arenaY }, targetPosition: { x: target.arenaX, y: target.arenaY },
        targetId: target.id, attackerId: plan.attackerId, brace: plan.distance < 24,
        expected: { x: unit.arenaX, y: unit.arenaY }, travelled: 0, replans: 0,
        startedAt: time + ability.windup, lastAt: time + ability.windup,
        deadline: time + ability.windup + base.range * ADJACENT_DISTANCE / interveneSpeed(unit, time) * 1000 + 500 };
      if (plan.mode === 'defensive' && !this.interveneRescue(unit, target, ability, time)) return false;
    }
    const preparations = unit.status.replacementPreparations ?? [];
    const ready = preparations.filter(prep => prep.until > time && this.preparationMatches(prep.ability.handler, ability));
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
        if (h === 'nextRestorePotencyCost' || h === 'nextAssaultPotencyCost') ability.manaCost = this.manaCost(unit, base, time);
      }
    }
    const scene = this.scene;
    if (ability.interveneTravel) {
      const travel = ability.interveneTravel;
      travel.deadline -= travel.startedAt - (time + ability.windup);
      travel.startedAt = time + ability.windup;
      travel.lastAt = travel.startedAt;
    }
    if (!unit.startAction(ability.name, time, ability.windup, target, ability)) return false;
    if (ability.id === 'ability_v2_generic_physical_interpose' || ability.interveneMode === 'defensive') unit.pendingAction.interceptionTargetId = target.id;
    if (ability.handler === 'intervene') {
      const travel = ability.interveneTravel;
      unit.pendingAction.intervene = travel;
      unit.pendingAction.duration = travel.deadline - time + 100;
      unit.busyUntil = time + unit.pendingAction.duration;
      this.interveneEvent(unit, target, ability, 'committed', { cooldown: ability.cooldown, destination: travel.point, waypoints: travel.waypoints });
    }

    // Capture the opening bonus on the committed action, including its saved bleed ticks.
    // Interruption spends Stealth too; later casts cannot borrow this action's bonus.
    if (unit.stealthed && ability.handler !== 'stealth') {
      ability.fromStealth = true;
      ability.stealthDamageMultiplier = Object.values(unit.abilities).find(skill => skill.handler === 'stealth')?.stealthDamageMultiplier ?? 1;
      unit.setStealthed(false);
      unit.status.stealthUntil = 0;
    }
    for (const prep of ready) this.scene.combatLog?.diagnostics?.effectEvent('preparation_consumed', prep,
      { actorId: unit.id, consumingActionId: this.scene.combatLog?.diagnostics?.actionId(unit), consumingAbility: ability.name });
    if (this.scene.combatLog?.diagnostics?.enabled) for (const prep of preparations) {
      if (prep.until <= time && !ready.includes(prep)) this.scene.combatLog.diagnostics.effectEvent('preparation_expired', prep, { actorId: unit.id });
    }
    unit.status.replacementPreparations = preparations.filter(prep => !ready.includes(prep) && prep.until > time);
    unit.markAbilityUsed(key, time, ability.manaCost);

    // The rare runeblade empowers one future landed basic attack. Store this with
    // the unit so leaving a paused battle cannot lose or duplicate the empowerment.
    if (unit.equipmentPerks?.some(perk => perk.id === 'runic_refrain')) unit.status.runicRefrainReady = true;
    const payers = ability.healthPayer === 'Every living ally' ? this.allies() : [unit];
    for (const payer of payers) if (ability.healthFraction) {
      const before = payer.hp;
      payer.hp = Math.max(1, payer.hp - Math.round(payer.hp * ability.healthFraction)); payer.updateHealthBar?.();
      this.scene.combatLog?.diagnostics?.emit('resource_change', { actorId: unit.id, targetId: payer.id,
        resource: 'health', delta: payer.hp - before, after: payer.hp,
        sourceActionId: this.scene.combatLog?.diagnostics?.actionId(unit), abilityId: ability.id, reasonCode: 'ability_payment' });
    }
    if (ability.oncePerEncounter || ability.oncePerWave) (unit.delvesUsed ??= {})[ability.id] = scene.currentWaveIndex;
    const animation = unit.id === 'valtheris' && ability.damageType !== 'physical'
      ? 'cast' : ability.category === 'Assault' ? 'attack' : 'block';
    unit.spriteVisual?.play(animation, target);
    scene.announceAbility(unit, ability.name, '#fde68a');
    scene.logActionStart?.(unit, target, ability.name);
    const action = unit.pendingAction;
    this.reserveCommittedHealing(unit, target, ability);
    scene.createAbilityTelegraph?.(unit, target, ability, action);
    const schedule = scene.scheduleBattleEvent?.bind(scene) ?? ((delay, data, fn) => scene.time.delayedCall(delay, fn));
    schedule(ability.windup, scene.actionEvent?.('classAbility', unit, target, { ability }), () => this.parent.resolveCast(unit, action, target, ability));
    this.actionCommitted(unit);
    return true;
  }

  // Reserve only Health that the cast actually commits, never Mana or a future reaction.
  // Ordinary HoTs retain their committed primary total; secondary HoTs are not upfront healing.
  reserveCommittedHealing(unit, target, ability) {
    const handler = ability.handler;
    if (REACTIONS.has(handler) || ZONES.has(handler) || isRune(ability) || SHIELDS.has(handler)) return;
    const secondaryHeal = handler === 'armorHeal' || handler === 'allyAreaBlindHeal';
    const effect = secondaryHeal ? ability.secondary : ability.primary;
    if (!secondaryHeal && (PRIMARY_MODIFIERS[handler] || effect.unit !== '% of power basis'
      || !(effect.healing || effect.basis === 'Caster Spell Healing'))) return;
    const targets = (handler === 'allyAreaBlindHeal' ? [target] : this.recipients(unit, target, ability, true))
      .filter(ally => ally?.alive && !ally.isEnemy && !ally.isDecoy && missingHealth(this.scene, ally) > 0);
    if (targets.length) reserveHealing(unit, targets, ally =>
      Math.min(missingHealth(this.scene, ally), replacementAmount(unit, ally, effect)));
  }

  preparationMatches(handler, ability) {
    // The displayed Protect category must not spend protection setups on an enemy hit.
    if (ability.handler === 'intervene') return handler === 'nextWindupReduction'
      || handler === 'nextCritBonus' && ability.interveneMode === 'offensive';
    if (handler.includes('Restore')) return ability.category === 'Restore';
    if (handler === 'nextProtectionBoost') return ability.category === 'Protect';
    if (handler === 'nextPhysicalBoost' || handler === 'nextCritBonus') return ability.category === 'Assault' && ability.damageType === 'physical';
    if (['nextAssaultPotencyCost', 'nextSpellBoost', 'duplicateNextAssault', 'nextAssaultManaReturn', 'nextAssaultAccuracyDamage'].includes(handler)) return ability.category === 'Assault';
    return !SETUPS.has(ability.handler);
  }

  // A party preparation belongs to each recipient's next action. Refresh one record per
  // named setup so repeated casts do not multiply a future hit or create duplicate echoes.
  addPreparation(unit, ability, until) {
    const list = unit.status.replacementPreparations ??= [];
    const old = list.find(prep => prep.ability.id === ability.id);
    if (old) Object.assign(old, { ability, until }); else list.push({ ability, until });
    if (this.scene.combatLog?.diagnostics?.enabled) this.scene.combatLog.diagnostics.effectApplied(old ?? list.at(-1),
      this.unit(this.scene.combatLog.diagnostics.context?.actorId), ability, 'preparation', unit);
  }

  // Ready Weapon and Battle Instinct also apply to the next physical basic attack.
  // Capture their benefits on the saved action, then consume them once at commitment.
  basicPreparation(unit) {
    const result = { multiplier: 1, criticalBonus: 0 };
    if (unit.basicAttackDamageType === 'spell') return result;
    unit.status.replacementPreparations = (unit.status.replacementPreparations ?? []).filter(prep => {
      if (prep.until <= this.now()) { this.scene.combatLog?.diagnostics?.effectEvent('preparation_expired', prep, { actorId: unit.id }); return false; }
      if (prep.ability.handler === 'nextPhysicalBoost') { this.scene.combatLog?.diagnostics?.effectEvent('preparation_consumed', prep, { actorId: unit.id, consumingActionId: this.scene.combatLog?.diagnostics?.actionId(unit), consumingAbility: 'Attack' }); result.multiplier *= 1 + prep.ability.primary.potency; return false; }
      if (prep.ability.handler === 'nextCritBonus') { this.scene.combatLog?.diagnostics?.effectEvent('preparation_consumed', prep, { actorId: unit.id, consumingActionId: this.scene.combatLog?.diagnostics?.actionId(unit), consumingAbility: 'Attack' }); result.criticalBonus += prep.ability.primary.potency; return false; }
      return true;
    });
    return result;
  }

  isBehind(unit, target) {
    const facing = this.unit(target.currentTargetId);
    if (!facing) return false;
    const dx = facing.arenaX - target.arenaX, dy = facing.arenaY - target.arenaY;
    const ux = unit.arenaX - target.arenaX, uy = unit.arenaY - target.arenaY;
    return (dx * ux + dy * uy) / Math.max(1, Math.hypot(dx, dy) * Math.hypot(ux, uy)) <= -.5;
  }

  // Delayed ticks save their remaining count and exact next timestamp. The final partial
  // interval lands at expiry, so longer ranks still deliver exactly the authored total.
  periodic(caster, recipient, ability, total, kind, duration) {
    if (!recipient || duration <= 0) return;
    const interval = ability.tickInterval || 2000;
    const count = Math.max(1, Math.ceil(duration / interval));
    const list = recipient.status.replacementPeriodic ??= [];
    const key = `${caster.id}:${ability.id}:${kind}`;
    const record = { key, ownerId: caster.id, ability, amount: total / count, kind, interval, remaining: count, until: this.now() + duration, next: this.now() + Math.min(interval, duration) };
    const current = list.find(tick => tick.key === key);
    if (current) Object.assign(current, record); else list.push(record);
    this.scene.combatLog?.diagnostics?.effectApplied(current ?? record, caster, ability, 'periodic', recipient);
  }

  damage(caster, recipient, amount, ability, triggered = false, extras = {}) {
    if (!recipient?.alive || amount <= 0) return { amount: 0, hit: false };

    // Measured damage already includes the opening bonus on its original hit.
    if (ability.fromStealth && !extras.measured) amount *= ability.stealthDamageMultiplier ?? 1;
    const contact = { area: ability.shape !== 'None', replacementTriggered: triggered,
      hasArtwork: Boolean(findAbilityEffect(caster, ability) || hasAssaultAbilityEffect(ability)),
      suppressKnockback: ability.handler === 'intervene', ...extras };
    const impactPoint = { arenaX: recipient.arenaX, arenaY: recipient.arenaY };
    const oldBonus = caster.status.abilityCritBonus, oldUntil = caster.status.abilityCritUntil;
    if (ability.criticalBonus) { caster.status.abilityCritBonus = ability.criticalBonus; caster.status.abilityCritUntil = this.now() + 1; }
    const value = this.scene.resolveDamage(caster, recipient, amount, ability.damageType === 'physical' ? 'melee' : ability.element === 'radiant' ? 'holy' : 'spell', ability.handler === 'intervene' ? caster.threatMultiplier ?? 1 : 1, ability.name, !triggered || ability.handler === 'counterattackWindow', contact) ?? 0;
    if (ability.handler === 'intervene') {
      const extraThreat = contact.hit && recipient.alive ? contact.normalThreat ?? 0 : 0;
      if (extraThreat > 0 && recipient.alive) this.scene.addThreat(recipient, caster, extraThreat);
      this.interveneEvent(caster, recipient, ability, 'impact', { hit: Boolean(contact.hit), damage: value,
        normalThreat: contact.normalThreat ?? 0, totalThreat: recipient.alive ? (contact.normalThreat ?? 0) + extraThreat : 0 });
    }
    if (contact.hit && !triggered) spreadHitThreat(this.scene, caster, recipient, ability, contact.normalThreat, impactPoint);
    if (ability.criticalBonus) { caster.status.abilityCritBonus = oldBonus; caster.status.abilityCritUntil = oldUntil; }
    return { amount: value, hit: contact.hit === undefined ? value > 0 : contact.hit };
  }

  heal(caster, recipient, amount, ability, triggered = false) {
    if (!recipient?.alive || recipient.isDecoy || amount <= 0) return 0;
    const before = recipient.hp;
    this.scene.resolveHeal(caster, recipient, amount, ability.name, !triggered, Boolean(findAbilityEffect(caster, ability)));
    return recipient.hp - before;
  }

  mana(recipient, amount) {
    if (recipient?.alive) {
      const before = recipient.mana;
      recipient.mana = Math.min(recipient.maxMana, recipient.mana + Math.max(0, Math.round(amount)));
      this.scene.combatLog?.diagnostics?.emit('resource_change', { targetId: recipient.id,
        resource: 'mana', delta: recipient.mana - before, after: recipient.mana,
        cause: this.scene.combatLog?.diagnostics?.context, reasonCode: 'ability_recovery' });
    }
  }

  // Shadow Trap needs a learned Siphon, even when Siphon is not in the four-slot loadout.
  // Rebuild its trained definition without making it available to ordinary casting AI.
  trainedSkill(unit, name) {
    const equipped = Object.values(unit.abilities).find(ability => ability.name === name);
    if (equipped) return equipped;
    const base = Object.values(CLASS_DEFINITIONS[unit.className]?.abilities ?? {}).find(ability => ability.name === name);
    const rank = base && unit.knownAbilityRanks?.[base.id];
    return Number.isSafeInteger(rank) && rank > 0 ? rankedReplacementAbility(base, rank) : null;
  }

  control(recipient, ability, kind, duration) {
    const diagnosticApplied = !!recipient?.alive && !recipient.controlImmunities?.includes(kind) && duration > 0;
    const diagnosticCause = this.scene.combatLog?.diagnostics?.control(recipient, ability, kind, diagnosticApplied,
      !recipient?.alive ? 'ineligible' : recipient.controlImmunities?.includes(kind) ? 'immune' : duration <= 0 ? 'invalid_duration' : 'applied', duration);
    if (!recipient?.alive || recipient.controlImmunities?.includes(kind) || duration <= 0) return;
    if (kind === 'stun') {
      recipient.status.stunnedUntil = this.now() + duration;
      recipient.status.hardStunUntil = this.now() + duration;
      recipient.finishAction?.('interrupted', 'stun', 'Applied hard stun clears pending action', { cause: diagnosticCause });
      this.scene.clearAbilityTelegraph?.(recipient);
      this.cancelWarnings(recipient);
    } else recipient.status[kind === 'root' ? 'rootedUntil' : kind === 'disarm' ? 'replacementDisarmUntil' : 'spellLockUntil'] = this.now() + duration;
  }

  reaction(caster, recipient, ability, kind = ability.handler) {
    const list = recipient.status.replacementReactions ??= [];
    const current = list.find(record => record.ability.id === ability.id && record.ownerId === caster.id);
    const record = { ownerId: caster.id, ability, kind, until: this.now() + (ability.handler === 'damageActionPunishment' ? ability.secondaryDuration : ability.duration), lastAt: -Infinity };
    if (current) Object.assign(current, record); else list.push(record);
  }

  // Most skills are a primary stat-based hit/heal plus an independent secondary effect.
  // Special setup, zones, costs and reactions are handled first so they never fall through
  // into an unintended immediate hit.
  resolve(caster, target, ability, time, triggered = false) {
    if (CLASS_RESTRICTED_ABILITIES[ability.id] && !abilityAllowed(caster.className, ability)) return;
    if (ability.handler === 'intervene') return;
    if (isRune(ability)) return resolveRune(this, caster, target, ability, time);
    if (ability.handler === 'bonusCritDamage') ability = { ...ability, criticalBonus: ability.secondary.potency };
    const h = ability.handler, x = ability.primary.potency, y = ability.secondary.potency;

    // A free reactive Siphon has no windup to borrow. Its connection grows as
    // feedback for the instant reaction while the original damage stays immediate.
    if (triggered && ability.id === 'ability_v2_umbral_mage_siphon') {
      this.scene.createAbilityTelegraph?.(caster, target, ability, null);
    }
    if (h === 'stealthStrike' && !ability.fromStealth && !caster.stealthed || h === 'rearStrike' && !this.isBehind(caster, target)) return;
    if (SETUPS.has(h)) {
      const prepared = ability.targetLabel === 'Allies' ? this.recipients(caster, target, ability, true) : [caster];
      for (const recipient of prepared) this.addPreparation(recipient, ability, time + ability.duration);

      // Party preparations are drawn after each recipient has its saved record.
      if (ability.className === 'Oathwarden' || ability.className === 'Gladiator'
        || ability.className === 'Barbarian') {
        this.scene.createAbilityEffect?.(caster, target, ability, prepared);
      }
      return;
    }
    if (ZONES.has(h)) {
      const center = ability.anchor === 'Caster' ? caster : target;
      const zones = caster.status.replacementZones ??= [];
      caster.status.replacementZones = zones.filter(zone => zone.ability.id !== ability.id);
      caster.status.replacementZones.push({ ability, point: { arenaX: center.arenaX, arenaY: center.arenaY }, until: time + ability.duration, startedAt: time, next: time, wave: this.scene.currentWaveIndex, inside: {}, exitedAt: {} });
      this.scene.createAbilityEffect?.(caster, target, ability); return;
    }
    if (REFILLS.has(h)) {
      this.refill(caster, x);
      if (h === 'partyRestoreCharges') for (const ally of this.allies()) if (ally !== caster) this.refill(ally, y);
      if (h === 'restoreChargesNextBoost') this.resolve(caster, caster, { ...ability, handler: 'nextPhysicalBoost', primary: ability.secondary }, time);

      // Full packs cannot hold extra charges. Training instead improves one subsequent physical skill.
      // Reuse the saved preparation record and consume it at commitment, without another cast or cost.
      if (ability.restockDamageBonus) {
        this.addPreparation(caster, { ...ability, handler: 'nextPhysicalBoost', duration: 8000,
          primary: { ...ability.primary, potency: ability.restockDamageBonus, cap: null },
          secondary: { ...ability.secondary, potency: 0 } }, time + 8000);
      }

      // Charge restoration has no saved status, so start its one-shot art here.
      if (ability.id === 'ability_v2_oathwarden_oath_of_the_supplicant'
        || ability.id === 'ability_v2_gladiator_reequip'
        || ability.id === 'ability_v2_barmaid_restock_the_bar') {
        this.scene.createAbilityEffect?.(caster, caster, ability);
      }

      // Show a refill cue at each recipient after their charges are resolved.
      // This is local potion stock, not a thrown drink or a traveling missile.
      if (ability.id === 'ability_v2_barmaid_liquid_courage') {
        this.scene.createAbilityEffect?.(caster, caster, ability, this.allies());
      }

      // Potion restoration is brief; the prepared axe follows the separately
      // saved next-attack record created by the recursive setup above.
      if (ability.id === 'ability_v2_barbarian_preparation') {
        this.scene.createAbilityEffect?.(caster, caster, { ...ability, vfxPhase: 'refill' });
      }
      return;
    }
    if (h === 'freeItemUse') {
      caster.status.replacementFreeItem = { until: time + ability.duration };
      if (ability.id === 'ability_v2_gladiator_combat_readiness') {
        this.scene.createAbilityEffect?.(caster, caster, ability);
      }
      return;
    }
    if (h === 'channelNextSpellMana') {
      caster.status.replacementChannel = { ability, until: time + ability.duration, startedAt: time, next: time + ability.tickInterval, remaining: Math.max(1, Math.ceil(ability.duration / ability.tickInterval)) };
      this.scene.combatLog?.diagnostics?.effectApplied(caster.status.replacementChannel, caster, ability, 'channel', caster);
      caster.status.rootedUntil = time + ability.duration;

      // Meditation's artwork starts after the saved channel exists. Interruption
      // removes that record and lets the renderer fade without changing its rules.
      if (ability.id === 'ability_v2_umbral_mage_dark_meditation') this.scene.createAbilityEffect?.(caster, caster, ability);
      return;
    }
    if (h === 'stealth') { caster.setStealthed(true); caster.status.stealthUntil = time + ability.duration; return; }
    if (h === 'poisonWeaponWindow') { caster.status.replacementPoisonWeapon = { ability, until: time + ability.duration }; return; }
    if (['remainingCooldownReduction', 'partyCooldownReduction', 'partyOneCooldownReduction'].includes(h)) {
      for (const ally of h === 'remainingCooldownReduction' ? [caster] : this.allies()) {
        this.reduceCooldowns(ally, x, null, h === 'partyOneCooldownReduction');
      }
      if (ability.id === 'ability_v2_gladiator_tactical_reset') {
        this.scene.createAbilityEffect?.(caster, caster, ability);
      }
      return;
    }
    if (h === 'categoryCooldownBuff') {
      this.modifier(caster, caster, ability, { protectCooldown: -x }, ability.duration);

      // The modifier is recorded before its visual starts, so reload can restore it.
      if (ability.id === 'ability_v2_oathwarden_steadfast_focus') this.scene.createAbilityEffect?.(caster, caster, ability);
      return;
    }
    if (h === 'revive') {
      if (!target.alive && !target.noReviveThisBattle) {
        target.revive(x, y);

        // Reclamation forms a local soul silhouette on the newly revived ally.
        this.scene.createAbilityEffect?.(caster, target, ability);
      }
      return;
    }
    if (h === 'manaDrain') {
      if (!this.enemies().includes(target) || target.mana <= 0
        || arenaDistance(caster, target) > ability.range * 100) return;
      const drained = Math.min(target.mana, replacementAmount(caster, target, ability.primary));
      const before = caster.mana;
      target.mana -= drained;
      this.mana(caster, drained * y);

      // Keep the existing resolved recipient and resource calculation. The drain
      // and return are cosmetic phases; a full caster gets no false recovery cue.
      if (ability.id === 'ability_v2_umbral_mage_essence_drain' && drained > 0) {
        this.scene.createAbilityEffect?.(caster, target, ability);
        if (caster.mana > before) this.scene.createAbilityEffect?.(caster, caster, { ...ability, vfxPhase: 'mana' });
      }
      return;
    }
    if (h === 'enemyForcedAttack') {
      const enemy = this.enemies().filter(enemy => enemy !== target).sort((a, b) => arenaDistance(a, target) - arenaDistance(b, target))[0];
      if (enemy && !target.isBoss) target.status.replacementForcedAttack = { targetId: enemy.id, until: time + ability.duration, fraction: x };
      return;
    }
    if (h === 'decoyThreat' || h === 'decoyAllyRescue') { this.decoy(caster, target, ability); return; }
    if (h === 'arenaRepositionTruce') { this.truce(caster, ability); return; }
    if (REACTIONS.has(h) && h !== 'damageActionPunishment') {
      this.reaction(caster, ['blockStun', 'counterattackWindow', 'reactiveSiphon', 'criticalPotionReaction'].includes(h) ? caster : target, ability);

      // Life Anchor appears on cast. Its saved reaction controls the fade after
      // consumption or expiry, without adding a separate cosmetic status timer.
      if (h === 'conditionalHeal') this.scene.createAbilityEffect?.(caster, target, ability);

      // Briarweave forms on its recipient as soon as its reflection window starts.
      // The saved reaction controls its animation lifetime and combat-time fade.
      if (ability.id === 'ability_v2_verdant_cleric_briarweave') this.scene.createAbilityEffect?.(caster, target, ability);

      // The counterattack record keeps the red parry rim visible for its full window.
      if (ability.id === 'ability_v2_oathwarden_vow_of_retaliation') this.scene.createAbilityEffect?.(caster, caster, ability);
      if (ability.id === 'ability_v2_oathwarden_vigilance') this.scene.createAbilityEffect?.(caster, caster, ability);

      // Quick Pour's saved reaction keeps the small ready bottle visible.
      if (ability.id === 'ability_v2_barmaid_quick_pour') this.scene.createAbilityEffect?.(caster, caster, ability);
      if (ability.id === 'ability_v2_umbral_mage_shadow_trap') this.scene.createAbilityEffect?.(caster, caster, ability);
      if (h === 'blockStun') this.modifier(caster, caster, ability, { block: x }, ability.duration); return;
    }
    if (h === 'intercept') {
      target.status.replacementIntercept = { ownerId: caster.id, until: time + ability.duration, reduction: y, abilityId: ability.id };
      if (ability.id === INTERVENE) target.status.replacementIntercept.sourceActionId = this.scene.combatLog?.diagnostics?.actionId(caster);

      // Identify this live intercept without adding an ability field to saves.
      // Another cast replaces the record, which lets the old tray fade out.
      if (ability.id === 'ability_v2_barmaid_cover_the_regulars') rememberBarmaidIntercept(target.status.replacementIntercept);

      // Show the brief caster cue only for a new cast, never for restored status art.
      this.scene.createAbilityEffect?.(caster, target, ability);
      return;
    }
    if (h === 'pairedEscape') {
      for (const ally of [caster, target]) { this.modifier(ally, caster, ability, { movement: x }, ability.duration); this.prepareEscape(ally, ability.duration); } return;
    }
    if (h === 'cleanse' || h === 'cleanseSlowResistance') {
      this.cleanse(target, h === 'cleanse' ? Infinity : 1);

      // A successful cleanse still needs its brief recipient artwork even though
      // this handler returns before the shared damage and modifier presentation.
      this.scene.createAbilityEffect?.(caster, target, ability);
      if (h === 'cleanseSlowResistance') this.modifier(target, caster, ability, { slowResistance: y }, ability.duration); return;
    }
    if (h === 'dispel') {
      let remaining = 2;
      target.status.replacementEffects = (target.status.replacementEffects ?? []).filter(effect => effect.harmful || !effect.removable || remaining-- <= 0);
      refreshReplacementTiming(target, time);
      this.scene.createAbilityEffect?.(caster, target, ability);
      return;
    }

    // A pace is 100 arena units. Resolve the authored radius around the caster
    // after the windup, then let the shared combat-clock stun cancel enemy actions.
    if (h === 'areaStun') {
      for (const enemy of this.recipients(caster, caster, ability)) {
        if (enemy.controlImmunities?.includes('stun')) { this.scene.combatLog?.diagnostics?.control(enemy, ability, 'stun', false, 'immune', ability.duration, caster); continue; }
        this.control(enemy, ability, 'stun', ability.duration);
        this.scene.createAbilityEffect?.(caster, enemy, ability, [enemy]);
        this.scene.createAbilityEffect?.(caster, enemy, { ...ability, vfxPhase: 'stun' }, [enemy]);
      }
      return;
    }
    if (h === 'disarm' || h === 'abilityLock' || h === 'conditionalStun' || h === 'areaRoot') {
      for (const enemy of this.recipients(caster, target, ability)) {
        this.control(enemy, ability, h === 'areaRoot' ? 'root' : h === 'conditionalStun' ? 'stun' : h, ability.duration);
        this.scene.createAbilityEffect?.(caster, enemy, ability);
      }
      return;
    }
    const friendly = ability.target === 'ally' || ability.targetLabel === 'Self' && ability.category !== 'Assault';
    let recipients = this.recipients(caster, target, ability, friendly);
    if (h === 'chargeLine' && !ability.replacementOrigin) {
      if (this.scene.isPositionLocked(caster)) return;
      const point = this.parent.adjacentPoint(caster, target);
      if (!point) return;
      caster.setArenaPosition(point.x, point.y);
    }
    if (h === 'stealthStrike' && !ability.fromStealth) caster.setStealthed(false);

    // Replacement marks read their timed modifier. The legacy flag would keep
    // restoring artwork until death even after the current eight-second mark ends.
    if (h === 'mark' && !ability.replacement) target.status.huntersMarkVisual = true;
    let dealt = 0, healed = 0, damageAttempted = false;
    const landed = [];
    for (const recipient of recipients) {
      if (SHIELDS.has(h)) {
        recipient.status.temporaryHp = Math.max(recipient.status.temporaryHp ?? 0, Math.round(replacementAmount(caster, recipient, ability.primary)));
        recipient.status.temporaryHpUntil = time + ability.duration;
        if (h === 'manaBasedShield') recipient.status.sunlitWardVisualUntil = time + ability.duration;
        if (h === 'shieldBurst') recipient.status.replacementShieldBurst = { ownerId: caster.id, ability, until: time + ability.duration };
        else delete recipient.status.replacementShieldBurst;
        if (h === 'shieldReflect') this.reaction(caster, recipient, ability, 'shieldReflect');
      } else if (PRIMARY_MODIFIERS[h]) {
        const recipientOfBuff = ['attackBuffTaunt', 'armorSelfRoot'].includes(h) ? caster : recipient;
        this.modifier(recipientOfBuff, caster, ability, this.changes(PRIMARY_MODIFIERS[h], x), ability.duration, Boolean(recipientOfBuff.isEnemy));
      } else if (PERIODIC_PRIMARY.has(h)) {
        const kind = h === 'partyManaOverTime' ? 'mana' : h === 'damageOverTime' ? 'damage' : 'heal';
        if (kind === 'mana' && !recipient.maxMana) continue;
        this.periodic(caster, recipient, ability, replacementAmount(caster, recipient, ability.primary), kind, ability.duration);
      } else if (ability.primary.unit === '% of power basis' && (ability.primary.healing || ability.primary.basis === 'Caster Spell Healing')) {
        healed += this.heal(caster, recipient, replacementAmount(caster, recipient, ability.primary), ability, triggered);
      } else if (ability.primary.unit === '% of power basis' && ability.primary.basis.includes('Mana')) {
        this.mana(recipient, replacementAmount(caster, recipient, ability.primary));
      } else if (ability.primary.unit === '% of power basis') {
        damageAttempted = true;

        // Solar Strike folds prepared extra damage into one hit per selected enemy.
        const amount = replacementAmount(caster, recipient, ability.primary) * (h === 'damageTaunt' ? 1 + (ability.echoScale ?? 0) : 1)
          + (h === 'damageTaunt' && ability.coveringFire && !triggered ? caster.attackPower * ability.coveringFire.power : 0);
        const result = this.damage(caster, recipient, amount, ability, triggered,
          h === 'armorPiercingDamage' ? { armorPiercing: y } : {});
        dealt += result.amount;
        if (result.hit) landed.push(recipient);
      }
    }
    if (h === 'damageTaunt' || ability.threatPulseInterval) {
      this.dawnwardenTaunt(caster, recipients, ability, time, ability.tauntDuration ?? ability.duration);
      if (ability.threatPulseInterval) {
        this.modifier(caster, caster, ability, { reduction: -y }, ability.duration);

        // One saved combat-clock record replaces any prior cast and follows the caster.
        caster.status.replacementShelter = { ability, next: time + ability.threatPulseInterval,
          until: time + ability.threatPulseDuration, wave: this.scene.currentWaveIndex };
      }
    } else if (h === 'taunt' || h === 'tauntReduction' || h === 'attackBuffTaunt' || h === 'damageDebuffTaunt') {
      this.scene.applyTankTaunt(caster, recipients, ability.id, time, false,
        { ...ability, duration: h === 'attackBuffTaunt' ? ability.secondaryDuration : ability.duration });
      if (h === 'tauntReduction') this.modifier(caster, caster, ability, { reduction: -y }, ability.duration);
    }
    if (h === 'armorSelfRoot') caster.status.replacementCostRootUntil = time + ability.duration;
    if (h === 'damageBoostArmorPenalty') this.modifier(caster, caster, { ...ability, id: ability.id + ':cost' }, { armor: -.2 }, ability.duration);
    if (h === 'blockBuffStun') { this.modifier(caster, caster, ability, { block: x }, ability.duration); this.control(target, ability, 'stun', ability.secondaryDuration); }
    if (h === 'speedNextWindup' || h === 'movementNextWindup' || h === 'dodgeNextWindup') {
      for (const recipient of h === 'dodgeNextWindup' ? recipients : [caster]) this.addPreparation(recipient,
        { ...ability, handler: 'nextWindupReduction', primary: ability.secondary }, time + ability.duration);
    }
    if (h === 'escapeMovementBuff') this.prepareEscape(caster, ability.duration);
    this.secondary(caster, target, ability, recipients, landed, dealt, healed, triggered);

    // Lasting strike cues start only on confirmed hits, after gameplay records
    // exist. Their separate phase prevents restoring the old contact animation.
    const barmaidPhase = {
      ability_v2_barmaid_frying_pan: 'stun',
      ability_v2_barmaid_bottle_smash: 'bleed',
      ability_v2_barmaid_last_call: 'dazed'
    }[ability.id];
    if (barmaidPhase) for (const recipient of landed) {
      this.scene.createAbilityEffect?.(caster, recipient, { ...ability, vfxPhase: barmaidPhase }, [recipient]);
    }
    if (!damageAttempted || landed.length) this.scene.createAbilityEffect?.(caster, target, ability, landed.length ? landed : recipients);
    if (ability.echoScale && !triggered && h !== 'damageTaunt') this.resolve(caster, target, { ...ability, echoScale: 0, primary: { ...ability.primary, potency: x * ability.echoScale }, secondary: { ...ability.secondary, potency: y * ability.echoScale } }, time, true);
  }

  // Secondary effects use their own coefficient and timer. Damage-linked effects use
  // actual HP lost; healing-linked damage uses effective recovery and excludes overheal.
  secondary(caster, target, ability, recipients, landed, dealt, healed, triggered) {
    const h = ability.handler, y = ability.secondary.potency;
    const friendly = this.allies();
    if (SECONDARY_MODIFIERS[h] && !triggered) {
      const affected = h === 'damageSpeedBuff' ? [caster] : h === 'enemySpeedPartyArmor' ? friendly.filter(a => arenaDistance(a, caster) <= 240) : h.startsWith('damage') ? landed : recipients;
      for (const recipient of affected) this.modifier(recipient, caster, { ...ability, id: ability.id + ':secondary' }, this.changes(SECONDARY_MODIFIERS[h], y), ability.secondaryDuration || ability.duration, recipient.isEnemy);
    }
    if (!triggered && h === 'damageInterrupt' && this.scene.combatLog?.diagnostics?.enabled) {
      for (const enemy of recipients) if (!landed.includes(enemy)) {
        this.scene.combatLog.diagnostics.control(enemy, ability, 'explicit_interrupt', false, 'hit_not_confirmed', 0, caster);
      }
    }
    if (!triggered) for (const enemy of landed) {
      if (h === 'damageStun' || h === 'stealthStrike') this.control(enemy, ability, 'stun', ability.secondaryDuration);
      if (h === 'damageRoot') this.control(enemy, ability, 'root', ability.secondaryDuration);
      if (h === 'damageInterrupt') {
        const cause = this.scene.combatLog?.diagnostics?.control(enemy, ability, 'explicit_interrupt', true, enemy.pendingAction ? 'applied' : 'no_active_action', 0, caster);
        enemy.finishAction?.('interrupted', 'explicit_interrupt', 'Confirmed hit applied explicit interrupt', { cause }); this.cancelWarnings(enemy);
      }
      if (h === 'damageBleed') this.periodic(caster, enemy, ability, replacementAmount(caster, enemy, ability.secondary), 'damage', ability.secondaryDuration);
      if (h === 'damageActionPunishment') this.reaction(caster, enemy, ability);
    }
    if (h === 'damageCooldownReduction' && !triggered) this.reduceCooldowns(caster, y, 'Assault');
    if (h === 'damageEscapeTeleport' && !triggered) this.escape(caster, 4, false, ability, caster);
    if (h === 'damageEnemyTeleport' && !triggered) for (const enemy of landed) if (!enemy.isBoss) this.teleportToRearCorner(enemy, ability, caster);
    if (['healOverTime', 'partyHealOverTime'].includes(h)) for (const ally of recipients) this.periodic(caster, ally, ability, replacementAmount(caster, ally, ability.secondary), 'heal', ability.secondaryDuration);
    if (['armorHeal', 'allyAreaBlindHeal'].includes(h)) for (const ally of h === 'allyAreaBlindHeal' ? [target] : recipients) this.heal(caster, ally, replacementAmount(caster, ally, ability.secondary), ability, triggered);
    if (['accuracyDebuffDamage', 'attackDebuffDamage', 'slowDamage'].includes(h)) for (const enemy of recipients) this.damage(caster, enemy, replacementAmount(caster, enemy, ability.secondary), ability, triggered);
    if (['healMana', 'partyHealMana'].includes(h)) for (const ally of recipients) if (ally.maxMana > 0) this.mana(ally, replacementAmount(caster, ally, ability.secondary));
    if (h === 'allDamagePartyMana' && !triggered) for (const ally of friendly) {
      const before = ally.mana;
      this.mana(ally, replacementAmount(caster, ally, ability.secondary));

      // Echo forms locally on every affected enemy and rewards each ally who
      // actually gains Mana with a separate rising blue rune.
      if (ability.id === 'ability_v2_umbral_mage_echo_of_night' && ally.mana > before) {
        this.scene.createAbilityEffect?.(caster, ally, { ...ability, vfxPhase: 'mana' }, [ally]);
      }
    }
    if (h === 'healCleanse') this.cleanse(caster, 1);
    if (h === 'areaDamageLowestHeal' || h === 'damageNearestHeal') {
      const allies = this.offensiveHealingRecipients(caster, target, ability);
      if (allies[0] && dealt > 0) this.heal(caster, allies[0], replacementAmount(caster, allies[0], ability.secondary), ability, triggered);
    }
    if (['damageLifesteal', 'areaDamageLifesteal', 'areaDamageLinkedHeal', 'allDamagePartyLinkedHeal'].includes(h) && dealt > 0) {
      const allies = h.includes('Lifesteal') || h === 'damageLifesteal' ? [caster] : this.offensiveHealingRecipients(caster, target, ability);

      // Linked healing starts from actual damage, with a separate cap per recipient.
      // New kits use shared Spell Power and its temporary modifiers. Old saved kits
      // retain their healing stat. Each rank above one adds 8% to the existing cap.
      const power = caster.spellPower != null
        ? caster.spellPower * replacementMultiplier(caster, 'spell', this.now()) : caster.spellHealing;
      const rankScale = 1 + ((ability.rank ?? 1) - 1) * .08;
      const healingCap = power * rankScale * (h === 'allDamagePartyLinkedHeal' ? .6 : .5);
      for (const ally of allies) {
        const recovered = this.heal(caster, ally, Math.min(dealt * y, healingCap), ability, true);

        // Guided Retribution forms healing light only on allies who recovered HP.
        // This cosmetic phase shares the original ID and changes no saved record.
        if (recovered > 0 && ability.id === 'ability_v2_everbright_cleric_guided_retribution') {
          this.scene.createAbilityEffect?.(caster, ally, { ...ability, vfxPhase: 'heal' }, [ally]);
        }
        if (recovered > 0 && ability.id === 'ability_v2_umbral_mage_siphon') {
          this.scene.createAbilityEffect?.(caster, ally, { ...ability, vfxPhase: 'heal' }, [ally]);
        }
      }
    }
    if (['healNearbyDamage', 'healLinkedAreaDamage', 'partyHealAdjacentDamage', 'areaHealAreaDamage'].includes(h)) {
      const anchors = h === 'partyHealAdjacentDamage' ? recipients.filter(a => a.hp > 0) : [h === 'areaHealAreaDamage' ? caster : target];
      const radius = h === 'partyHealAdjacentDamage' ? 100 : h === 'areaHealAreaDamage' ? 240 : 200;
      for (const enemy of this.enemies().filter(enemy => anchors.some(anchor => arenaDistance(enemy, anchor) <= radius))) {
        if (h !== 'areaHealAreaDamage' && healed <= 0) continue;
        const result = this.damage(caster, enemy, h === 'healLinkedAreaDamage' ? healed * y : replacementAmount(caster, enemy, ability.secondary), { ...ability, damageType: 'spell' }, triggered);

        // Reprisal's secondary radiant hit forms beside healed allies. It launches
        // no object; confirmed contact receives separate impact art at the enemy.
        if (result.hit && ability.id === 'ability_v2_everbright_cleric_divine_reprisal') {
          this.scene.createAbilityEffect?.(caster, enemy, { ...ability, vfxPhase: 'hit' }, [enemy]);
        }
      }
    }
    if (h === 'damageSplash' && landed.length) for (const enemy of this.enemies().filter(enemy => enemy !== target && arenaDistance(enemy, target) <= 200)) this.damage(caster, enemy, replacementAmount(caster, enemy, ability.secondary), { ...ability, shape: 'Circle' }, triggered);
    if (h === 'allyAreaBlindHeal') for (const enemy of this.enemies().filter(enemy => arenaDistance(enemy, target) <= 100)) this.modifier(enemy, caster, ability, { hit: -ability.primary.potency }, ability.duration, true);
    if (ability.manaReturn && dealt > 0 && !triggered) {
      this.mana(caster, Math.min(caster.maxMana * .1, dealt * ability.manaReturn.fraction));
      for (const ally of friendly) if (ally !== caster) this.mana(ally, ally.maxMana * ability.manaReturn.party);
    }
    if (ability.coveringFire && !triggered) for (const enemy of landed) {
      this.modifier(enemy, caster, ability, { hit: -ability.coveringFire.fraction }, ability.coveringFire.duration, true);
      if (h !== 'damageTaunt') this.damage(caster, enemy, caster.attackPower * ability.coveringFire.power, ability, true);
    }
  }

  // Use the same eligible cooldown list for deciding and applying a reset. Once-only
  // skills, item refills and other resets cannot participate in a repeatable loop.
  runningCooldowns(unit, category = null, shortOnly = false) {
    const result = [];
    for (const [key, ability] of Object.entries(unit.abilities)) {
      if (!ability.replacement || ability.oncePerWave || ability.oncePerEncounter || ability.handler.includes('Cooldown') || ability.handler.includes('duplicate') || REFILLS.has(ability.handler)) continue;
      if (category && ability.category !== category) continue;
      const duration = ability.cooldown * (unit.status.replacementCooldownFactors?.[key] ?? 1);
      const remaining = Math.max(0, duration - (this.now() - (unit.lastAbilityAt[key] ?? -Infinity)));
      if (!remaining || shortOnly && remaining > 5000) continue;
      result.push({ key, remaining });
    }
    return shortOnly ? result.slice(0, 1) : result;
  }

  reduceCooldowns(unit, fraction, category = null, shortOnly = false) {
    for (const { key, remaining } of this.runningCooldowns(unit, category, shortOnly)) unit.lastAbilityAt[key] -= remaining * fraction;
  }

  hasRemovableHarm(unit) {
    return unit.status.replacementEffects?.some(effect => effect.harmful && effect.removable && effect.until > this.now())
      || unit.status.replacementPeriodic?.some(tick => tick.kind === 'damage' && tick.remaining > 0)
      || ['blindUntil', 'spellLockUntil', 'rootedUntil', 'replacementDisarmUntil', 'stunnedUntil'].some(field => unit.status[field] > this.now());
  }

  cleanse(unit, limit) {
    let removed = 0;
    unit.status.replacementEffects = (unit.status.replacementEffects ?? []).filter(effect => {
      if (effect.harmful && effect.removable && removed < limit) { removed++; return false; } return true;
    });
    for (const field of ['blindUntil', 'spellLockUntil', 'rootedUntil', 'replacementDisarmUntil', 'stunnedUntil']) if (unit.status[field] > this.now() && removed < limit) {

      // A channel's root is its casting restriction, not a removable enemy condition.
      if (field === 'rootedUntil' && unit.status.replacementChannel?.until > this.now()) continue;
      unit.status[field] = 0;
      if (field === 'stunnedUntil') unit.status.hardStunUntil = 0;
      removed++;
    }
    unit.status.replacementPeriodic = (unit.status.replacementPeriodic ?? []).filter(tick => {
      if (tick.kind === 'damage' && removed < limit) { removed++; return false; } return true;
    });
    refreshReplacementTiming(unit, this.now());
  }

  // Cancel both class artwork and monster ground warnings immediately, while the saved
  // action identity still prevents any already scheduled callback from applying damage.
  cancelWarnings(unit) {
    this.scene.clearAbilityTelegraph?.(unit);
    for (const warning of [...(this.scene.activeTelegraphs ?? [])]) if (warning.attacker === unit) this.scene.removeTelegraph?.(warning);
  }

  // Probe each corner along this battlefield's own rear outline. Nearby alternatives
  // leave space for other enemies; a crowded corner falls back to the opposite one.
  teleportToRearCorner(unit, ability, caster) {
    if (!unit.alive || this.scene.isPositionLocked(unit)) return;
    const battlefield = this.scene.battlefield;
    const width = battlefield.logicalWidth, height = battlefield.logicalHeight;
    const rightFirst = this.scene.combatRandom() < .5;
    for (const right of [rightFirst, !rightFirst]) {
      const points = [];
      for (let column = 0; column < 6; column++) {
        const inset = width * (.08 + column * .045);
        const x = right ? width - inset : inset;
        let rearY = height - 24;
        while (rearY > height * .5 && !battlefield.containsArenaPoint(x, rearY, 16)) rearY -= 12;
        for (let row = 0; row < 4; row++) {
          const y = rearY - 36 - row * 60;
          if (y >= height * .5 && battlefield.containsArenaPoint(x, y, 16)) points.push({ x, y });
        }
      }
      const score = point => Math.hypot(right ? width - point.x : point.x, height - point.y);
      points.sort((a, b) => score(a) - score(b));
      // A root prevents walking, not this forced relocation. Require a substantial
      // move so an enemy already near one corner tries the opposite corner instead.
      const selected = points.find(point => arenaDistance(unit, point) >= 240 && this.parent.canTeleport(unit, point));
      if (!selected) continue;
      this.scene.playTeleportEffect?.(unit, selected, ability, caster);
      unit.setArenaPosition(selected.x, selected.y);
      // Restored pending casts may still carry the former zero-duration definition.
      // Keep a longer existing root while guaranteeing five seconds after placement.
      this.control(unit, ability, 'root', Math.max(5000, (unit.status.rootedUntil ?? 0) - this.now()));
      return;
    }
  }

  escape(unit, range, hostile = false, ability = null, caster = unit) {
    if (this.scene.isPositionLocked(unit) || unit.status.rootedUntil > this.now()) return;
    const points = this.parent.surroundingPoints(unit, range * 100).filter(point => this.parent.canTeleport(unit, point));
    const threats = hostile ? this.allies() : this.enemies();
    points.sort((a, b) => Math.min(...threats.map(t => arenaDistance(t, b))) - Math.min(...threats.map(t => arenaDistance(t, a))));
    const selected = hostile ? points[Math.floor(this.scene.combatRandom() * Math.max(1, Math.ceil(points.length / 2)))] : points[0];
    if (selected) {

      // Artwork observes the resolved landing. Moving remains immediate and spends
      // exactly the same combat random rolls as before this visual was added.
      this.scene.playTeleportEffect?.(unit, selected, ability, caster);
      unit.setArenaPosition(selected.x, selected.y);
    }
  }

  // Physical escape skills sprint through ordinary steering. They do not teleport an
  // injured ally across scenery or override a player's explicit Hold destination.
  prepareEscape(unit, duration) {
    if (this.scene.isPositionLocked(unit)) return;
    const point = this.parent.escapePoint(unit, 4);
    if (point) unit.status.replacementEscape = { point, until: this.now() + duration };
  }

  decoy(caster, target, ability) {
    const rescue = ability.handler === 'decoyAllyRescue';
    const point = rescue ? { x: target.arenaX, y: target.arenaY } : this.parent.escapePoint(caster, 6);
    if (!point || rescue && this.scene.isPositionLocked(target)) return;
    const decoy = this.scene.createAbilityDecoy?.(caster, rescue ? target : caster, point, replacementAmount(caster, target, ability.primary), this.now() + ability.duration);
    if (!decoy) return;

    // Shadow Image belongs to the distant decoy, never the caster's old point.
    // Its original sprite and existing saved expiry keep the summon recognizable.
    if (ability.id === 'ability_v2_umbral_mage_shadow_image') this.scene.createAbilityEffect?.(caster, decoy, ability);
    if (rescue) {
      const landing = this.parent.adjacentPoint(target, caster);
      if (landing) {
        this.scene.playTeleportEffect?.(target, landing, ability, caster, { decoy });
        target.setArenaPosition(landing.x, landing.y);
        this.heal(caster, target, replacementAmount(caster, target, ability.secondary), ability);
      }
    } else for (const enemy of this.enemies()) if (enemy.currentTargetId === caster.id && !enemy.isBoss) enemy.status.replacementDecoyTarget = { id: decoy.id, until: this.now() + ability.duration };
  }

  truce(caster, ability) {
    const width = this.scene.battlefield.logicalWidth, height = this.scene.battlefield.logicalHeight;
    for (const [side, units] of [[.25, this.enemies()], [.75, this.allies()]]) {
      for (const [index, unit] of units.entries()) {
        if (unit.isBoss || this.scene.isPositionLocked(unit)) continue;
        const desired = { x: width * side, y: height * (index + 1) / (units.length + 1) };
        const points = [desired, ...this.parent.surroundingPoints(desired, 100)].filter(point => this.parent.canTeleport(unit, point));
        if (points[0]) {
          this.scene.playTeleportEffect?.(unit, points[0], ability, caster);
          unit.setArenaPosition(points[0].x, points[0].y);
        }
        unit.status.rootedUntil = this.now() + (unit.isEnemy ? ability.duration : ability.secondaryDuration);
        if (unit.isEnemy) { unit.finishAction?.('cancelled', 'state_invalidated', 'Truce clears enemy action'); unit.status.replacementTruceUntil = this.now() + ability.duration; }
      }
    }
  }

  // Ticks and channels are model state, not Phaser timers. They therefore resume exactly
  // once after loading and use the same calculation during visible and background play.
  tick(time) {
    for (const unit of this.units()) {
      const shelter = unit.status.replacementShelter;
      if (shelter) {
        if (!unit.alive || this.scene.battleOver || shelter.wave !== this.scene.currentWaveIndex) {
          delete unit.status.replacementShelter;
        } else {
          while (shelter.next <= Math.min(time, shelter.until)) {
            const affected = this.enemies().filter(enemy => arenaDistance(unit, enemy) <= shelter.ability.radius);
            const threat = this.shelterThreat(unit, shelter.ability);
            for (const enemy of affected) this.scene.addThreat(enemy, unit, threat);
            if (affected.length) this.scene.combatLog?.add('threat', `${unit.name}: Dawn's Shelter pulses on ${affected.length} enemies.`, {
              actorId: unit.id, abilityId: shelter.ability.id, targetIds: affected.map(enemy => enemy.id), generatedThreat: threat
            });
            shelter.next += shelter.ability.threatPulseInterval;
          }
          if (time >= shelter.until) delete unit.status.replacementShelter;
        }
      }
      this.initializePotion(unit);
      unit.status.replacementEffects = (unit.status.replacementEffects ?? []).filter(effect => effect.until > time);
      refreshReplacementTiming(unit, time);
      const channel = unit.status.replacementChannel;
      if (unit.alive && channel) {
        while (channel.remaining && channel.next <= time) {
          this.mana(unit, unit.maxMana * channel.ability.secondary.potency / Math.max(1, Math.ceil(channel.ability.duration / channel.ability.tickInterval)));
          channel.remaining--; channel.next = Math.min(channel.until, channel.next + channel.ability.tickInterval);
        }
        if (time >= channel.until) {
          this.scene.combatLog?.diagnostics?.effectEvent('channel_completed', channel, { actorId: unit.id });
          unit.status.replacementChannel = null;
          this.resolve(unit, unit, { ...channel.ability, handler: 'nextSpellBoost', duration: channel.ability.secondaryDuration }, time);
        }
      }
      for (const tick of unit.status.replacementPeriodic ?? []) {
        const owner = this.unit(tick.ownerId);
        while (owner && unit.alive && tick.remaining > 0 && tick.next <= time) {
          tick.remaining--; tick.next = Math.min(tick.until, tick.next + tick.interval);
          const applyTick = () => {
            if (tick.kind === 'damage') this.damage(owner, unit, tick.amount, tick.ability, true, { periodic: true });
            else if (tick.kind === 'heal') this.heal(owner, unit, tick.amount, tick.ability, true);
            else this.mana(unit, tick.amount);
          };
          if (this.scene.combatLog?.diagnostics?.enabled) this.scene.combatLog.diagnostics.effectCause(tick, owner, applyTick);
          else applyTick();
        }
      }
      unit.status.replacementPeriodic = (unit.status.replacementPeriodic ?? []).filter(tick => tick.remaining > 0 && unit.alive);
      this.tickZones(unit, time);
    }
    this.scene.abilityDecoys = (this.scene.abilityDecoys ?? []).filter(decoy => {
      if (!decoy.alive || decoy.decoyUntil <= time || decoy.decoyWave !== this.scene.currentWaveIndex) {
        retireUmbralDecoy(this.scene, decoy);
        return false;
      }
      decoy.syncPresentation?.(); return true;
    });
  }

  // Persistent fields show their actual floor footprint. Views are derived from saved
  // zone records, omitted during catch-up, and destroyed at expiry or scene shutdown.
  drawZones(time) {
    const scene = this.scene;
    if (!scene.add || scene.idleSimulating || scene.game?.backgroundProgress?.isReplaying) return;
    const visible = new Set();
    for (const owner of scene.partyUnits) for (const zone of owner.status.replacementZones ?? []) {
      if (!owner.alive || zone.until <= time || zone.wave !== scene.currentWaveIndex || scene.battleOver) continue;

      // The pixel aura already shows its exact floor footprint and fades at expiry.
      // Drawing another solid ellipse here would duplicate the same field.
      const artwork = findAbilityEffect(owner, zone.ability);

      // The Ranger's steel jaws already show the placed trap. Their own fade
      // leaves a spent trap remnant without an abruptly removed cosmetic circle.

      // Temporary rune overlays use the saved gameplay radius, independent of sprite scale.
      const debugRangeColor = artwork?.debugRangeColor;
      if ((artwork?.floorAura || artwork?.replacesZoneView) && debugRangeColor == null) continue;
      const key = `${owner.id}:${zone.ability.id}`;
      visible.add(key);
      const center = zone.ability.anchor === 'Caster' ? owner : zone.point;
      const point = scene.battlefield.arenaToScreen(center.arenaX, center.arenaY);
      const radii = scene.battlefield.getGroundEllipseRadii(zone.ability.radius, center.arenaY);
      let view = this.zoneViews.get(key);
      if (!view) {
        const color = debugRangeColor ?? (zone.ability.handler === 'healingAura' ? 0x22c55e : owner.color ?? 0x9f8a59);
        view = scene.add.ellipse(point.x, point.y, radii.width * 2, radii.height * 2, color, .16).setStrokeStyle(4, color, .8);
        this.zoneViews.set(key, view);
      }
      view.setPosition(point.x, point.y).setDisplaySize(radii.width * 2, radii.height * 2).setDepth(40 + point.y);
    }
    for (const [key, view] of this.zoneViews) if (!visible.has(key)) { view.destroy(); this.zoneViews.delete(key); }
  }

  tickZones(owner, time) {
    for (const zone of owner.status.replacementZones ?? []) {
      if (!owner.alive || zone.wave !== this.scene.currentWaveIndex) continue;
      if (isRune(zone.ability)) {
        if (this.scene.combatLog?.diagnostics?.enabled) this.scene.combatLog.diagnostics.effectCause(zone, owner, () => tickRune(this, owner, zone, time));
        else tickRune(this, owner, zone, time);
        continue;
      }
      const a = zone.ability, healing = a.handler === 'healingAura';
      const targets = (healing ? this.allies() : this.enemies()).filter(t => arenaDistance(t, a.anchor === 'Caster' ? owner : zone.point) <= a.radius);
      for (const enemy of this.enemies()) if (zone.inside[enemy.id] && !targets.includes(enemy)) { zone.exitedAt[enemy.id] = time; delete zone.inside[enemy.id]; }
      for (const target of targets) {
        if (a.handler === 'entryStunZone' && !zone.inside[target.id] && (zone.exitedAt[target.id] === undefined || time - zone.exitedAt[target.id] >= 2000)) this.control(target, a, 'stun', a.secondaryDuration);
        zone.inside[target.id] = true;
        if (a.handler === 'poisonTrap') { this.periodic(owner, target, a, replacementAmount(owner, target, a.primary), 'damage', a.secondaryDuration); zone.until = 0; break; }
        if (a.handler === 'slowGroundZone' || a.handler === 'slowDamageZone') this.modifier(target, owner, a, { movement: -a.primary.potency }, 100, true);
      }
      while (time >= zone.next && zone.next <= zone.until && a.handler !== 'entryStunZone' && a.handler !== 'poisonTrap') {
        const interval = a.tickInterval || 1000;
        const elapsed = zone.next - (zone.lastAt ?? zone.startedAt);
        zone.lastAt = zone.next;
        zone.next = zone.next >= zone.until ? Infinity : Math.min(zone.until, zone.next + interval);
        for (const target of targets) {
          if (healing) this.heal(owner, target, replacementAmount(owner, target, a.primary) * elapsed / a.duration, a, true);
          if (a.handler === 'slowDamageZone') this.damage(owner, target, replacementAmount(owner, target, a.secondary) * elapsed / a.duration, { ...a, damageType: 'spell' }, true, { periodic: true });
        }
      }
    }
    owner.status.replacementZones = (owner.status.replacementZones ?? []).filter(zone => owner.alive && zone.until > time && zone.wave === this.scene.currentWaveIndex);
  }

  // Enemy control changes one targeting decision, without adding monsters to the party.
  forcedTarget(enemy) {
    const forced = enemy.status.replacementForcedAttack;
    if (forced?.until > this.now()) return this.enemies().find(unit => unit.id === forced.targetId);
    const decoy = enemy.status.replacementDecoyTarget;
    if (decoy?.until > this.now()) return this.scene.abilityDecoys?.find(unit => unit.id === decoy.id && unit.alive);
    return null;
  }

  // Store only plain combat data so a paused shield can resume from a battle save.
  // Removing the record before damage prevents another reaction from bursting it twice.
  shieldDamaged(target) {
    const shield = target.status.replacementShieldBurst;
    if (!shield || target.status.temporaryHp > 0) return;
    delete target.status.replacementShieldBurst;
    const owner = this.unit(shield.ownerId);
    if (!owner || shield.until <= this.now()) return;
    for (const enemy of this.enemies()) {
      if (arenaDistance(target, enemy) > shield.ability.radius) continue;
      this.damage(owner, enemy, replacementAmount(owner, enemy, shield.ability.secondary), shield.ability, true);
    }
  }

  actionCommitted(unit) {
    if (this.reactionDepth) return;
    for (const reaction of unit.status.replacementReactions ?? []) if (reaction.kind === 'damageActionPunishment' && reaction.until > this.now()) {
      const owner = this.unit(reaction.ownerId);
      if (owner?.alive) this.damage(owner, unit, replacementAmount(owner, unit, reaction.ability.secondary), reaction.ability, true);
    }
  }

  // Reaction depth suppresses recursive reflections, potion chains, and free triggered
  // spells. Per-record timestamps also prevent a multi-target hit from triggering twice.
  afterDamage(attacker, target, amount, critical, blocked, contact) {

    // Any actual damage interrupts meditation, including a periodic or reflected hit.
    // Reaction suppression only prevents chained effects, not ordinary interruption.
    if (amount > 0 && target.status.replacementChannel) { this.scene.combatLog?.diagnostics?.effectEvent('channel_interrupted', target.status.replacementChannel, { targetId: target.id, reasonCode: 'damage', cause: this.scene.combatLog?.diagnostics?.cause(attacker, contact?.abilityName) }); target.status.replacementChannel = null; target.status.rootedUntil = this.now(); }
    if (this.reactionDepth || contact?.replacementTriggered) return;
    this.reactionDepth++;
    try {
      runesAfterDamage(this, attacker, target, amount, critical, contact);
      const coating = attacker.status.replacementPoisonWeapon;
      if (amount > 0 && target.isEnemy && coating?.until > this.now() && contact?.abilityName === 'Attack') {
        this.periodic(attacker, target, coating.ability, replacementAmount(attacker, target, coating.ability.primary), 'damage', coating.ability.secondaryDuration);
      }
      for (const reaction of target.status.replacementReactions ?? []) {
        const owner = this.unit(reaction.ownerId), a = reaction.ability;
        if (!owner?.alive || reaction.until <= this.now() || reaction.kind !== 'blockStun' && reaction.lastAt >= this.now()) continue;
        const kind = reaction.kind;
        let reacted = false;
        if (kind === 'conditionalHeal' && target.alive && amount > 0 && target.hp / target.maxHp < .25) { reaction.until = 0; this.heal(owner, target, replacementAmount(owner, target, a.primary), a, true); reacted = true; }
        if (kind === 'blockStun' && blocked) {
          const attackers = reaction.attackerLastAt ??= {};
          if (this.now() - (attackers[attacker.id] ?? -Infinity) >= 1000) {
            this.control(attacker, a, 'stun', a.secondaryDuration);
            attackers[attacker.id] = this.now(); reacted = true;
          }
        }
        if ((kind === 'shieldReflect' || kind === 'reflectLinkedHeal') && amount > 0) {
          const fraction = kind === 'shieldReflect' ? a.secondary.potency : a.primary.potency;
          const reflected = this.damage(owner, attacker, amount * fraction, { ...a, damageType: contact?.physical ? 'physical' : 'spell' }, true, { measured: true, periodic: true }).amount;
          if (kind === 'reflectLinkedHeal') this.heal(owner, target, reflected * a.secondary.potency, a, true);
          reacted = true;
        }
        if (kind === 'counterattackWindow' && amount > 0 && contact?.physical) { this.damage(owner, attacker, replacementAmount(owner, attacker, a.primary), { ...a, criticalBonus: a.secondary.potency, damageType: 'physical' }, true); reacted = true; }
        if (kind === 'reactiveSiphon' && amount > 0) {
          const siphon = this.trainedSkill(owner, 'Siphon');
          if (siphon && arenaDistance(owner, attacker) <= siphon.range * 100 && this.now() - reaction.lastAt >= 1000) {
            this.resolve(owner, attacker, { ...siphon, primary: { ...siphon.primary, potency: siphon.primary.potency * a.primary.potency }, secondary: { ...siphon.secondary, potency: siphon.secondary.potency * a.primary.potency } }, this.now(), true);
            reacted = true;
          }
        }

        // Unrelated hits do not restart a reaction's internal cooldown. Only an actual
        // trigger starts its timer, even when the recipient is being hit very rapidly.
        if (reacted) reaction.lastAt = this.now();
      }
      if (critical && amount > 0 && target.alive && !target.isEnemy && !target.isDecoy) for (const owner of this.allies()) {
        for (const reaction of owner.status.replacementReactions ?? []) if (reaction.kind === 'criticalPotionReaction' && reaction.until > this.now() && this.now() - reaction.lastAt >= 1000) {
          const pack = this.potion(owner);
          if (pack?.definition.effect.resource === 'hp' && arenaDistance(owner, target) <= reaction.ability.range * 100 && this.consumePotion(owner)) {
            const recovered = this.heal(owner, target, target.maxHp * pack.definition.effect.fraction * reaction.ability.primary.potency, reaction.ability, true);

            // Pour artwork forms on the actually healed ally. Healing stays at
            // its original critical-hit timestamp with no added flight delay.
            if (recovered > 0 && reaction.ability.id === 'ability_v2_barmaid_quick_pour') {
              this.scene.createAbilityEffect?.(owner, target, { ...reaction.ability, vfxPhase: 'heal' }, [target]);
            }
            reaction.lastAt = this.now();
          }
        }
      }
    } finally { this.reactionDepth--; }
  }

  // Called after defenses and before HP subtraction, so lethal protection uses the same
  // post-defense damage as the ordinary hit and is consumed exactly once.
  preventLethal(target, incoming) {
    if (this.reactionDepth || incoming < target.hp) return incoming;
    const reaction = target.status.replacementReactions?.find(r => r.kind === 'lethalExchange' && r.until > this.now());
    const owner = reaction && this.unit(reaction.ownerId);
    if (!owner?.alive) return incoming;
    reaction.until = 0;
    const allowed = Math.max(0, target.hp - 1);
    target.status.replacementPendingExchange = { ownerId: owner.id, ability: reaction.ability, amount: incoming - allowed };
    return allowed;
  }

  finishExchange(target) {
    const pending = target.status.replacementPendingExchange;
    if (!pending) return;
    delete target.status.replacementPendingExchange;
    const owner = this.unit(pending.ownerId), enemies = this.enemies();
    if (!owner) return;
    this.reactionDepth++;
    try {
      this.heal(owner, target, replacementAmount(owner, target, pending.ability.primary), pending.ability, true);
      const enemy = enemies[Math.floor(this.scene.combatRandom() * enemies.length)];
      if (enemy) this.damage(owner, enemy, pending.amount * pending.ability.secondary.potency, { ...pending.ability, damageType: 'spell' }, true, { measured: true });
    } finally { this.reactionDepth--; }
  }
}
