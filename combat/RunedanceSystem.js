// Runes are saved as ordinary replacementZones. Their fixed arena point never follows
// a walking caster. Rendering derives from these records, including after battle reload.
import { arenaDistance } from '../config/combatRanges.js';
import { replacementAmount } from './ReplacementEffects.js';

export const isRune = ability => ability?.handler?.startsWith('rune');
const strikeKinds = ['runeCadence', 'runeFlourish', 'runeTraverse', 'runeFinale'];

// Refresh one placed rune per skill. The wave and combat deadline keep old runes from
// affecting later waves, and a spent rune is removed before triggering other damage.
function place(system, caster, point, ability, time) {
  caster.status.replacementZones = (caster.status.replacementZones ?? [])
    .filter(zone => zone.ability.id !== ability.id);
  caster.status.replacementZones.push({ ability, point: { arenaX: point.arenaX, arenaY: point.arenaY },
    until: time + ability.duration, startedAt: time, next: time + 1000,
    wave: system.scene.currentWaveIndex, inside: {}, exitedAt: {} });
  system.scene.combatLog?.diagnostics?.effectApplied(caster.status.replacementZones.at(-1), caster, ability, 'rune', caster);
  system.scene.createAbilityEffect?.(caster, caster, ability);
}

// Strike skills use current combat powers; utility skills simply place their rune.
// Traverse uses the same legal floor and occupancy checks as other teleports.
export function resolveRune(system, caster, target, ability, time) {
  const kind = ability.handler;
  if (!strikeKinds.includes(kind)) { place(system, caster, caster, ability, time); return; }
  const departure = { arenaX: caster.arenaX, arenaY: caster.arenaY };
  if (kind === 'runeTraverse' && !system.scene.isPositionLocked?.(caster)) {
    const points = system.parent.surroundingPoints(target, 75);
    const point = points.find(point => arenaDistance(caster, point) <= ability.range * 100
      && system.parent.canTeleport(caster, point));
    if (point) {

      // Keep the existing instant strike and fixed departure rune. The echo and
      // gemstone layers only decorate the already selected legal destination.
      system.scene.playTeleportEffect?.(caster, point, ability, caster);
      caster.setArenaPosition(point.x, point.y);
    }
  }

  // A held dancer can use Traverse only at weapon reach, so Hold never grants a ranged
  // sword strike. The targeting check normally prevents this case before Mana is spent.
  if (kind === 'runeTraverse' && arenaDistance(caster, target) > 110) return;
  const recipients = kind === 'runeFinale'
    ? system.enemies().filter(enemy => arenaDistance(caster, enemy) <= ability.radius) : [target];
  for (const enemy of recipients) {
    system.damage(caster, enemy, replacementAmount(caster, enemy, ability.primary), ability);
    if (kind === 'runeFinale') system.damage(caster, enemy, replacementAmount(caster, enemy, ability.secondary),
      { ...ability, damageType: 'spell' }, true);
    system.scene.createAbilityEffect?.(caster, enemy, { ...ability, vfxPhase: 'impact' }, [enemy]);
  }
  if (kind !== 'runeFinale') place(system, caster,
    kind === 'runeTraverse' ? departure : kind === 'runeCadence' ? caster : target, ability, time);
}

// AI casts a self rune only near combat. Prepared runes cannot replace an unspent rune.
export function runeTarget(system, unit, ability) {
  const time = system.now();
  if ((unit.status.replacementZones ?? []).some(zone => zone.ability.id === ability.id
    && zone.until > time && zone.wave === system.scene.currentWaveIndex)) return null;
  const near = system.enemies().filter(enemy => arenaDistance(unit, enemy) <= Math.max(ability.range * 100, 240));
  if (!near.length) return null;
  if (!strikeKinds.includes(ability.handler) || ability.handler === 'runeFinale') return unit;
  const preferred = system.scene.getPrimaryTarget(unit, false);
  const reach = ability.handler === 'runeTraverse' && system.scene.isPositionLocked?.(unit) ? 100 : ability.range * 100;
  return [preferred, ...near].find(enemy => enemy?.alive && arenaDistance(unit, enemy) <= reach) ?? null;
}

// Consume before applying effects. Triggered damage is marked so echoes, reflection and
// prepared runes cannot recursively trigger themselves or one another.
function burst(system, owner, zone, amount, root = false) {
  zone.until = 0;
  const ability = { ...zone.ability, damageType: 'spell' };
  for (const enemy of system.enemies().filter(enemy => arenaDistance(enemy, zone.point) <= ability.radius)) {
    system.damage(owner, enemy, amount ?? replacementAmount(owner, enemy, ability.primary), ability, true,
      { measured: amount !== undefined, periodic: true });
    if (root) system.control(enemy, ability, 'root', ability.secondaryDuration);
    system.scene.createAbilityEffect?.(owner, enemy, { ...ability, vfxPhase: 'impact' }, [enemy]);
  }
}

