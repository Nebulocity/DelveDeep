export const CLASS_DEFINITIONS = {
  Paladin: {
    role: 'Tank',
    color: 0xeab308,
    maxHp: 185,
    maxMana: 80,
    manaRegen: 5,
    moveSpeed: 135,
    attackPower: 9,
    attackRange: 74,
    attackCooldown: 1100,
    attackWindup: 280,
    threatMultiplier: 3.4,
    critChance: 0.08,
    critMultiplier: 1.6,
    armor: 0.22,
    description: 'Holy shield tank with strong mitigation, area threat, self-healing, and a once-per-delve protective shield.',
    abilities: {
      primary: { name: 'Consecration', cooldown: 4300, windup: 300, power: 12, radius: 185, threatMultiplier: 5.2, aoe: true, lifeSteal: 0.18, manaCost: 18 },
      utility: { name: 'Protective Shield', cooldown: 9999999, duration: 10000, oncePerDelve: true, manaCost: 22 }
    }
  },
  Gladiator: {
    role: 'Tank',
    color: 0xb45309,
    maxHp: 155,
    moveSpeed: 160,
    attackPower: 14,
    attackRange: 82,
    attackCooldown: 900,
    attackWindup: 220,
    threatMultiplier: 2.7,
    critChance: 0.14,
    critMultiplier: 1.8,
    armor: 0.08,
    description: 'Aggressive two-handed tank with high single-target damage, health-for-damage attacks, and dirty tricks.',
    abilities: {
      primary: { name: 'Blood Price', cooldown: 3600, windup: 250, power: 34, healthCost: 0.07, threatMultiplier: 4.2 },
      utility: { name: 'Sand Kick', cooldown: 7200, windup: 180, duration: 4500, missChance: 0.5 }
    }
  },
  Guardian: {
    role: 'Tank',
    color: 0x4d7c0f,
    maxHp: 195,
    moveSpeed: 125,
    attackPower: 11,
    attackRange: 76,
    attackCooldown: 1050,
    attackWindup: 280,
    threatMultiplier: 4.2,
    critChance: 0.08,
    critMultiplier: 1.65,
    armor: 0.18,
    description: 'Nature tank focused on one enemy, self-healing, and reducing incoming damage for the party.',
    abilities: {
      primary: { name: 'Heartwood Smash', cooldown: 3900, windup: 330, power: 28, threatMultiplier: 6.2, lifeSteal: 0.35 },
      utility: { name: 'Withering Mark', cooldown: 8200, windup: 220, duration: 6000, damageReduction: 0.2 }
    }
  },
  Rogue: {
    role: 'Melee DPS',
    color: 0x7c3aed,
    maxHp: 92,
    moveSpeed: 205,
    attackPower: 13,
    attackRange: 70,
    attackCooldown: 780,
    attackWindup: 170,
    threatMultiplier: 0.8,
    critChance: 0.24,
    critMultiplier: 1.85,
    description: 'Stealth melee attacker with a devastating opener, bleeds, and short armor vulnerabilities.',
    startsStealthed: true,
    abilities: {
      primary: { name: 'Hemorrhage', cooldown: 3900, windup: 230, power: 25, threatMultiplier: 0.7, bleedPower: 5, bleedTicks: 4, bleedInterval: 1200 },
      opener: { name: 'Ambush', multiplier: 3, armorReduction: 0.25, duration: 10000 }
    }
  },
  Barbarian: {
    role: 'Melee DPS',
    color: 0xdc2626,
    maxHp: 132,
    moveSpeed: 170,
    attackPower: 16,
    attackRange: 84,
    attackCooldown: 980,
    attackWindup: 250,
    threatMultiplier: 1.0,
    critChance: 0.16,
    critMultiplier: 1.85,
    damageTakenMultiplier: 1.15,
    description: 'Greataxe bruiser that enrages for more damage, cleaves groups, and can roar to empower nearby allies.',
    abilities: {
      primary: { name: 'Sweeping Cleave', cooldown: 4300, windup: 300, power: 25, radius: 155, aoe: true, threatMultiplier: 1.0 },
      utility: { name: 'War Roar', cooldown: 9000, duration: 10000, radius: 270, damageBoost: 0.15 }
    }
  },
  Wizard: {
    role: 'Ranged DPS',
    color: 0x2563eb,
    maxHp: 78,
    maxMana: 120,
    manaRegen: 8,
    moveSpeed: 130,
    attackPower: 15,
    attackRange: 345,
    attackCooldown: 1500,
    attackWindup: 480,
    threatMultiplier: 1.0,
    critChance: 0.19,
    critMultiplier: 1.85,
    description: 'Fragile high-output spellcaster with ranged and close-range magic plus an emergency Arcane Shield.',
    abilities: {
      primary: { name: 'Fireball', cooldown: 4200, windup: 760, power: 34, radius: 125, aoe: true, threatMultiplier: 1.1, manaCost: 28 },
      secondary: { name: 'Magic Missile', cooldown: 2600, windup: 420, power: 24, threatMultiplier: 1.0, manaCost: 16 },
      close: { name: 'Cone of Cold', cooldown: 5200, windup: 360, power: 22, radius: 145, aoe: true, manaCost: 24 },
      melee: { name: 'Arcane Blast', cooldown: 3400, windup: 300, power: 28, manaCost: 20 },
      utility: { name: 'Arcane Shield', cooldown: 12000, duration: 10000, silenceDuration: 5000, manaCost: 30 }
    }
  },
  Ranger: {
    role: 'Ranged DPS',
    color: 0x15803d,
    maxHp: 102,
    maxMana: 70,
    manaRegen: 4,
    moveSpeed: 165,
    attackPower: 15,
    attackRange: 360,
    attackCooldown: 1050,
    attackWindup: 290,
    threatMultiplier: 0.9,
    critChance: 0.18,
    critMultiplier: 1.8,
    description: 'Long-range damage dealer with Hunter\'s Mark and battlefield traps.',
    abilities: {
      primary: { name: 'Rain of Arrows', cooldown: 5000, windup: 420, power: 19, radius: 145, aoe: true, threatMultiplier: 0.8, manaCost: 18 },
      utility: { name: "Hunter's Mark", cooldown: 9000, duration: 9000, damageTakenBoost: 0.1, manaCost: 14 },
      trap: { name: 'Hunter Trap', cooldown: 7200, manaCost: 12 }
    }
  },
  Naturalist: {
    role: 'Healer',
    color: 0x22c55e,
    maxHp: 108,
    maxMana: 120,
    manaRegen: 7,
    basicHealManaCost: 8,
    moveSpeed: 145,
    attackPower: 6,
    attackRange: 285,
    attackCooldown: 1650,
    attackWindup: 400,
    healPower: 16,
    healRange: 315,
    healCooldown: 1250,
    healWindup: 390,
    critChance: 0.10,
    critMultiplier: 1.6,
    description: 'Elemental support healer with a constant nature aura and gentle multi-target healing.',
    abilities: {
      primary: { name: 'Healing Breeze', cooldown: 3600, windup: 500, power: 17, targets: 3, manaCost: 22 },
      passive: { name: 'Nature Aura', interval: 2600, power: 3 }
    }
  },
  Priest: {
    role: 'Healer',
    color: 0xe5e7eb,
    maxHp: 100,
    maxMana: 130,
    manaRegen: 8,
    basicHealManaCost: 9,
    moveSpeed: 135,
    attackPower: 7,
    attackRange: 285,
    attackCooldown: 1600,
    attackWindup: 390,
    healPower: 22,
    healRange: 320,
    healCooldown: 1250,
    healWindup: 410,
    critChance: 0.14,
    critMultiplier: 1.9,
    description: 'Holy single-target specialist with powerful direct healing and a flexible Holy Burst.',
    abilities: {
      primary: { name: 'Greater Heal', cooldown: 3500, windup: 680, power: 42, manaCost: 24 },
      utility: { name: 'Holy Burst', cooldown: 6200, windup: 420, power: 30, manaCost: 18 }
    }
  },
  Bloodwarder: {
    role: 'Healer',
    color: 0x991b1b,
    maxHp: 122,
    maxMana: 100,
    manaRegen: 6,
    basicHealManaCost: 8,
    moveSpeed: 140,
    attackPower: 9,
    attackRange: 300,
    attackCooldown: 1450,
    attackWindup: 360,
    healPower: 24,
    healRange: 310,
    healCooldown: 1350,
    healWindup: 400,
    critChance: 0.11,
    critMultiplier: 1.7,
    description: 'Blood-magic healer that sacrifices its own health for stronger heals and curses enemies.',
    abilities: {
      primary: { name: 'Blood Mend', cooldown: 3100, windup: 430, power: 38, healthCost: 0.06, manaCost: 16 },
      utility: { name: 'Blood Curse', cooldown: 7600, duration: 7000, damageTakenBoost: 0.12, damageReduction: 0.12, manaCost: 20 }
    }
  }
};

// I build an adventurer from class defaults and individual overrides.
export function createAdventurer(id, name, className, overrides = {}) {

  const definition = CLASS_DEFINITIONS[className];
  if (!definition) throw new Error(`Unknown class: ${className}`);

  return {
    id,
    name,
    className,
    level: 1,
    ...definition,
    abilities: { ...definition.abilities },
    ...overrides
  };
}
