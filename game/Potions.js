// Resource fractions and flat points are authored separately. The cap prevents a
// level-1 consumable from becoming a full heal as monster and hero levels increase.
import { statDisplayNumber } from './StatDisplay.js';

export function potionRecovery(unit, effect, multiplier = 1) {
  const maximum = effect.resource === 'hp' ? unit.maxHp : unit.maxMana;
  if (!(maximum > 0)) return 0;
  return Math.max(0, Math.round(Math.min(effect.maxRestore ?? Infinity,
    maximum * effect.fraction + (effect.flat ?? 0)) * multiplier));
}

// The existing map is saved with the battle. Use combat milliseconds so pausing,
// background resolution and reloads all preserve the same item-use deadline.
export function potionCooldownRemaining(scene, unit, definition, time = scene.time.now) {
  return Math.max(0, (scene.lastPotionUseAt?.get(unit.id) ?? -Infinity) + definition.cooldown - time);
}

export function startPotionCooldown(scene, unit, time = scene.time.now) {
  scene.lastPotionUseAt ??= new Map();
  scene.lastPotionUseAt.set(unit.id, time);
}

export function potionHasBenefit(scene, unit, definition, time = scene.time.now) {
  const missing = effect => effect.resource === 'hp' ? unit.hp < unit.maxHp
    : unit.maxMana > 0 && unit.mana < unit.maxMana;
  if (missing(definition.effect)) return true;
  const secondary = definition.effect.secondary;
  if (secondary?.kind === 'restore') return missing(secondary);
  if (secondary?.kind === 'cleanse') return Boolean(scene.classAbilitySystem?.replacement?.hasRemovableHarm(unit));
  if (secondary?.kind === 'ward') {
    const ward = unit.status.potionWard;
    return !ward || ward.until <= time || ward.amount < secondary.amount;
  }
  return false;
}

// The reaction system can supply its healing resolver while manual use retains direct
// item healing. Both paths deliver the same capped recovery and secondary benefits.
export function applyPotionEffects(scene, unit, definition, time = scene.time.now, multiplier = 1, restoreHp) {
  const result = { hp: 0, mana: 0, ward: 0 };
  const restore = effect => {
    const amount = potionRecovery(unit, effect, multiplier);
    const resource = effect.resource;
    const before = resource === 'hp' ? unit.hp : unit.mana;
    if (resource === 'hp') {
      if (restoreHp) restoreHp(amount);
      else unit.heal(amount);
    } else unit.mana = Math.min(unit.maxMana, unit.mana + amount);
    result[resource] += Math.max(0, Math.round((resource === 'hp' ? unit.hp : unit.mana) - before));
  };
  restore(definition.effect);
  const secondary = definition.effect.secondary;
  if (secondary?.kind === 'restore') restore(secondary);
  if (secondary?.kind === 'cleanse') scene.classAbilitySystem?.replacement?.cleanse(unit, secondary.count);
  if (secondary?.kind === 'ward') {
    // Potion barriers have their own pool so drinking never extends a class shield.
    const current = unit.status.potionWard;
    const amount = Math.round(secondary.amount * multiplier);
    if (!current || current.until <= time || amount >= current.amount) {
      unit.status.potionWard = { amount, until: time + secondary.duration };
      result.ward = amount;
    }
  }
  return result;
}

export function potionEffectDescription(definition) {
  const recovery = effect => `${statDisplayNumber(effect.fraction * 100)}% of maximum ${effect.resource === 'hp' ? 'Health' : 'Mana'}${effect.flat ? ` + ${statDisplayNumber(effect.flat)}` : ''}${effect.maxRestore ? ` (up to ${statDisplayNumber(effect.maxRestore)})` : ''}`;
  const lines = [`Restores ${recovery(definition.effect)} to the user.`];
  const secondary = definition.effect.secondary;
  if (secondary?.kind === 'restore') lines.push(`Also restores ${recovery(secondary)}.`);
  if (secondary?.kind === 'cleanse') lines.push(`Removes up to ${secondary.count} harmful condition${secondary.count === 1 ? '' : 's'}.`);
  if (secondary?.kind === 'ward') lines.push(`Absorbs ${statDisplayNumber(secondary.amount)} damage for ${secondary.duration / 1000} seconds. Potion barriers do not stack.`);
  lines.push(`${definition.cooldown / 1000}-second cooldown per adventurer, shared with triggered potion uses.`);
  return lines.join(' ');
}
