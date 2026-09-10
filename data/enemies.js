const enemies = {
  caveBat: {
    id: 'cave-bat',
    name: 'Cave Bat',
    maxHp: 92,
    moveSpeed: 155,
    attackPower: 7,
    attackRange: 62,
    attackCooldown: 1050,
    attackWindup: 220,
    critChance: 0.08,
    critMultiplier: 1.5,
    color: 0x7c3aed,
    goldMin: 4,
    goldMax: 7
  },
  stoneCrawler: {
    id: 'stone-crawler',
    name: 'Stone Crawler',
    maxHp: 135,
    moveSpeed: 92,
    attackPower: 10,
    attackRange: 68,
    attackCooldown: 1250,
    attackWindup: 330,
    critChance: 0.06,
    critMultiplier: 1.5,
    color: 0x78716c,
    goldMin: 6,
    goldMax: 10
  },
  caveSlime: {
    id: 'cave-slime',
    name: 'Cave Slime',
    maxHp: 220,
    moveSpeed: 102,
    attackPower: 11,
    attackRange: 76,
    attackCooldown: 1250,
    attackWindup: 360,
    critChance: 0.05,
    critMultiplier: 1.5,
    color: 0x65a30d,
    goldMin: 8,
    goldMax: 12,
    abilities: {
      primary: {
        name: 'Slime Slam',
        cooldown: 6500,
        telegraph: 1200,
        radius: 135,
        power: 20
      }
    }
  },
  elderSlime: {
    id: 'elder-slime',
    name: 'Elder Cave Slime',
    maxHp: 620,
    moveSpeed: 92,
    attackPower: 15,
    attackRange: 82,
    attackCooldown: 1350,
    attackWindup: 400,
    critChance: 0.08,
    critMultiplier: 1.6,
    color: 0x4d7c0f,
    goldMin: 30,
    goldMax: 45,
    abilities: {
      primary: {
        name: 'Crushing Slime Slam',
        cooldown: 5400,
        telegraph: 1350,
        radius: 165,
        power: 27
      },
      secondary: {
        name: 'Toxic Glob',
        cooldown: 7200,
        windup: 750,
        power: 18
      }
    }
  }
};

export const forgottenCavernWaves = [
  {
    name: 'Cavern Vermin',
    enemies: [
      { type: 'caveBat', arenaX: 390, arenaY: 790 },
      { type: 'caveBat', arenaX: 650, arenaY: 825 }
    ]
  },
  {
    name: 'Things That Skitter',
    enemies: [
      { type: 'stoneCrawler', arenaX: 360, arenaY: 760 },
      { type: 'caveSlime', arenaX: 535, arenaY: 830 },
      { type: 'stoneCrawler', arenaX: 700, arenaY: 750 }
    ]
  },
  {
    name: 'The Elder Puddle',
    boss: true,
    enemies: [
      { type: 'elderSlime', arenaX: 520, arenaY: 810 }
    ]
  }
];

export default enemies;
