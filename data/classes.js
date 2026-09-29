// Powers and unspecified durations are provisional balance values; see docs/CLASS_ABILITIES.md.
export const CLASS_MIGRATIONS = { Paladin: 'Dawnwarden', Rogue: 'Scoundrel', Guardian: 'Dawnwarden', Wizard: 'Mage of the Umbral Veil', Priest: 'Cleric of the Everbright', 'Cleric of the Holy Light': 'Cleric of the Everbright', Naturalist: 'Cleric of the Verdant Covenant', Bloodwarder: 'Cleric of the Sanguine Song' };
const spell = (name, cooldown, range, effect, extra = {}) => ({ name, cooldown: cooldown * 1000, range, effect, windup: 300, ...extra });
const mage = (shortName, color, abilities) => ({ role: 'Ranged DPS', shortName, color, maxHp: 80, maxMana: 120, manaRegen: 8, moveSpeed: 130, attackPower: 15, attackRange: 345, attackCooldown: 1500, attackWindup: 400, critChance: 0.15, critMultiplier: 1.75, gridAbilities: true, abilities });
const cleric = (shortName, color, abilities) => ({ role: 'Healer', shortName, color, armor: 0.08, maxHp: 110, maxMana: 120, manaRegen: 8, moveSpeed: 140, attackPower: 7, attackRange: 300, attackCooldown: 1600, attackWindup: 400, healPower: 22, healRange: 600, gridAbilities: true, abilities });
export const CLASS_DEFINITIONS = {
  Gladiator: {
    role: 'Tank', color: 0xd99b35, maxHp: 185, moveSpeed: 150, attackPower: 15, attackRange: 74, attackCooldown: 1100, attackWindup: 280, armor: 0.22, threatMultiplier: 3.4, gridAbilities: true,
    abilities: {
      roar: spell('Roar', 10, 4, 'taunt', { duration: 6000, targets: 1 }),
      net: spell('Throw Net', 15, 6, 'damage', { power: 12, damageType: 'physical', root: 10000, farthest: true }),
      cleave: spell('Whirling Cleave', 10, 0, 'damage', { power: 40, damageType: 'physical', radius: 4, totalThreat: 2 }),
      sand: spell('Kick Sand', 10, 1, 'damage', { power: 12, damageType: 'physical', blind: 6000, blindChance: 0.6 })
    }
  },
  Oathwarden: {
    role: 'Tank', color: 0x94a3b8, maxHp: 190, moveSpeed: 132, attackPower: 9, attackRange: 74, attackCooldown: 1100, attackWindup: 280, armor: 0.26, threatMultiplier: 3.4, gridAbilities: true,
    abilities: {
      sacrifice: spell('My Honor is My Life', 0, 0, 'sacrifice', { duration: 10000, damageBoost: 0.5, healingBoost: 0.5 }),
      vow: spell('Solemn Vow', 20, 6, 'vow', { duration: 10000, immunityDuration: 5000 }),
      defense: spell('Staunch Defense', 20, 4, 'taunt', { targets: Infinity, duration: 6000, reduction: 0.75 }),
      parry: spell('Parry', 2, 0, 'parry', { chance: 0.65, reactive: true })
    }
  },
  Barmaid: {
    role: 'Melee DPS', color: 0xc026d3, maxHp: 110, moveSpeed: 175, attackPower: 14, attackRange: 74, attackCooldown: 1000, attackWindup: 250, critChance: 0.16, critMultiplier: 1.75, gridAbilities: true,
    abilities: {
      pan: spell('Frying Pan', 8, 1, 'damage', { power: 40, damageType: 'physical', stun: 4000 }),
      swing: spell('Clumsy Swing', 15, 0, 'damage', { power: 24, damageType: 'physical', radius: 1 }),
      bash: spell('Shield Bash', 10, 1, 'damage', { power: 24, damageType: 'physical', stun: 4000 }),
      lastCall: spell('Last Call', 20, 6, 'damage', { power: 40, damageType: 'physical', beam: true, endpoint: true, stun: 4000 })
    }
  },
  Scoundrel: {
    role: 'Melee DPS', color: 0x7c3aed, maxHp: 92, moveSpeed: 205, attackPower: 13, attackRange: 70, attackCooldown: 780, attackWindup: 170, threatMultiplier: 0.8, critChance: 0.24, critMultiplier: 1.85, gridAbilities: true,
    abilities: {
      stealth: spell('Stealth', 8, 0, 'stealth'),
      surprise: spell('Surprise Attack', 10, 1, 'damage', { power: 60, damageType: 'physical', requiresStealth: true, behind: true, stun: 4000 }),
      poison: spell('Poison', 10, 1, 'damage', { power: 0, damageType: 'poison', poison: { power: 8, interval: 2000, duration: 6000 }, attackSlow: 0.5 }),
      dagger: spell('Dagger Throw', 4, 6, 'damage', { power: 12, damageType: 'physical' })
    }
  },
  Barbarian: {
    role: 'Melee DPS', color: 0xdc2626, maxHp: 132, moveSpeed: 170, attackPower: 16, attackRange: 84, attackCooldown: 980, attackWindup: 250, threatMultiplier: 1, critChance: 0.16, critMultiplier: 1.85, gridAbilities: true,
    abilities: {
      enrage: spell('Enrage', 30, 0, 'enrage', { duration: 10000, recovery: 10000, damageMultiplier: 3, incomingMultiplier: 2, recoveryMultiplier: 0.5 }),
      charge: spell('Charge', 15, 6, 'damage', { power: 40, damageType: 'physical', charge: true, stun: 6000 }),
      strike: spell('Heroic Strike', 10, 1, 'damage', { power: 40, damageType: 'physical' }),
      rend: spell('Agonizing Rend', 15, 1, 'damage', { power: 60, damageType: 'physical' })
    }
  },
  Ranger: {
    role: 'Ranged DPS', color: 0x15803d, maxHp: 102, moveSpeed: 165, attackPower: 15, attackRange: 360, attackCooldown: 1050, attackWindup: 290, threatMultiplier: 0.9, critChance: 0.18, critMultiplier: 1.8, gridAbilities: true,
    abilities: {
      mark: spell("Hunter's Mark", 15, 6, 'mark', { duration: 10000, damageTakenBoost: 0.25 }),
      rain: spell('Rain of Arrows', 15, 4, 'damage', { power: 24, damageType: 'physical', zone: [2, 2] }),
      trap: spell("Hunter's Trap", 15, 1, 'trap', { power: 40, damageType: 'poison', stun: 10000 }),
      arrow: spell('Exploding Arrow', 15, 6, 'damage', { power: 60, damageType: 'physical' })
    }
  },
  Dawnwarden: {
    role: 'Tank', color: 0xeab308, maxHp: 185, maxMana: 80, manaRegen: 5, moveSpeed: 135, attackPower: 9, attackRange: 74, attackCooldown: 1100, attackWindup: 280, armor: 0.22, threatMultiplier: 3.4, gridAbilities: true,
    abilities: {
      challenge: spell('Challenge', 10, 4, 'taunt', { duration: 6000, targets: 1 }),
      defiant: spell('Defiant Stance', 15, Infinity, 'taunt', { duration: 6000, targets: 3, farthest: true }),
      nova: spell('Sanctity Nova', 8, 0, 'damage', { power: 24, damageType: 'holy', radius: 4, totalThreat: 2 }),
      strike: spell('Sunbrand Strike', 4, 1, 'damage', { power: 24, damageType: 'holy' })
    }
  },
  'Mage of the Umbral Veil': mage('Umbral Mage', 0x292333, {
    grasp: spell('Umbral Grasp', 10, 1, 'damage', { power: 24, damageType: 'necrotic' }),
    nightbolt: spell('Nightbolt', 5, 5, 'damage', { power: 24, damageType: 'necrotic' }),
    gloom: spell('Gloomburst', 10, 4, 'damage', { power: 24, damageType: 'necrotic', zone: [3, 3] }),
    veilstep: spell('Veilstep', 10, Infinity, 'teleport', { moveThreshold: 3 })
  }),
  'Mage of the Crimson Spire': mage('Crimson Mage', 0xb91c1c, {
    stabilization: spell('Arcane Stabilization', 10, 0, 'stabilize', { duration: 5000, reduction: 0.5, spellBoost: 0.25 }),
    lash: spell('Crimson Lash', 10, 1, 'damage', { power: 24, damageType: 'force', targets: 2 }),
    arcflare: spell('Arcflare', 5, 6, 'damage', { power: 12, damageType: 'force', splash: 1 }),
    spire: spell('Spireburst', 10, 5, 'damage', { power: 24, damageType: 'force', beam: true, friendlyFire: true })
  }),
  'Mage of the Luminous Archive': mage('Luminous Mage', 0xf8fafc, {
    refuge: spell('Scripted Refuge', 15, 0, 'refuge', { duration: 15000, interval: 3000, power: 15 }),
    touch: spell('Radiant Touch', 10, 1, 'damage', { power: 12, damageType: 'radiant', healRatio: 3, healScope: 'lowest' }),
    spear: spell('Lumenspear', 5, 6, 'damage', { power: 24, damageType: 'radiant', healRatio: 2, healScope: 'near' }),
    libram: spell('Libram of Knowledge', 15, 3, 'damage', { power: 40, damageType: 'radiant', zone: [2, 2], healRatio: 2, healScope: 'all' })
  }),
  'Cleric of the Everbright': cleric('Everbright Cleric', 0xffe58a, {
    aegis: spell('Solar Aegis', 10, 0, 'aegis'),
    blessing: spell('Blessing of the Dawn', 5, 1, 'heal', { power: 42 }),
    ray: spell('Ray of Benediction', 3, 5, 'heal', { power: 24 }),
    pulse: spell('Everbright Pulse', 8, 3, 'heal', { power: 24, zone: [2, 2] }),
    judgement: spell('Judgement Spark', 8, 4, 'damage', { power: 8, highPower: 40, damageType: 'radiant', judgement: true })
  }),
  'Cleric of the Verdant Covenant': cleric('Verdant Cleric', 0x22c55e, {
    refuge: spell('Rootbound Refuge', 10, 0, 'armor', { armorMultiplier: 4, duration: 8000 }),
    touch: spell('Verdant Touch', 5, 1, 'heal', { power: 42 }),
    mend: spell('Bramble Mend', 5, 5, 'heal', { power: 24, retaliation: 24 }),
    bloom: spell('Bloomfield Surge', 10, 3, 'heal', { power: 12, zone: [3, 3] }),
    thorn: spell('Thornlance', 6, 5, 'damage', { power: 12, damageType: 'nature', root: 4000 })
  }),
  'Cleric of the Sanguine Song': cleric('Sanguine Cleric', 0x991b1b, {
    ascendance: spell('Bloodsong Ascendance', 10, 0, 'ascendance', { duration: 8000, healingBoost: 0.25, teleportRange: 2 }),
    transfer: spell('Sanguine Transfer', 5, 1, 'heal', { power: 42, selfDamage: 12 }),
    beam: spell('Hemoflow Beam', 5, 6, 'heal', { power: 24, lowHealthPower: 42 }),
    chorus: spell('Crimson Chorus', 10, 4, 'heal', { power: 24, zone: [2, 3], temporaryHp: 1 }),
    rend: spell('Vessel Rend', 6, 4, 'damage', { power: 12, damageType: 'blood/necrotic', missingHealthBonus: true })
  })
};

export function createAdventurer(id, name, className, overrides = {}) {
  className = CLASS_MIGRATIONS[className] ?? className;
  const definition = CLASS_DEFINITIONS[className];
  if (!definition) throw new Error(`Unknown class: ${className}`);
  return { id, name, className, level: 1, ...definition, abilities: { ...definition.abilities }, ...overrides };
}
