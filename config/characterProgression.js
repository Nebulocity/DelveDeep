// We build character stats from a level-1 profile and the gains for each extra level. A
// fraction such as 0.05 means five percent for chance stats. Skill potency uses whole
// percentages instead, so 150 means one and a half times the relevant power. Keep those
// two scales separate. Base attributes are already included in the starting profile; only
// gained attributes add growth.

export const ATTRIBUTE_STATS = ['strength', 'agility', 'constitution', 'intellect', 'wisdom'];
export const CHANCE_STATS = ['dodge', 'block', 'critChance', 'hitChance'];

export const CHANCE_LIMITS = {
  dodge: { soft: 0.2, hard: 0.3 }, block: { soft: 0.25, hard: 0.35 },
  critChance: { soft: 0.25, hard: 0.4 }, hitChance: { soft: 0.15, hard: 0.2 }
};

// Above the soft cap, additional chance contributes at one quarter of its normal rate.
export function cappedChance(stat, value) {

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { soft, hard } = CHANCE_LIMITS[stat];

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound. The condition before ? chooses the first value when
  // true and the value after : when false.
  return Math.max(0, Math.min(hard, value <= soft ? value : soft + (value - soft) * 0.25));
}

const common = { speed: 100, hitChance: 0, critChance: 0, critMultiplier: 1.3, happiness: 80, delvesCompleted: 0 };

// ... copies the source's own fields into this object; fields listed later replace earlier
// ones. This is a shallow copy, so nested objects are still shared.
const tank = { ...common, maxHp: 500, maxMana: 0, armor: 100, dodge: 0.05, block: 0.05,
  strength: 20, agility: 20, constitution: 20, intellect: 10, wisdom: 10,
  attackPower: 250, spellDamage: 0, spellHealing: 0 };
const melee = { ...common, maxHp: 350, maxMana: 0, armor: 50, dodge: 0.02, block: 0.02,
  strength: 30, agility: 30, constitution: 15, intellect: 10, wisdom: 10,
  attackPower: 500, spellDamage: 0, spellHealing: 0 };
const mage = { ...melee, maxHp: 150, maxMana: 500, strength: 15, agility: 15, intellect: 40, wisdom: 30,
  attackPower: 50, spellDamage: 500, spellHealing: 350 };

const healer = { ...common, maxHp: 250, maxMana: 500, armor: 30, dodge: 0.02, block: 0,
  strength: 15, agility: 15, constitution: 20, intellect: 30, wisdom: 40,
  attackPower: 100, spellDamage: 350, spellHealing: 500 };

export const PROGRESSION_PROFILES = {
  Tank: { base: tank, growth: { maxHp: 20, maxMana: 0, strength: 1.5, agility: 0.5, constitution: 2, intellect: 0.25, wisdom: 0.5 } },
  Melee: { base: melee, growth: { maxHp: 12, maxMana: 0, strength: 2, agility: 1.5, constitution: 1, intellect: 0.25, wisdom: 0.25 } },
  Ranged: { base: melee, growth: { maxHp: 10, maxMana: 0, strength: 1, agility: 2, constitution: 0.75, intellect: 0.25, wisdom: 0.25 } },
  Mage: { base: mage, growth: { maxHp: 6, maxMana: 15, strength: 0.25, agility: 0.5, constitution: 0.5, intellect: 2, wisdom: 1 } },

  Healer: { base: healer, growth: { maxHp: 8, maxMana: 15, strength: 0.25, agility: 0.5, constitution: 1, intellect: 1, wisdom: 2 } },

  Dawnwarden: { base: { ...tank, maxMana: 250, wisdom: 40, spellDamage: 150, spellHealing: 150 },
    growth: { maxHp: 18, maxMana: 10, strength: 1, agility: 0.5, constitution: 1.5, intellect: 0.5, wisdom: 1.5 } }
};

export const CLASS_PROGRESSION = {
  Gladiator: 'Tank', Oathwarden: 'Tank', Dawnwarden: 'Dawnwarden',
  Barmaid: 'Melee', Scoundrel: 'Melee', Barbarian: 'Melee', Ranger: 'Ranged',
  'Mage of the Umbral Veil': 'Mage', 'Mage of the Crimson Spire': 'Mage', 'Mage of the Luminous Archive': 'Mage',
  'Cleric of the Everbright': 'Healer', 'Cleric of the Verdant Covenant': 'Healer', 'Cleric of the Sanguine Song': 'Healer'
};