// Utility auras are refreshed only while inside. A 100 ms grace avoids flicker between
// simulation steps without granting a full-duration buff to somebody who leaves.
export function tickRune(system, owner, zone, time) {
  if (!owner.alive || zone.wave !== system.scene.currentWaveIndex) return;
  if (zone.until <= time && zone.ability.handler !== 'runeFlourish') return;
  const a = zone.ability, kind = a.handler;
  const allies = system.allies().filter(ally => arenaDistance(ally, zone.point) <= a.radius);
  const enemies = system.enemies().filter(enemy => arenaDistance(enemy, zone.point) <= a.radius);
  const diagnostics = system.scene.combatLog?.diagnostics;
  if (diagnostics?.enabled) {
    const key = allies.map(ally => ally.id).join(',');
    const meta = diagnostics.effects.get(zone);
    if (meta && meta.beneficiaries !== key) {
      diagnostics.effectEvent('rune_beneficiaries', zone, { actorId: owner.id,
        eligibleBeneficiaries: allies.map(ally => ally.id), enemyRecipients: enemies.map(enemy => enemy.id) });
      meta.beneficiaries = key;
    }
  }
  const stat = { runeMovement: 'movement', runeSpeed: 'speed', runeDamage: 'damage', runeReduction: 'reduction' }[kind];
  if (stat) for (const ally of allies) system.modifier(ally, owner, a,
    { [stat]: a.primary.potency * (stat === 'reduction' ? -1 : 1) }, Math.min(100, zone.until - time));
  if (kind === 'runeMercy') {
    const ally = allies.find(ally => ally.hp / ally.maxHp < 0.35);
    if (ally) {
      zone.until = 0;
      system.heal(owner, ally, replacementAmount(owner, ally, a.primary), a, true);
      system.scene.createAbilityEffect?.(owner, ally, { ...a, vfxPhase: 'impact' }, [ally]);
    }
  }
  if (kind === 'runeMana') {
    const ally = allies.find(ally => ally.maxMana > 0 && ally.mana / ally.maxMana < 0.7);
    if (ally) {

      // The renderer shatters the consumed gemstone at its original position.
      zone.until = 0;
      system.mana(ally, replacementAmount(owner, ally, a.primary));
    }
  }
  if ((kind === 'runeSnare' || kind === 'runeTraverse') && enemies.length) {
    burst(system, owner, zone, kind === 'runeTraverse' ? replacementAmount(owner, enemies[0], a.secondary) : undefined, kind === 'runeSnare');
  }
  if (kind === 'runeFlourish') while (zone.next <= time && zone.next <= zone.until) {
    zone.next += 1000;
    for (const enemy of enemies) system.damage(owner, enemy,
      replacementAmount(owner, enemy, a.secondary) * 1000 / a.duration, a, true, { periodic: true });
  }
}

// Runic Refrain and Cadence require a landed basic hit. A miss keeps the empowerment.
// The saved status flag gives the rare weapon one echo per ability, never a stack.
export function runesAfterDamage(system, attacker, target, amount, critical, contact) {
  if (amount <= 0 || contact?.periodic || contact?.replacementTriggered) return;
  if (contact?.abilityName === 'Attack' && target.isEnemy && !attacker.isEnemy) {
    const perk = attacker.equipmentPerks?.find(perk => perk.id === 'runic_refrain');
    if (perk && attacker.status.runicRefrainReady) {
      attacker.status.runicRefrainReady = false;
      const echo = { id: 'runic_refrain', name: 'Runic Refrain', damageType: 'spell', shape: 'None' };
      system.damage(attacker, target, amount * perk.amount, echo, true, { measured: true, periodic: true, runicEcho: true });
      system.scene.createAbilityEffect?.(attacker, target, { ...echo, vfxPhase: 'impact' }, [target]);
    }
    for (const zone of attacker.status.replacementZones ?? []) if (zone.ability.handler === 'runeCadence'
      && zone.until > system.now() && zone.wave === system.scene.currentWaveIndex
      && arenaDistance(attacker, zone.point) <= zone.ability.radius) {
      burst(system, attacker, zone, replacementAmount(attacker, target, zone.ability.secondary));
    }
  }
  if (critical && attacker.isEnemy && !target.isEnemy) {
    for (const owner of system.allies()) for (const zone of owner.status.replacementZones ?? []) {
      if (zone.ability.handler === 'runeMirror' && zone.until > system.now()
        && zone.wave === system.scene.currentWaveIndex && arenaDistance(target, zone.point) <= zone.ability.radius) {
        burst(system, owner, zone, amount * zone.ability.primary.potency);
      }
    }
  }
}
