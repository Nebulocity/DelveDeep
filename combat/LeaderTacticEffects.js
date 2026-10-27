import { isMageClass } from '../config/characterProgression.js';
import { refreshReplacementTiming } from './ReplacementEffects.js';

const fraction = (unit, resource) => resource === 'mana' ? unit.mana / unit.maxMana : unit.hp / unit.maxHp;
export const tacticCanRevive = ability => ['arise', 'revive'].includes(ability?.id)
  || ability?.effects?.some(effect => effect.kind === 'revive');

export function tacticEffectRecipients(scene, effect) {
  let units = scene.partyUnits.filter(unit => effect.kind === 'revive'
    ? !unit.alive && !unit.delvesUsed?.honorSacrifice : unit.alive);
  if (effect.scope === 'physical') units = units.filter(unit => ['Tank', 'Melee DPS'].includes(unit.role) || unit.className === 'Ranger');
  if (['magical', 'mana', 'lowestMana'].includes(effect.scope)) units = units.filter(unit => unit.maxMana > 0);
  if (effect.scope === 'mages') units = units.filter(unit => isMageClass(unit.className) || unit.className === 'Runedancer');
  if (effect.scope === 'tanks') units = units.filter(unit => unit.role === 'Tank');
  if (['wounded', 'lowestMana'].includes(effect.scope)) {
    const resource = effect.scope === 'lowestMana' ? 'mana' : 'hp';
    units.sort((a, b) => fraction(a, resource) - fraction(b, resource) || a.id.localeCompare(b.id));
  }
  return units.slice(0, effect.kind === 'cleanse' ? undefined : effect.count ?? (effect.scope === 'wounded' ? 1 : undefined));
}

export function expandedTacticRecipients(scene, ability) {
  return [...new Set(ability.effects.flatMap(effect => tacticEffectRecipients(scene, effect).map(unit => unit.id)))];
}

export function expandedTacticHasBenefit(scene, ability) {
  const system = scene.classAbilitySystem?.replacement;
  return ability.effects.some((effect, index) => tacticEffectRecipients(scene, effect).some(unit => {
    if (effect.kind === 'heal') return unit.hp < unit.maxHp;
    if (effect.kind === 'mana') return unit.mana < unit.maxMana;
    if (effect.kind === 'revive') return true;
    if (effect.kind === 'cleanse') return system?.hasRemovableHarm(unit);
    if (effect.kind === 'strike') return scene.getLivingEnemies().length > 0;
    if (effect.kind === 'supplies') {
      const pack = system?.potion(unit);
      return pack && pack.item.charges < pack.saved.capacity;
    }
    if (effect.kind === 'refresh') return system?.runningCooldowns(unit, effect.category).length > 0;
    if (effect.kind === 'buff') return !(unit.status.replacementEffects ?? [])
      .some(record => record.key === `leader:${ability.id}:${index}` && record.until > scene.time.now);
    return false;
  }));
}

// No resource is spent here. The caller checks readiness and useful recipients first,
// then applies and commits once. Paused plans use the same function after Resume.
export function applyExpandedTactic(scene, ability) {
  const system = scene.classAbilitySystem?.replacement;
  const now = scene.time.now;
  const affected = new Set(), targets = new Set();

  // Capture wound-based choices before healing changes their order. Party-wide effects
  // still discover newly revived allies later in the same tactic.
  const selected = ability.effects.map(effect => ['wounded', 'lowestMana'].includes(effect.scope)
    ? tacticEffectRecipients(scene, effect) : null);
  ability.effects.forEach((effect, index) => {
    const units = selected[index] ?? tacticEffectRecipients(scene, effect);
    if (effect.kind === 'strike') {
      if (!units.length) return;
      const power = unit => effect.school === 'melee' ? unit.attackPower ?? 0
        : effect.school === 'spell' ? unit.spellPower ?? 0 : Math.max(unit.attackPower ?? 0, unit.spellPower ?? 0);
      const caster = [...units].sort((a, b) => power(b) - power(a) || a.id.localeCompare(b.id))[0];
      const damage = units.reduce((sum, unit) => sum + power(unit), 0) / units.length * effect.potency;
      const enemies = scene.getLivingEnemies().sort((a, b) => Number(b.id === scene.focusTargetId) - Number(a.id === scene.focusTargetId)
        || a.hp - b.hp || a.id.localeCompare(b.id)).slice(0, effect.targets);
      for (const target of enemies) {
        scene.resolveDamage(caster, target, damage, effect.school === 'melee' ? 'melee' : 'spell', 1, ability.name, false,
          { replacementTriggered: true });
        targets.add(target.id);
      }
      if (enemies.length) units.forEach(unit => affected.add(unit.id));
      return;
    }
    for (const unit of units) {
      if (effect.kind === 'buff') {
        const key = `leader:${ability.id}:${index}`;
        const effects = unit.status.replacementEffects ??= [];
        const current = effects.find(record => record.key === key);
        const record = { key, ownerId: unit.id, until: now + effect.duration,
          changes: { ...effect.changes }, harmful: false, removable: true };
        if (current) Object.assign(current, record); else effects.push(record);
        refreshReplacementTiming(unit, now);
      } else if (effect.kind === 'heal') {
        if (unit.hp >= unit.maxHp) continue;
        const before = unit.hp;
        unit.heal(Math.round(unit.maxHp * effect.fraction));
        scene.createFloatingText(unit.x, unit.y - 80, `+${Math.round(unit.hp - before)} HP`, '#86efac');
      } else if (effect.kind === 'mana') {
        if (unit.mana >= unit.maxMana) continue;
        const before = unit.mana;
        unit.mana = Math.min(unit.maxMana, unit.mana + Math.round(unit.maxMana * effect.fraction));
        scene.createFloatingText(unit.x, unit.y - 80, `+${Math.round(unit.mana - before)} MANA`, '#c4b5fd');
      } else if (effect.kind === 'cleanse') {
        if (!system?.hasRemovableHarm(unit)) continue;
        system.cleanse(unit, effect.count);
      } else if (effect.kind === 'refresh') {
        if (!system?.runningCooldowns(unit, effect.category).length) continue;
        system.reduceCooldowns(unit, effect.fraction, effect.category);
      } else if (effect.kind === 'supplies') {
        const pack = system?.potion(unit);
        if (!pack || pack.item.charges >= pack.saved.capacity) continue;
        system.refill(unit, effect.count / pack.saved.capacity);
      } else if (effect.kind === 'revive') {
        unit.revive(effect.fraction, effect.fraction);
        scene.manualTargets.delete(unit.id);
        scene.attackTargets.delete(unit.id);
        scene.heldUnitIds.delete(unit.id);
        scene.announceAbility(unit, ability.shortName, '#fff1d2');
        scene.awaitingRevive = false;
      }
      affected.add(unit.id);
    }
  });
  scene.updateHud();
  return { affectedRecipientIds: [...affected], affectedTargetIds: [...targets] };
}
