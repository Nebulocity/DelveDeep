export const ATTRIBUTE_STATS = ['strength', 'agility', 'constitution', 'intellect', 'wisdom'];
export const CHANCE_STATS = ['dodge', 'block', 'critChance', 'hitChance'];
export const CHANCE_LIMITS = {
  dodge: { soft: 0.2, hard: 0.3 }, block: { soft: 0.25, hard: 0.35 },
  critChance: { soft: 0.25, hard: 0.4 }, hitChance: { soft: 0.15, hard: 0.2 }
};

// Above the soft cap, additional chance contributes at one quarter of its normal rate.
export function cappedChance(stat, value) {
  const { soft, hard } = CHANCE_LIMITS[stat];
  return Math.max(0, Math.min(hard, value <= soft ? value : soft + (value - soft) * 0.25));
}

const common = { speed: 100, hitChance: 0, critChance: 0, critMultiplier: 1.3, happiness: 80, delvesCompleted: 0 };
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

export function progressionProfile(className) {
  const profile = PROGRESSION_PROFILES[CLASS_PROGRESSION[className]];
  if (!profile) return null;
  return { ...profile, base: className === 'Gladiator' ? { ...profile.base, dodge: 0.1, block: 0 } : profile.base };
}

export function progressionAttributes(className, level = 1) {
  const profile = progressionProfile(className);
  if (!profile) return null;
  const gained = Math.max(0, level - 1);
  return Object.fromEntries(ATTRIBUTE_STATS.map((stat) => [stat, profile.base[stat] + profile.growth[stat] * gained]));
}

export function progressionResources(className, level = 1, attributeBonuses = {}) {
  const profile = progressionProfile(className);
  if (!profile) return null;
  const gained = Math.max(0, level - 1);
  const attributes = progressionAttributes(className, level);
  const delta = Object.fromEntries(ATTRIBUTE_STATS.map((stat) => {
    attributes[stat] += attributeBonuses[stat] ?? 0;
    return [stat, attributes[stat] - profile.base[stat]];
  }));
  const agilityAttacker = ['Scoundrel', 'Ranger'].includes(className);
  return {
    ...profile.base,
    ...attributes,
    maxHp: profile.base.maxHp + gained * profile.growth.maxHp + delta.constitution * 10,
    maxMana: profile.base.maxMana > 0 ? profile.base.maxMana + gained * profile.growth.maxMana + (delta.intellect + delta.wisdom) * 5 : 0,
    armor: profile.base.armor + delta.constitution * 10,
    attackPower: profile.base.attackPower + delta.strength * 8 + (agilityAttacker ? delta.agility * 6 : 0),
    spellDamage: profile.base.spellDamage + delta.intellect * 8,
    spellHealing: profile.base.spellHealing + delta.wisdom * 8,
    dodge: cappedChance('dodge', profile.base.dodge + delta.agility * 0.0008 + (attributeBonuses.dodge ?? 0)),
    block: cappedChance('block', profile.base.block + delta.strength * 0.0005 + (attributeBonuses.block ?? 0)),
    critChance: cappedChance('critChance', profile.base.critChance + (delta.agility + delta.intellect + delta.wisdom) * 0.0005 + (attributeBonuses.critChance ?? 0)),
    hitChance: cappedChance('hitChance', profile.base.hitChance + delta.agility * 0.0005 + (attributeBonuses.hitChance ?? 0))
  };
}

export function armorReduction(rating) {
  const armor = Math.max(0, rating ?? 0);
  return armor / (armor + 400);
}
