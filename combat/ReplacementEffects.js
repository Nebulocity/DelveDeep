// Temporary modifiers live in plain saved records, with owner IDs instead of live links.
// We leave permanent stats untouched so expiry, reload, and equipment cannot stack them.

export function activeReplacementEffects(unit, time) {
  return (unit.status?.replacementEffects ?? []).filter(effect => effect?.until > time && effect.changes);
}

// Percent changes multiply a stat, while chance bonuses are added as percentage points.
// Different abilities can combine; the same named ability refreshes its existing record.
export function replacementMultiplier(unit, stat, time) {
  const effects = activeReplacementEffects(unit, time);

  // Movement slows use the strongest active slow rather than multiplying every field.
  // Field Dressing reduces that slow's strength; positive movement buffs still combine.
  if (stat === 'movement') {
    const slow = Math.min(1, ...effects.map(effect => 1 + Math.min(0, effect.changes.movement ?? 0)));
    const resistance = Math.min(.75, effects.reduce((sum, effect) => sum + (effect.changes.slowResistance ?? 0), 0));
    const bonus = effects.reduce((value, effect) => value * (1 + Math.max(0, effect.changes.movement ?? 0)), 1);
    return (1 - (1 - slow) * (1 - resistance)) * bonus;
  }
  return effects.reduce((value, effect) => value * (1 + (effect.changes[stat] ?? 0)), 1);
}

export function replacementChance(unit, stat, time) {
  return activeReplacementEffects(unit, time).reduce((value, effect) => value + (effect.changes[stat] ?? 0), 0);
}

// Each power basis has an explicit owner and unit. An unknown dynamic basis returns the
// measured value supplied by its handler, rather than inventing a damage or healing stat.
export function replacementAmount(caster, recipient, effect, measured = 0) {
  const basis = effect.basis;
  const values = {
    'Caster Attack Power': caster.attackPower,
    'Caster Spell Power': caster.spellPower ?? Math.max(caster.spellDamage ?? 0, caster.spellHealing ?? caster.healPower ?? 0),
    'Caster Spell Damage': caster.spellPower ?? caster.spellDamage,
    'Caster Spell Healing': caster.spellPower ?? caster.spellHealing,
    'Caster maximum Health': caster.maxHp,
    'Caster maximum Mana': caster.maxMana,
    'Recipient maximum Health': recipient?.maxHp,
    'Recipient maximum Mana': recipient?.maxMana,
    'Target maximum Mana': recipient?.maxMana
  };

  // Damage applies temporary spell modifiers at hit resolution. Healing has no damage
  // step, so apply its Spell Power modifier here once. Historical bases keep old rules.
  const modifier = basis === 'Caster Spell Power' && effect.healing
    ? replacementMultiplier(caster, 'spell', caster.scene?.time.now ?? 0) : 1;
  return Math.max(0, (values[basis] ?? measured) * effect.potency * modifier);
}

// Speed has already adjusted the constructor's timings. These temporary effects add
// only their own multiplier, keeping the original timing values in the saved unit model.
export function refreshReplacementTiming(unit, time) {
  if (!unit.status?.replacementEffects?.length && !unit.replacementTiming) return;
  const names = ['attackCooldown', 'attackWindup', 'healCooldown', 'healWindup'];
  unit.replacementTiming ??= Object.fromEntries(names.map(name => [name, unit[name]]));
  const speed = Math.max(0.1, replacementMultiplier(unit, 'speed', time));
  const windup = Math.max(0.1, replacementMultiplier(unit, 'windup', time));
  for (const name of names) unit[name] = unit.replacementTiming[name] / speed * (name.includes('Windup') ? windup : 1);
  for (const ability of Object.values(unit.abilities ?? {})) {
    ability.baseSpeedCooldown ??= ability.cooldown;
    ability.baseSpeedWindup ??= ability.windup;
    ability.cooldown = ability.baseSpeedCooldown / speed;
    ability.windup = Math.max(100, ability.baseSpeedWindup / speed * windup);
  }
}