// Choose the class growth profile and apply any class-specific starting stat override.
export function progressionProfile(className) {
  const profile = PROGRESSION_PROFILES[CLASS_PROGRESSION[className]];
  if (!profile) return null;

  // ... copies the source's own fields into this object; fields listed later replace
  // earlier ones. This is a shallow copy, so nested objects are still shared. The
  // condition before ? chooses the first value when true and the value after : when false.
  return { ...profile, base: className === 'Gladiator' ? { ...profile.base, dodge: 0.1, block: 0 } : profile.base };
}

// Add each attribute's per-level growth for levels above one.
export function progressionAttributes(className, level = 1) {
  const profile = progressionProfile(className);
  if (!profile) return null;

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  const gained = Math.max(0, level - 1);

  // Object.fromEntries turns [key, value] pairs back into an object. A later pair with the
  // same key replaces the earlier value. map builds one output entry for each input entry,
  // in the same order. The callback's return value becomes that output entry.
  return Object.fromEntries(ATTRIBUTE_STATS.map((stat) => [stat, profile.base[stat] + profile.growth[stat] * gained]));
}

// Combine the starting profile, level growth and gained attribute bonuses into current
// combat totals.
export function progressionResources(className, level = 1, attributeBonuses = {}) {
  const profile = progressionProfile(className);
  if (!profile) return null;

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  const gained = Math.max(0, level - 1);
  const attributes = progressionAttributes(className, level);

  // Object.fromEntries turns [key, value] pairs back into an object. A later pair with the
  // same key replaces the earlier value. map builds one output entry for each input entry,
  // in the same order. The callback's return value becomes that output entry.

  // delta means gains above the level-1 attributes, including current gear bonuses.
  // Starting attributes already contributed to base stats, so subtract them before
  // deriving extra HP, Armor, power or chances. This prevents counting them twice.
  const delta = Object.fromEntries(ATTRIBUTE_STATS.map((stat) => {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    attributes[stat] += attributeBonuses[stat] ?? 0;
    return [stat, attributes[stat] - profile.base[stat]];
  }));
  const agilityAttacker = ['Scoundrel', 'Ranger'].includes(className);

  // ... copies the source's own fields into this object; fields listed later replace
  // earlier ones. This is a shallow copy, so nested objects are still shared. The
  // condition before ? chooses the first value when true and the value after : when false.
  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  return {
    ...profile.base,
    ...attributes,

    // Each extra level adds the profile's HP growth; gained Constitution adds 10 HP
    // and 10 Armor per point. Mana users add 5 Mana per gained Intellect or Wisdom.
    // A class with no base Mana stays without a Mana resource.
    maxHp: profile.base.maxHp + gained * profile.growth.maxHp + delta.constitution * 10,
    maxMana: profile.base.maxMana > 0 ? profile.base.maxMana + gained * profile.growth.maxMana + (delta.intellect + delta.wisdom) * 5 : 0,
    armor: profile.base.armor + delta.constitution * 10,

    // Each gained Strength adds 8 Attack Power. Scoundrels and Rangers also gain
    // 6 Attack Power per Agility. Intellect adds Spell Damage, and Wisdom adds
    // Spell Healing, each at 8 power per gained point.
    attackPower: profile.base.attackPower + delta.strength * 8 + (agilityAttacker ? delta.agility * 6 : 0),
    spellDamage: profile.base.spellDamage + delta.intellect * 8,
    spellHealing: profile.base.spellHealing + delta.wisdom * 8,

    // Chance values are fractions: 0.0008 is 0.08 percentage points, not 8%.
    // Add the base chance, attribute gains and direct gear bonus, then apply the
    // shared soft/hard cap. AGI/WIS/INT gains all contribute to shared crit chance.
    dodge: cappedChance('dodge', profile.base.dodge + delta.agility * 0.0008 + (attributeBonuses.dodge ?? 0)),
    block: cappedChance('block', profile.base.block + delta.strength * 0.0005 + (attributeBonuses.block ?? 0)),
    critChance: cappedChance('critChance', profile.base.critChance + (delta.agility + delta.intellect + delta.wisdom) * 0.0005 + (attributeBonuses.critChance ?? 0)),
    hitChance: cappedChance('hitChance', profile.base.hitChance + delta.agility * 0.0005 + (attributeBonuses.hitChance ?? 0))
  };
}

// Convert Armor rating into its physical damage reduction using rating / (rating + 400).
export function armorReduction(rating) {

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound. ?? uses the fallback only for null or undefined. A
  // real zero or false stays intact.
  const armor = Math.max(0, rating ?? 0);
  return armor / (armor + 400);
}
