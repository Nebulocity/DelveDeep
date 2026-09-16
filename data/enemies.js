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
  },
  voidStalker: {
    id: 'void-stalker',
    name: 'Void Stalker',
    maxHp: 165,
    moveSpeed: 185,
    attackPower: 13,
    attackRange: 76,
    attackCooldown: 900,
    attackWindup: 210,
    critChance: 0.12,
    critMultiplier: 1.65,
    color: 0x6d28d9,
    goldMin: 11,
    goldMax: 16,
    abilities: {
      secondary: { name: 'Void Lance', cooldown: 5200, windup: 600, power: 17 }
    }
  },
  voidWarden: {
    id: 'void-warden',
    name: 'Void Warden',
    maxHp: 315,
    moveSpeed: 112,
    attackPower: 16,
    attackRange: 86,
    attackCooldown: 1180,
    attackWindup: 310,
    critChance: 0.10,
    critMultiplier: 1.65,
    color: 0x4c1d95,
    goldMin: 18,
    goldMax: 25,
    abilities: {
      primary: { name: 'Rift Crush', cooldown: 5600, telegraph: 1250, radius: 150, power: 27 },
      secondary: { name: 'Dark Bolt', cooldown: 6800, windup: 720, power: 20 }
    }
  },
  abyssalMaw: {
    id: 'abyssal-maw',
    name: 'Abyssal Maw',
    maxHp: 920,
    moveSpeed: 102,
    attackPower: 19,
    attackRange: 92,
    attackCooldown: 1180,
    attackWindup: 360,
    critChance: 0.11,
    critMultiplier: 1.7,
    color: 0x581c87,
    goldMin: 55,
    goldMax: 75,
    abilities: {
      primary: { name: 'Abyssal Collapse', cooldown: 5200, telegraph: 1450, radius: 190, power: 34 },
      secondary: { name: 'Soul Rend', cooldown: 6400, windup: 760, power: 25 }
    }
  }
};

// These final bosses extend the existing encounters with long fights.
// Their health provides endurance without making each hit overwhelming.
enemies.slimeSovereign = {
  ...enemies.elderSlime,
  id: 'slime-sovereign', name: 'Slime Sovereign', boss: true,
  maxHp: 2600, bodyRadius: 68, moveSpeed: 80,
  attackPower: 15, attackCooldown: 1500, color: 0x84cc16,
  goldMin: 65, goldMax: 85
};
enemies.denColossus = {
  ...enemies.elderSlime,
  id: 'den-colossus', name: 'Den Colossus', boss: true,
  maxHp: 3400, bodyRadius: 72, moveSpeed: 78,
  attackPower: 17, attackCooldown: 1450, color: 0xa16207,
  goldMin: 90, goldMax: 120
};
enemies.abyssalSovereign = {
  ...enemies.abyssalMaw,
  id: 'abyssal-sovereign', name: 'Abyssal Sovereign', boss: true,
  maxHp: 4400, bodyRadius: 76, moveSpeed: 85,
  attackPower: 19, attackCooldown: 1450, color: 0xa855f7,
  goldMin: 130, goldMax: 170
};

// These escorts sit between ordinary creatures and the existing bosses.
enemies.denGuard = {
  ...enemies.stoneCrawler,
  id: 'den-guard', name: 'Den Guard', maxHp: 330,
  attackPower: 12, attackCooldown: 1400, color: 0x92400e,
  goldMin: 14, goldMax: 20
};
enemies.riftSentinel = {
  ...enemies.voidStalker,
  id: 'rift-sentinel', name: 'Rift Sentinel', maxHp: 360,
  attackPower: 13, attackCooldown: 1400, color: 0x7e22ce,
  goldMin: 18, goldMax: 25
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

export const voidPortalWaves = [
  {
    name: 'Whispers at the Threshold',
    enemies: [
      { type: 'voidStalker', arenaX: 360, arenaY: 770 },
      { type: 'voidStalker', arenaX: 650, arenaY: 800 },
      { type: 'stoneCrawler', arenaX: 520, arenaY: 845 }
    ]
  },
  {
    name: 'Wardens of the Rift',
    enemies: [
      { type: 'voidWarden', arenaX: 500, arenaY: 790 },
      { type: 'voidStalker', arenaX: 310, arenaY: 750 },
      { type: 'voidStalker', arenaX: 710, arenaY: 750 }
    ]
  },
  {
    name: 'The Maw Beyond',
    boss: true,
    enemies: [
      { type: 'abyssalMaw', arenaX: 520, arenaY: 810 },
      { type: 'voidStalker', arenaX: 300, arenaY: 745 },
      { type: 'voidStalker', arenaX: 735, arenaY: 745 }
    ]
  }
];

export default enemies;
