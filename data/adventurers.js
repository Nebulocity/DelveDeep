const adventurers = [
  {
    id: 'brakka',
    name: 'Brakka',
    className: 'Gladiator',
    role: 'Tank',
    level: 1,
    color: 0xb45309,
    maxHp: 165,
    moveSpeed: 150,
    attackPower: 9,
    attackRange: 72,
    attackCooldown: 1050,
    attackWindup: 260,
    threatMultiplier: 3,
    critChance: 0.1,
    critMultiplier: 1.7,
    abilities: {
      primary: {
        name: 'Shield Bash',
        cooldown: 5200,
        windup: 420,
        power: 20,
        threatMultiplier: 6
      },
      utility: {
        name: 'Challenge',
        cooldown: 8200,
        threat: 125
      }
    }
  },
  {
    id: 'sister-elowen',
    name: 'Elowen',
    className: 'Priest',
    role: 'Healer',
    level: 1,
    color: 0xe5e7eb,
    maxHp: 100,
    moveSpeed: 135,
    attackPower: 6,
    attackRange: 270,
    attackCooldown: 1650,
    attackWindup: 420,
    healPower: 20,
    healRange: 300,
    healCooldown: 1300,
    healWindup: 430,
    critChance: 0.1,
    critMultiplier: 1.6,
    abilities: {
      primary: {
        name: 'Greater Heal',
        cooldown: 3600,
        windup: 720,
        power: 38
      }
    }
  },
  {
    id: 'nyx',
    name: 'Nyx',
    className: 'Rogue',
    role: 'Melee DPS',
    level: 1,
    color: 0x7c3aed,
    maxHp: 92,
    moveSpeed: 205,
    attackPower: 13,
    attackRange: 70,
    attackCooldown: 800,
    attackWindup: 180,
    threatMultiplier: 0.8,
    critChance: 0.24,
    critMultiplier: 1.85,
    abilities: {
      primary: {
        name: 'Backstab',
        cooldown: 3900,
        windup: 250,
        power: 31,
        threatMultiplier: 0.7
      }
    }
  },
  {
    id: 'orin',
    name: 'Orin',
    className: 'Wizard',
    role: 'Ranged DPS',
    level: 1,
    color: 0x2563eb,
    maxHp: 82,
    moveSpeed: 130,
    attackPower: 17,
    attackRange: 335,
    attackCooldown: 1550,
    attackWindup: 520,
    threatMultiplier: 1,
    critChance: 0.18,
    critMultiplier: 1.8,
    abilities: {
      primary: {
        name: 'Fireball',
        cooldown: 4300,
        windup: 820,
        power: 36,
        threatMultiplier: 1.1
      }
    }
  }  ,
  {
    id: 'garrick',
    name: 'Garrick',
    className: 'Fighter',
    role: 'Melee DPS',
    level: 1,
    color: 0xdc2626,
    maxHp: 118,
    moveSpeed: 175,
    attackPower: 12,
    attackRange: 76,
    attackCooldown: 920,
    attackWindup: 220,
    threatMultiplier: 0.9,
    critChance: 0.14,
    critMultiplier: 1.75,
    abilities: {
      primary: {
        name: 'Cleave',
        cooldown: 4400,
        windup: 320,
        power: 28,
        threatMultiplier: 0.9
      }
    }
  }

];

export default adventurers;
