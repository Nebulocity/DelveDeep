// These are authored enemy totals and abilities. They use the shared combat stats but do
// not receive adventurer growth. Encounter waves refer to these keys to create individual
// live enemies, so changing a key can break an authored wave.

import { monsterStats, monsterAbilities } from '../game/MonsterStats.js';
import { SLIME_BALANCE } from '../config/slimeBalance.js';


// maxHp and attackPower are authored resource/power values. attackRange and moveSpeed
// use logical arena distance; attackCooldown and attackWindup are milliseconds.
// critChance is a fraction (0.08 means 8%) and critMultiplier scales a successful crit.
// color is a hexadecimal display color, while goldMin/goldMax are reward bounds.
// monsterStats and monsterAbilities normalize these definitions below before battle use.
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
    name: 'Elder Slime',
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

  lasher: {
    id: 'lasher', name: 'Lasher', maxHp: 125, moveSpeed: 142,
    attackPower: 9, attackRange: 90, attackCooldown: 1150, attackWindup: 290,
    critChance: 0.09, critMultiplier: 1.5, color: 0x4d7c0f,
    goldMin: 6, goldMax: 10
  },

  ruffian: {
    id: 'ruffian', name: 'Ruffian', maxHp: 105, moveSpeed: 170,
    attackPower: 8, attackRange: 68, attackCooldown: 850, attackWindup: 220,
    critChance: 0.14, critMultiplier: 1.6, color: 0xb91c1c,
    goldMin: 7, goldMax: 11
  },

  hedgeMage: {
    id: 'hedge-mage', name: 'Hedge Mage', maxHp: 110, moveSpeed: 112,
    attackPower: 7, attackRange: 210, attackCooldown: 1500, attackWindup: 550,
    critChance: 0.07, critMultiplier: 1.5, color: 0x7e22ce,
    goldMin: 9, goldMax: 14,
    abilities: { secondary: { name: 'Briar Bolt', cooldown: 6200, windup: 800, power: 15 } }
  },

  rongarTheCrusher: {
    id: 'rongar-the-crusher', name: 'Rongar the Crusher', boss: true,
    maxHp: 2600, bodyRadius: 56, moveSpeed: 95,
    attackPower: 16, attackRange: 90, attackCooldown: 1450, attackWindup: 380,
    critChance: 0.08, critMultiplier: 1.6, color: 0x92400e,
    goldMin: 65, goldMax: 85,
    abilities: { primary: { name: 'Mace Sweep', cooldown: 5800, telegraph: 1250, radius: 145, power: 22 } }
  },

  denWarden: {
    id: 'den-warden', name: 'Den Warden', maxHp: 120, moveSpeed: 155,
    attackPower: 9, attackRange: 72, attackCooldown: 1050, attackWindup: 250,
    critChance: 0.11, critMultiplier: 1.5, color: 0xb97845,
    goldMin: 7, goldMax: 11
  },

  denProtector: {
    id: 'den-protector', name: 'Den Protector', maxHp: 520, bodyRadius: 44,
    moveSpeed: 88, attackPower: 14, attackRange: 86,
    attackCooldown: 1450, attackWindup: 420,
    critChance: 0.07, critMultiplier: 1.5, color: 0x547a32,
    goldMin: 24, goldMax: 35,
    abilities: { primary: { name: 'Bark Slam', cooldown: 6500, telegraph: 1200, radius: 140, power: 22 } }
  },

  silvanarkTheForestLord: {
    id: 'silvanark-the-forest-lord', name: 'Silvanark the Forest Lord', boss: true,
    maxHp: 2600, bodyRadius: 68, moveSpeed: 75,
    attackPower: 17, attackRange: 104, attackCooldown: 1500, attackWindup: 440,
    critChance: 0.08, critMultiplier: 1.6, color: 0x476b36,
    goldMin: 65, goldMax: 85,
    abilities: {
      primary: { name: 'Forest Quake', cooldown: 6000, telegraph: 1350, radius: 175, power: 26 },
      secondary: { name: 'Root Lance', cooldown: 7500, windup: 850, power: 19 }
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

// These final bosses extend the existing encounters with long fights. Their health
// provides endurance without making each hit overwhelming.
enemies.slimeSovereign = {
  ...enemies.elderSlime,
  id: 'slime-sovereign', name: 'Slime Sovereign', boss: true,
  maxHp: 2600, bodyRadius: 68, moveSpeed: 80,
  attackPower: 15, attackCooldown: 1500, color: 0x84cc16,
  goldMin: 65, goldMax: 85
};

// ... copies the source's own fields into this object; fields listed later replace earlier
// ones. This is a shallow copy, so nested objects are still shared.
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

// Add the supplied void identities using existing stat profiles. Old enemy keys remain
// available for saved encounters and The Verdant Tear, so those records still restore.
enemies.voidCrawler = {
  ...enemies.voidStalker,
  id: 'void-crawler', name: 'Void Crawler',
  abilities: {
    secondary: { ...enemies.voidStalker.abilities.secondary, name: 'Void Bolt', animation: 'cast' }
  }
};
enemies.voidKeeper = {
  ...enemies.voidWarden,
  id: 'void-keeper', name: 'Void Keeper',
  abilities: {
    primary: { ...enemies.voidWarden.abilities.primary, name: 'Void Spirals', animation: 'area' },
    secondary: { ...enemies.voidWarden.abilities.secondary, name: 'Void Beam', animation: 'cast', projectile: 'beam' }
  }
};
enemies.voidWisp = {
  ...enemies.voidStalker,
  id: 'void-wisp', name: 'Void Wisp',
  abilities: {
    secondary: { ...enemies.voidStalker.abilities.secondary, name: 'Void Bolt', animation: 'cast' }
  }
};

// The third Abyss wave keeps its existing durable guardian profile. It uses the
// supplied Keeper artwork without replacing the older saved Abyssal Maw identity.
enemies.voidKeeperGuardian = {
  ...enemies.abyssalMaw,
  id: 'void-keeper-guardian', name: 'Void Keeper',
  abilities: {
    primary: { ...enemies.abyssalMaw.abilities.primary, animation: 'area' },
    secondary: { ...enemies.abyssalMaw.abilities.secondary, animation: 'cast' }
  }
};

// Keep powers, cooldowns and targeting intact while matching the boards' action poses.
enemies.voidStalker.abilities.secondary = {
  ...enemies.voidStalker.abilities.secondary, animation: 'leap'
};
enemies.voidWarden.abilities = {
  primary: { ...enemies.voidWarden.abilities.primary, animation: 'area' },
  secondary: { ...enemies.voidWarden.abilities.secondary, animation: 'cast' }
};
enemies.abyssalMaw.abilities = {
  primary: { ...enemies.abyssalMaw.abilities.primary, animation: 'area' },
  secondary: { ...enemies.abyssalMaw.abilities.secondary, animation: 'cast' }
};
enemies.abyssalSovereign.abilities = {
  primary: { ...enemies.abyssalSovereign.abilities.primary, animation: 'area' },
  secondary: { ...enemies.abyssalSovereign.abilities.secondary, animation: 'cast' }
};


// Use the replaced roster's ordinary attack stats until the supplied ability list arrives.
// Empty abilities prevent inherited bandit spells from becoming invented monster skills.
// Existing enemy keys remain available so saved battles can finish with their old roster.
enemies.sunkenWatcher = {
  ...enemies.ruffian, id: 'sunken-watcher', name: 'Sunken Watcher',
  color: 0x43bdd0, abilities: {}
};
enemies.deepTongue = {
  ...enemies.lasher, id: 'deep-tongue', name: 'The Deep Tongue',
  color: 0x32b6cb, abilities: {}
};
enemies.drownedKnell = {
  ...enemies.hedgeMage, id: 'drowned-knell', name: 'Drowned Knell',
  attackRange: 90, color: 0x91aa32, abilities: {}
};
enemies.earthsinker = {
  ...enemies.rongarTheCrusher, id: 'earthsinker', name: 'The Earthsinker',
  color: 0x388d91, abilities: {}
};

// These provisional profiles reuse the replaced encounter's basic combat totals.
// Special abilities await authored data rather than inheriting unrelated forest spells.
// Keep the old definitions above so battles already in progress can still restore them.
enemies.quarryWorm = {
  ...enemies.denWarden, id: 'quarry-worm', name: 'Quarry Worm', abilities: {}
};

// Baaz has a provisional melee profile and no invented petrification combat effect.
// Its stone death is presentation only; an encounter assignment remains to be authored.
enemies.baazDraconian = {
  ...enemies.ruffian, id: 'baaz-draconian', name: 'Baaz Draconian', abilities: {}
};
enemies.quarryBehemoth = {
  ...enemies.denProtector, id: 'quarry-behemoth', name: 'Quarry Behemoth', abilities: {}
};
enemies.quarryReaver = {
  ...enemies.denProtector, id: 'quarry-reaver', name: 'Quarry Reaver', abilities: {}
};
enemies.depthsSovereign = {
  ...enemies.silvanarkTheForestLord, id: 'depths-sovereign', name: 'Depths Sovereign', abilities: {}
};

export const forgottenCavernWaves = [
  {
    enemies: [
      { type: 'caveBat', arenaX: 390, arenaY: 790 },
      { type: 'caveBat', arenaX: 650, arenaY: 825 }
    ]
  },

  {
    enemies: [
      { type: 'stoneCrawler', arenaX: 360, arenaY: 760 },
      { type: 'caveSlime', arenaX: 535, arenaY: 830 },
      { type: 'stoneCrawler', arenaX: 700, arenaY: 750 }
    ]
  },

  {
    boss: true,
    enemies: [
      { type: 'elderSlime', arenaX: 520, arenaY: 810 }
    ]
  }
];

export const voidPortalWaves = [
  {
    enemies: [
      { type: 'voidStalker', arenaX: 360, arenaY: 770 },
      { type: 'voidStalker', arenaX: 650, arenaY: 800 },
      { type: 'stoneCrawler', arenaX: 520, arenaY: 845 }
    ]
  },

  {
    enemies: [
      { type: 'voidWarden', arenaX: 500, arenaY: 790 },
      { type: 'voidStalker', arenaX: 310, arenaY: 750 },
      { type: 'voidStalker', arenaX: 710, arenaY: 750 }
    ]
  },

  {
    boss: true,
    enemies: [
      { type: 'abyssalMaw', arenaX: 520, arenaY: 810 },
      { type: 'voidStalker', arenaX: 300, arenaY: 745 },
      { type: 'voidStalker', arenaX: 735, arenaY: 745 }
    ]
  }
];


// Apply slime tuning after inherited archetypes have kept their original stats and skills.
for (const [type, profile] of Object.entries(SLIME_BALANCE)) {
  enemies[type] = { ...enemies[type], ...profile };
}

// Object.entries turns own fields into [key, value] pairs so we can visit or transform
// them.
for (const [type, definition] of Object.entries(enemies)) {
  const stats = monsterStats(definition);
  enemies[type] = { ...stats, abilities: monsterAbilities(stats) };
}

export default enemies;
