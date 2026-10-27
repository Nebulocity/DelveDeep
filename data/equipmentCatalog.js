// Authored equipment, recipes and regional cascades. Percentages are fractions of one.
// Keep stable IDs so owned items and recipe knowledge survive catalog updates.

// Level-35/45 weapons follow each level-23 Starsteel/Starseed archetype: primary bonuses
// grow 4% per level, Speed adds 0.05 per level and critical bonuses add 0.05 percentage
// points per level. These are authored values, not extra scaling applied to owned items.

import { runebladeEquipment, runebladeRecipes } from './runebladeEquipment.js';
import { EARLY_EQUIPMENT } from './lowLevelEquipment.js';
import { pineshireEquipment } from './pineshireEquipment.js';

export const AUTHORED_EQUIPMENT = [
  {
    "id": "BDS01",
    "name": "Bronze Dagger",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 1,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 2,
      "agility": 1,
      "critChance": 0.005,
      "critMultiplier": 0.02
    },
    "price": 25,
    "sellPrice": 7,
    "description": "A slightly bent bronze dagger.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "slime-cave",
      "thornbriar-hollow",
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "BLS01",
    "name": "Bronze Longsword",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 1,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden"
    ],
    "stats": {
      "attackPower": 2,
      "strength": 1,
      "critMultiplier": 0.01
    },
    "price": 33,
    "sellPrice": 7,
    "description": "A slightly bent bronze longsword.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "slime-cave",
      "thornbriar-hollow",
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "BSS01",
    "name": "Bronze Shortsword",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 1,
    "usableBy": [
      "Gladiator",
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 2,
      "strength": 1,
      "critMultiplier": 0.01
    },
    "price": 25,
    "sellPrice": 7,
    "description": "A slightly bent bronze shortsword.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "slime-cave",
      "thornbriar-hollow",
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "BHA01",
    "name": "Bronze Handaxe",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 1,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 2,
      "strength": 1,
      "critMultiplier": 0.01
    },
    "price": 33,
    "sellPrice": 7,
    "description": "A slightly bent bronze handaxe.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "slime-cave",
      "thornbriar-hollow",
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "BGA01",
    "name": "Bronze Greataxe",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 1,
    "usableBy": [
      "Gladiator",
      "Barbarian"
    ],
    "stats": {
      "attackPower": 2,
      "strength": 2,
      "critMultiplier": 0.02
    },
    "price": 44,
    "sellPrice": 14,
    "description": "A slightly bent bronze greataxe.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "slime-cave",
      "thornbriar-hollow",
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "BRM01",
    "name": "Bronze Mace",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 1,
    "usableBy": [
      "Grovekeeper",
      "Dawnpriest",
      "Sanguinist"
    ],
    "stats": {
      "maxMana": 25,
      "spellPower": 5,
      "intellect": 1,
      "wisdom": 1
    },
    "price": 25,
    "sellPrice": 7,
    "description": "A slightly dented bronze mace.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "slime-cave",
      "thornbriar-hollow",
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "PST01",
    "name": "Pine Staff",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 1,
    "usableBy": [
      "Umbramancer",
      "Arcanist",
      "Spellbinder"
    ],
    "stats": {
      "maxMana": 25,
      "spellPower": 5,
      "intellect": 1
    },
    "price": 25,
    "sellPrice": 7,
    "description": "A freshly-cut Pine Staff",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "slime-cave",
      "thornbriar-hollow",
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "PBR01",
    "name": "Pine Bow",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 1,
    "usableBy": [
      "Ranger"
    ],
    "stats": {
      "attackPower": 2,
      "agility": 1,
      "critChance": 0.0025,
      "critMultiplier": 0.02
    },
    "price": 25,
    "sellPrice": 7,
    "description": "A freshly-cut Pine Bow",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "slime-cave",
      "thornbriar-hollow",
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "IDS01",
    "name": "Iron Dagger",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 7,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 6,
      "strength": 2,
      "agility": 4,
      "critChance": 0.0075,
      "critMultiplier": 0.025
    },
    "price": 100,
    "sellPrice": 28,
    "description": "A sturdy bronze dagger.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "ILS01",
    "name": "Iron Longsword",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 7,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden"
    ],
    "stats": {
      "attackPower": 6,
      "strength": 6
    },
    "price": 133,
    "sellPrice": 37,
    "description": "A sturdy bronze longsword.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "ISS01",
    "name": "Iron Shortsword",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 7,
    "usableBy": [
      "Gladiator",
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 6,
      "strength": 6
    },
    "price": 100,
    "sellPrice": 28,
    "description": "A sturdy bronze shortsword.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "IHA01",
    "name": "Iron Handaxe",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 7,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 6,
      "strength": 4,
      "agility": 2
    },
    "price": 133,
    "sellPrice": 37,
    "description": "A sturdy bronze handaxe.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "IGA01",
    "name": "Iron Greataxe",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 7,
    "usableBy": [
      "Gladiator",
      "Barbarian"
    ],
    "stats": {
      "attackPower": 12,
      "strength": 6
    },
    "price": 200,
    "sellPrice": 56,
    "description": "A sturdy bronze greataxe.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "IMA01",
    "name": "Iron Mace",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 7,
    "usableBy": [
      "Grovekeeper",
      "Dawnpriest",
      "Sanguinist"
    ],
    "stats": {
      "maxMana": 50,
      "spellPower": 15,
      "intellect": 2,
      "wisdom": 6
    },
    "price": 133,
    "sellPrice": 37,
    "description": "A sturdy bronze mace.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "MST01",
    "name": "Maple Staff",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 7,
    "usableBy": [
      "Umbramancer",
      "Arcanist",
      "Spellbinder"
    ],
    "stats": {
      "maxMana": 50,
      "spellPower": 15,
      "intellect": 6
    },
    "price": 133,
    "sellPrice": 37,
    "description": "A freshly-cut Maple Staff",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "MBR01",
    "name": "Maple Bow",
    "slot": "weapon",
    "rarity": "common",
    "minimumLevel": 7,
    "usableBy": [
      "Ranger"
    ],
    "stats": {
      "attackPower": 6,
      "agility": 6,
      "critChance": 0.005,
      "critMultiplier": 0.025
    },
    "price": 133,
    "sellPrice": 37,
    "description": "A freshly-cut Maple Bow",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "MDS01",
    "name": "Mithril Dagger",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 12,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 6,
      "strength": 4,
      "agility": 8,
      "critChance": 0.01,
      "critMultiplier": 0.025
    },
    "price": 375,
    "sellPrice": 105,
    "description": "A shiny mithril dagger.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "MLS01",
    "name": "Mithril Longsword",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 12,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden"
    ],
    "stats": {
      "attackPower": 6,
      "strength": 12,
      "critChance": 0.01
    },
    "price": 498,
    "sellPrice": 139,
    "description": "A shiny mithril longsword.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "MSS01",
    "name": "Mithril Shortsword",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 12,
    "usableBy": [
      "Gladiator",
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 6,
      "strength": 12,
      "critChance": 0.01
    },
    "price": 375,
    "sellPrice": 105,
    "description": "A shiny mithril shortsword.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "MHA01",
    "name": "Mithril Handaxe",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 12,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 6,
      "strength": 8,
      "agility": 4,
      "critChance": 0.01
    },
    "price": 498,
    "sellPrice": 139,
    "description": "A shiny mithril handaxe.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "MGA01",
    "name": "Mithril Greataxe",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 12,
    "usableBy": [
      "Gladiator",
      "Barbarian"
    ],
    "stats": {
      "attackPower": 12,
      "strength": 6,
      "critChance": 0.01
    },
    "price": 750,
    "sellPrice": 210,
    "description": "A shiny mithril greataxe.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "MMA01",
    "name": "Mithril Mace",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 12,
    "usableBy": [
      "Grovekeeper",
      "Dawnpriest",
      "Sanguinist"
    ],
    "stats": {
      "maxMana": 50,
      "spellPower": 15,
      "intellect": 4,
      "wisdom": 12,
      "critChance": 0.01
    },
    "price": 498,
    "sellPrice": 139,
    "description": "A shiny mithril mace.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "OST01",
    "name": "Oak Staff",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 12,
    "usableBy": [
      "Umbramancer",
      "Arcanist",
      "Spellbinder"
    ],
    "stats": {
      "maxMana": 50,
      "spellPower": 15,
      "intellect": 12,
      "critChance": 0.01
    },
    "price": 100,
    "sellPrice": 28,
    "description": "A smooth and sturdy Oak Staff",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "OBR01",
    "name": "Oak Bow",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 12,
    "usableBy": [
      "Ranger"
    ],
    "stats": {
      "attackPower": 6,
      "agility": 12,
      "critChance": 0.01,
      "critMultiplier": 0.025
    },
    "price": 100,
    "sellPrice": 28,
    "description": "A smooth and sturdy Oak Bow",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "SDS01",
    "name": "Steel Dagger",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 17,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 12,
      "strength": 8,
      "agility": 16,
      "critChance": 0.0115,
      "critMultiplier": 0.025
    },
    "price": 1100,
    "sellPrice": 308,
    "description": "A polished steel dagger.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ]
  },
  {
    "id": "SLS01",
    "name": "Steel Longsword",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 17,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden"
    ],
    "stats": {
      "attackPower": 12,
      "strength": 24,
      "critChance": 0.0115
    },
    "price": 1463,
    "sellPrice": 409,
    "description": "A polished steel longsword.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ]
  },
  {
    "id": "SSS01",
    "name": "Steel Shortsword",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 17,
    "usableBy": [
      "Gladiator",
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 12,
      "strength": 24,
      "critChance": 0.0115
    },
    "price": 1100,
    "sellPrice": 308,
    "description": "A polished steel shortsword.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ]
  },
  {
    "id": "SHA01",
    "name": "Steel Handaxe",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 17,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 12,
      "strength": 16,
      "agility": 4,
      "critChance": 0.0115
    },
    "price": 1463,
    "sellPrice": 409,
    "description": "A polished steel handaxe.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ]
  },
  {
    "id": "SGA01",
    "name": "Steel Greataxe",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 17,
    "usableBy": [
      "Gladiator",
      "Barbarian"
    ],
    "stats": {
      "attackPower": 24,
      "strength": 24,
      "critChance": 0.0115
    },
    "price": 2200,
    "sellPrice": 616,
    "description": "A polished steel greataxe.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ]
  },
  {
    "id": "SMA01",
    "name": "Steel Mace",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 17,
    "usableBy": [
      "Grovekeeper",
      "Dawnpriest",
      "Sanguinist"
    ],
    "stats": {
      "maxMana": 100,
      "spellPower": 30,
      "intellect": 12,
      "wisdom": 24,
      "critChance": 0.0115
    },
    "price": 1463,
    "sellPrice": 409,
    "description": "A polished steel mace.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ]
  },
  {
    "id": "IST01",
    "name": "Ironwood Staff",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 17,
    "usableBy": [
      "Umbramancer",
      "Arcanist",
      "Spellbinder"
    ],
    "stats": {
      "maxMana": 100,
      "spellPower": 30,
      "intellect": 24,
      "critChance": 0.0115
    },
    "price": 1463,
    "sellPrice": 409,
    "description": "A unbreakable and hefty Ironwood Staff",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ]
  },
  {
    "id": "IBR01",
    "name": "Ironwood Bow",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 17,
    "usableBy": [
      "Ranger"
    ],
    "stats": {
      "attackPower": 6,
      "agility": 24,
      "critChance": 0.0115,
      "critMultiplier": 0.025
    },
    "price": 1463,
    "sellPrice": 409,
    "description": "A unbreakable and hefty Ironwood Bow",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ]
  },
  {
    "id": "R1D01",
    "name": "Rabbit Skinner",
    "slot": "weapon",
    "rarity": "rare",
    "minimumLevel": 15,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 32,
      "speed": 2.5,
      "strength": 16,
      "agility": 32,
      "dodge": 0.01,
      "hitChance": 0.0025,
      "critChance": 0.0185,
      "critMultiplier": 0.03
    },
    "price": null,
    "sellPrice": 840,
    "description": "Every child in Pineshire knew the fattest rabbits fed around Yoren’s Cave, and whoever carried this dagger always brought home supper. Since the slimes moved in, its lucky streak has gone untested. Perhaps it’s only waiting for someone to take it back.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ],
    "perk": {
      "id": "bring_home_supper",
      "name": "Bring Home Supper",
      "amount": 0.05,
      "threshold": 0.5
    }
  },
  {
    "id": "R1L01",
    "name": "Last Word",
    "slot": "weapon",
    "rarity": "rare",
    "minimumLevel": 15,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden"
    ],
    "stats": {
      "attackPower": 32,
      "speed": 2.5,
      "strength": 48,
      "hitChance": 0.0025,
      "critChance": 0.0185,
      "critMultiplier": 0.015
    },
    "price": null,
    "sellPrice": 1120,
    "description": "A narrow silver line runs down this sword’s fuller, marking the repair that ended its first owner’s career. Captain Dorran broke it defending his decision to retreat, then spent his pension having it reforged. He wore it thereafter to every reunion of the soldiers his retreat had saved.  It has been lost since he went missing near The Sunken Watch...until now.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ],
    "perk": {
      "id": "live_to_tell",
      "name": "Live to Tell",
      "amount": 0.1,
      "threshold": 0.5
    }
  },
  {
    "id": "R1S01",
    "name": "Toll Collector",
    "slot": "weapon",
    "rarity": "rare",
    "minimumLevel": 15,
    "usableBy": [
      "Gladiator",
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 32,
      "speed": 2.5,
      "strength": 48,
      "hitChance": 0.0025,
      "critChance": 0.0185,
      "critMultiplier": 0.015
    },
    "price": null,
    "sellPrice": 840,
    "description": "A retired footpad carried this sword after purchasing the very bridge beneath which he had once robbed travelers. He posted fair rates, repaired the parapets, and became fiercely offended whenever anyone called his business robbery. His former companions tested that distinction one autumn evening. The bridge still bears five deep cuts along its western rail, and the local charter includes an unusually specific prohibition against collecting tolls with a drawn weapon.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ],
    "perk": {
      "id": "fair_rates",
      "name": "Fair Rates",
      "amount": 0.1
    }
  },
  {
    "id": "R1A01",
    "name": "Copper Jack",
    "slot": "weapon",
    "rarity": "rare",
    "minimumLevel": 15,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 32,
      "speed": 2.5,
      "strength": 32,
      "agility": 16,
      "hitChance": 0.0025,
      "critChance": 0.0185,
      "critMultiplier": 0.015
    },
    "price": null,
    "sellPrice": 840,
    "description": "The copper collar around this handaxe’s haft was fashioned from the last coins paid to Jack Fenner’s logging crew before their employer vanished with the winter wages. Jack carried it through the hungry months, splitting firewood for every household the missing pay had left cold.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ],
    "perk": {
      "id": "honest_days_work",
      "name": "Honest Day's Work",
      "amount": 0.1,
      "threshold": 0.5
    }
  },
  {
    "id": "R1G01",
    "name": "Headsman's Due",
    "slot": "weapon",
    "rarity": "rare",
    "minimumLevel": 15,
    "usableBy": [
      "Gladiator",
      "Barbarian"
    ],
    "stats": {
      "attackPower": 56,
      "speed": 2.5,
      "strength": 48,
      "hitChance": 0.0025,
      "critChance": 0.0185,
      "critMultiplier": 0.03
    },
    "price": null,
    "sellPrice": 1450,
    "description": "Pineshire’s last headsman received a copper for every bandit brought to the block. When his own son was dragged from Thornbriar Hollow, he laid that morning’s payment on the magistrate’s desk and took up this axe. By dusk, two cells stood empty. The coppers were never collected.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ],
    "perk": {
      "id": "sentence_commuted",
      "name": "Sentence Commuted",
      "amount": 0.15,
      "threshold": 0.25
    }
  },
  {
    "id": "R1M01",
    "name": "Kindly Reminder",
    "slot": "weapon",
    "rarity": "rare",
    "minimumLevel": 15,
    "usableBy": [
      "Grovekeeper",
      "Dawnpriest",
      "Sanguinist"
    ],
    "stats": {
      "maxMana": 300,
      "spellPower": 92,
      "speed": 2.5,
      "intellect": 24,
      "wisdom": 48,
      "hitChance": 0.0025,
      "critChance": 0.0185,
      "critMultiplier": 0.015
    },
    "price": null,
    "sellPrice": 1450,
    "description": "Brother Pell remembered every patient’s name and none of their excuses. He carried this mace on his rounds through Pineshire, tapping doors until the sick agreed to rest. Its haft bears teeth marks from a quarryman who refused the surgeon’s sleeping draught.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ],
    "perk": {
      "id": "doctors_orders",
      "name": "Doctor's Orders",
      "amount": 0.15,
      "threshold": 0.5
    }
  },
  {
    "id": "R1T01",
    "name": "The Long Wick",
    "slot": "weapon",
    "rarity": "rare",
    "minimumLevel": 15,
    "usableBy": [
      "Umbramancer",
      "Arcanist",
      "Spellbinder"
    ],
    "stats": {
      "maxMana": 300,
      "spellPower": 92,
      "speed": 2.5,
      "intellect": 48,
      "hitChance": 0.0025,
      "critChance": 0.0185,
      "critMultiplier": 0.015
    },
    "price": null,
    "sellPrice": 1450,
    "description": "Pineshire’s lamplighter carried this staff along roads the watch refused to patrol. Each dawn he returned with every lamp burning and another inch of its tip reduced to charcoal. His replacement inherited the route, the staff, and strict instructions never to light it indoors.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ],
    "perk": {
      "id": "through_the_night",
      "name": "Through the Night",
      "amount": 0.1,
      "threshold": 0.5
    }
  },
  {
    "id": "R1B01",
    "name": "Bent Promise",
    "slot": "weapon",
    "rarity": "rare",
    "minimumLevel": 15,
    "usableBy": [
      "Ranger"
    ],
    "stats": {
      "attackPower": 32,
      "speed": 2.5,
      "agility": 48,
      "hitChance": 0.0025,
      "critChance": 0.0185,
      "critMultiplier": 0.03
    },
    "price": null,
    "sellPrice": 1450,
    "description": "A quarry worker bought this bow after the company began charging families for gathering fallen wood. She hunted the wooded slopes and traded meat for fuel, keeping her neighbors warm without owing the overseer a copper. Her tally of those trades still lines the inner limb.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ],
    "perk": {
      "id": "enough_to_share",
      "name": "Enough to Share",
      "amount": 0.1,
      "threshold": 0.5
    }
  },
  {
    "id": "STDS01",
    "name": "Starsteel Dagger",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 23,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 46.72,
      "speed": 2.7,
      "strength": 23.36,
      "agility": 46.72,
      "critChance": 0.0215,
      "critMultiplier": 0.0387
    },
    "price": null,
    "sellPrice": 1256,
    "description": "A dagger forged from metal that doesn't feel like metal...",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": []
  },
  {
    "id": "STLS01",
    "name": "Starsteel Longsword",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 23,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden"
    ],
    "stats": {
      "attackPower": 46.72,
      "speed": 2.7,
      "strength": 70.08,
      "critChance": 0.0215,
      "critMultiplier": 0.02
    },
    "price": null,
    "sellPrice": 1545,
    "description": "A longsword forged from metal that doesn't feel like metal...",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": []
  },
  {
    "id": "STSS01",
    "name": "Starsteel Shortsword",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 23,
    "usableBy": [
      "Gladiator",
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 46.72,
      "speed": 2.7,
      "strength": 70.08,
      "critChance": 0.0215,
      "critMultiplier": 0.02
    },
    "price": null,
    "sellPrice": 1545,
    "description": "A shortsword forged from metal that doesn't feel like metal...",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": []
  },
  {
    "id": "STHA01",
    "name": "Starsteel Handaxe",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 23,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 46.72,
      "speed": 2.7,
      "strength": 46.72,
      "agility": 23.36,
      "critChance": 0.0215,
      "critMultiplier": 0.02
    },
    "price": null,
    "sellPrice": 1545,
    "description": "A handaxe forged from metal that doesn't feel like metal...",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": []
  },
  {
    "id": "STGA01",
    "name": "Starsteel Greataxe",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 23,
    "usableBy": [
      "Gladiator",
      "Barbarian"
    ],
    "stats": {
      "attackPower": 81.76,
      "speed": 2.7,
      "strength": 70.08,
      "critChance": 0.0215,
      "critMultiplier": 0.02
    },
    "price": null,
    "sellPrice": 2032,
    "description": "A greataxe forged from metal that doesn't feel like metal...",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": []
  },
  {
    "id": "STMA01",
    "name": "Starsteel Mace",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 23,
    "usableBy": [
      "Grovekeeper",
      "Dawnpriest",
      "Sanguinist"
    ],
    "stats": {
      "spellPower": 134.32,
      "speed": 2.7,
      "critChance": 0.0215,
      "critMultiplier": 0.02
    },
    "price": null,
    "sellPrice": 1545,
    "description": "A mace forged from metal that doesn't feel like metal...",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": []
  },
  {
    "id": "STST01",
    "name": "Starseed Staff",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 23,
    "usableBy": [
      "Umbramancer",
      "Arcanist",
      "Spellbinder"
    ],
    "stats": {
      "spellPower": 134.32,
      "speed": 2.7,
      "critChance": 0.0215,
      "critMultiplier": 0.02
    },
    "price": null,
    "sellPrice": 1545,
    "description": "A staff grown from a seed from the stars...",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": []
  },
  {
    "id": "STBR01",
    "name": "Starseed Bow",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 23,
    "usableBy": [
      "Ranger"
    ],
    "stats": {
      "attackPower": 46.72,
      "speed": 2.7,
      "agility": 70.08,
      "critChance": 0.0215,
      "critMultiplier": 0.02
    },
    "price": null,
    "sellPrice": 1545,
    "description": "A bow grown from a seed from the stars...",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": []
  },
  {
    "id": "VSD01",
    "name": "Voidsteel Dagger",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 35,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 74.8,
      "speed": 3.3,
      "strength": 37.4,
      "agility": 74.8,
      "critChance": 0.0275,
      "critMultiplier": 0.0447
    },
    "price": null,
    "sellPrice": 2256,
    "description": "Highmere smiths quench Voidsteel in sealed troughs. This dagger emerged without a reflection, though its edge catches every fault in the light.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  },
  {
    "id": "VLS01",
    "name": "Voidsteel Longsword",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 35,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden"
    ],
    "stats": {
      "attackPower": 74.8,
      "speed": 3.3,
      "strength": 112.2,
      "critChance": 0.0275,
      "critMultiplier": 0.026
    },
    "price": null,
    "sellPrice": 2775,
    "description": "A narrow seam of darkness runs through the blade. Highmere sentries say it is easiest to keep watch with a sword that never gleams back at whatever waits beyond the gate.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  },
  {
    "id": "VSS01",
    "name": "Voidsteel Shortsword",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 35,
    "usableBy": [
      "Gladiator",
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 74.8,
      "speed": 3.3,
      "strength": 112.2,
      "critChance": 0.0275,
      "critMultiplier": 0.026
    },
    "price": null,
    "sellPrice": 2775,
    "description": "The gatewardens of Highmere favor a short blade in the narrow passages beneath their watchposts. Its dark steel carries no maker's stamp, only the number of the gate it guarded.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  },
  {
    "id": "VHA01",
    "name": "Voidsteel Handaxe",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 35,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 74.8,
      "speed": 3.3,
      "strength": 74.8,
      "agility": 37.4,
      "critChance": 0.0275,
      "critMultiplier": 0.026
    },
    "price": null,
    "sellPrice": 2775,
    "description": "Highmere pathfinders use these dark axes to cut stakes for the gate roads. The copper nails in the haft mark nights when the paths had to be found again.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  },
  {
    "id": "VGA01",
    "name": "Voidsteel Greataxe",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 35,
    "usableBy": [
      "Gladiator",
      "Barbarian"
    ],
    "stats": {
      "attackPower": 130.9,
      "speed": 3.3,
      "strength": 112.2,
      "critChance": 0.0275,
      "critMultiplier": 0.026
    },
    "price": null,
    "sellPrice": 3649,
    "description": "Forged for the crews who break ruined gate frames, this axe has a broad, lightless head. Its haft is wrapped twice where the first binding split under a single blow.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  },
  {
    "id": "ADS01",
    "name": "Aetherium Dagger",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 45,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 110.72,
      "speed": 3.8,
      "strength": 55.36,
      "agility": 110.72,
      "critChance": 0.0325,
      "critMultiplier": 0.0497
    },
    "price": null,
    "sellPrice": 3674,
    "description": "Aetherium holds a pale gleam after the forge goes dark. Highmere cutlers wrap each finished dagger before carrying it home, lest its light draw a following on the ridge roads.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  },
  {
    "id": "ALS01",
    "name": "Aetherium Longsword",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 45,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden"
    ],
    "stats": {
      "attackPower": 110.72,
      "speed": 3.8,
      "strength": 166.08,
      "critChance": 0.0325,
      "critMultiplier": 0.031
    },
    "price": null,
    "sellPrice": 4520,
    "description": "Thin bands of Aetherium are folded through this blade until the seams disappear. The smith signs the tang beneath the grip, where only the next person to repair it will see.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  },
  {
    "id": "ASS01",
    "name": "Aetherium Shortsword",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 45,
    "usableBy": [
      "Gladiator",
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 110.72,
      "speed": 3.8,
      "strength": 166.08,
      "critChance": 0.0325,
      "critMultiplier": 0.031
    },
    "price": null,
    "sellPrice": 4520,
    "description": "Highmere couriers carry this bright short sword beneath their traveling coats. Its hilt has room for two fingers above the guard, a grip learned on roads too narrow for a sweeping cut.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  },
  {
    "id": "AHA01",
    "name": "Aetherium Handaxe",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 45,
    "usableBy": [
      "Scoundrel",
      "Barmaid"
    ],
    "stats": {
      "attackPower": 110.72,
      "speed": 3.8,
      "strength": 110.72,
      "agility": 55.36,
      "critChance": 0.0325,
      "critMultiplier": 0.031
    },
    "price": null,
    "sellPrice": 4520,
    "description": "A pale vein runs from this axe's eye to its edge. Highmere smiths judge their work by whether that vein remains unbroken after the first winter's cutting.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  },
  {
    "id": "AGA01",
    "name": "Aetherium Greataxe",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 45,
    "usableBy": [
      "Gladiator",
      "Barbarian"
    ],
    "stats": {
      "attackPower": 193.76,
      "speed": 3.8,
      "strength": 166.08,
      "critChance": 0.0325,
      "critMultiplier": 0.031
    },
    "price": null,
    "sellPrice": 5944,
    "description": "Aetherium keeps this great head lighter than its size suggests. Highmere weaponmasters hang a bell from the training haft until the wielder can stop a stroke without sounding it.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  },
  {
    "id": "SBB01",
    "name": "Steel Breastplate",
    "slot": "armor",
    "rarity": "uncommon",
    "minimumLevel": 12,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden",
      "Barmaid"
    ],
    "stats": {
      "maxHp": 120,
      "armor": 120,
      "speed": -1.5,
      "constitution": 8,
      "block": 0.025
    },
    "price": 3600,
    "sellPrice": 1080,
    "description": "A polished steel chestguard that balances mobility with solid frontal protection.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "CMD01",
    "name": "Chain Mail",
    "slot": "armor",
    "rarity": "common",
    "minimumLevel": 7,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden"
    ],
    "stats": {
      "maxHp": 80,
      "armor": 80,
      "speed": -1.5,
      "constitution": 5,
      "block": 0.02
    },
    "price": 900,
    "sellPrice": 270,
    "description": "Heavy, full-body chain links that provide sturdy protection at the cost of weight.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "CSH01",
    "name": "Chain Shirt",
    "slot": "armor",
    "rarity": "uncommon",
    "minimumLevel": 12,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden",
      "Barbarian",
      "Barmaid",
      "Scoundrel",
      "Ranger"
    ],
    "stats": {
      "maxHp": 50,
      "armor": 35,
      "speed": 0.5,
      "agility": 3,
      "constitution": 2,
      "dodge": 0.0075,
      "block": 0.01
    },
    "price": 300,
    "sellPrice": 90,
    "description": "A flexible shirt of interlocking steel rings that protects the torso while staying breathable.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "SPB01",
    "name": "Steel Half Plate",
    "slot": "armor",
    "rarity": "uncommon",
    "minimumLevel": 17,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden",
      "Barmaid"
    ],
    "stats": {
      "maxHp": 180,
      "armor": 180,
      "speed": -2.5,
      "constitution": 12,
      "block": 0.035
    },
    "price": 10800,
    "sellPrice": 3240,
    "description": "Layered steel plates covering vital areas, offering strong defense without full armor weight.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ]
  },
  {
    "id": "PV01",
    "name": "Padded Leather Vest",
    "slot": "armor",
    "rarity": "common",
    "minimumLevel": 1,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden",
      "Barbarian",
      "Barmaid",
      "Scoundrel",
      "Ranger"
    ],
    "stats": {
      "maxHp": 10,
      "armor": 8,
      "speed": 1,
      "agility": 1,
      "dodge": 0.005
    },
    "price": 25,
    "sellPrice": 7,
    "description": "A soft, quilted leather vest offering basic protection without restricting movement.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "slime-cave",
      "thornbriar-hollow",
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "SAR01",
    "name": "Studded Leather Armor",
    "slot": "armor",
    "rarity": "common",
    "minimumLevel": 7,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden",
      "Barbarian",
      "Barmaid",
      "Scoundrel",
      "Ranger"
    ],
    "stats": {
      "maxHp": 25,
      "armor": 18,
      "speed": 1,
      "agility": 2,
      "constitution": 1,
      "dodge": 0.0075,
      "block": 0.005
    },
    "price": 100,
    "sellPrice": 30,
    "description": "Tough leather reinforced with metal studs, giving it a rugged, battle-ready feel.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "PAD01",
    "name": "Plate Armor",
    "slot": "armor",
    "rarity": "uncommon",
    "minimumLevel": 17,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden"
    ],
    "stats": {
      "maxHp": 180,
      "armor": 180,
      "speed": -3,
      "constitution": 12,
      "block": 0.035
    },
    "price": 10800,
    "sellPrice": 3240,
    "description": "Interlocking steel plates crafted for maximum protection, gleaming with disciplined craftsmanship.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ]
  },
  {
    "id": "RMD01",
    "name": "Ring Mail",
    "slot": "armor",
    "rarity": "common",
    "minimumLevel": 1,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden"
    ],
    "stats": {
      "maxHp": 50,
      "armor": 50,
      "speed": -1,
      "constitution": 3,
      "block": 0.015
    },
    "price": 300,
    "sellPrice": 90,
    "description": "Leather armor reinforced with loose steel rings, giving a rough but dependable defense.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "slime-cave",
      "thornbriar-hollow",
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "LRO01",
    "name": "Linen Robes",
    "slot": "armor",
    "rarity": "common",
    "minimumLevel": 1,
    "usableBy": [
      "Umbramancer",
      "Spellbinder",
      "Arcanist",
      "Dawnpriest",
      "Grovekeeper",
      "Sanguinist"
    ],
    "stats": {
      "maxHp": 30,
      "maxMana": 40,
      "armor": 20,
      "constitution": 2,
      "intellect": 2,
      "wisdom": 2,
      "dodge": 0.01
    },
    "price": 300,
    "sellPrice": 90,
    "description": "A simple robe of linen cloth, comfortable and flexible enough for long hours of spellcasting.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "slime-cave",
      "thornbriar-hollow",
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "RWR01",
    "name": "Reinforced Wool Robes",
    "slot": "armor",
    "rarity": "common",
    "minimumLevel": 7,
    "usableBy": [
      "Umbramancer",
      "Spellbinder",
      "Arcanist",
      "Dawnpriest",
      "Grovekeeper",
      "Sanguinist"
    ],
    "stats": {
      "maxHp": 50,
      "maxMana": 75,
      "armor": 40,
      "constitution": 4,
      "intellect": 4,
      "wisdom": 4,
      "dodge": 0.0125
    },
    "price": 900,
    "sellPrice": 270,
    "description": "Light garments reinforced with thin leather panels, offering modest protection without hindering movement.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "dolmark-den",
      "march-west-delves",
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "SRO01",
    "name": "Silk Robes",
    "slot": "armor",
    "rarity": "uncommon",
    "minimumLevel": 12,
    "usableBy": [
      "Umbramancer",
      "Spellbinder",
      "Arcanist",
      "Dawnpriest",
      "Grovekeeper",
      "Sanguinist"
    ],
    "stats": {
      "maxHp": 80,
      "maxMana": 125,
      "armor": 70,
      "constitution": 6,
      "intellect": 7,
      "wisdom": 7,
      "dodge": 0.015
    },
    "price": 3600,
    "sellPrice": 1080,
    "description": "A soft mantle and vest set spun with silk.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "RTR01",
    "name": "Runethread Robes",
    "slot": "armor",
    "rarity": "uncommon",
    "minimumLevel": 17,
    "usableBy": [
      "Umbramancer",
      "Spellbinder",
      "Arcanist",
      "Dawnpriest",
      "Grovekeeper",
      "Sanguinist"
    ],
    "stats": {
      "maxHp": 120,
      "maxMana": 200,
      "armor": 110,
      "constitution": 10,
      "intellect": 10,
      "wisdom": 10,
      "dodge": 0.02
    },
    "price": 10800,
    "sellPrice": 3240,
    "description": "A finely-stitched robe woven with faint arcane filaments that subtly strengthen the fabric.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ]
  },
  {
    "id": "UMI006",
    "name": "Nightwatch Mantle",
    "slot": "armor",
    "rarity": "rare",
    "minimumLevel": 15,
    "usableBy": [
      "Umbramancer",
      "Spellbinder",
      "Arcanist"
    ],
    "stats": {
      "maxHp": 170,
      "maxMana": 300,
      "armor": 145,
      "constitution": 12,
      "intellect": 22,
      "wisdom": 6,
      "critChance": 0.0185,
      "spellPower": 45
    },
    "price": null,
    "sellPrice": 2000,
    "description": "The signal mage at the Sunken Watch stitched spare lamp wicks into this mantle, drying them against her own warmth. When the river swallowed the lower stairs, she burned them one by one to guide the guards upward. The last wick remains inside the collar, wrapped in a letter asking Pineshire for relief.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ],
    "perk": {
      "id": "banked_embers",
      "name": "Banked Embers",
      "amount": 0.1,
      "threshold": 0.5
    }
  },
  {
    "id": "UMI007",
    "name": "Pell's Nightshirt",
    "slot": "armor",
    "rarity": "rare",
    "minimumLevel": 15,
    "usableBy": [
      "Dawnpriest",
      "Grovekeeper",
      "Sanguinist"
    ],
    "stats": {
      "maxHp": 190,
      "maxMana": 300,
      "armor": 145,
      "constitution": 12,
      "intellect": 6,
      "wisdom": 22,
      "critChance": 0.0185,
      "spellPower": 45
    },
    "price": null,
    "sellPrice": 2000,
    "description": "Brother Pell wore these patched vestments through the fever winter, sleeping between rounds in a chair beside the infirmary door. His patients mended the torn cuffs while he rested. Each repair used a different thread, and Pell could name the person behind every stitch. He never discovered who had sewn a small pillow into the collar.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ],
    "perk": {
      "id": "familiar_care",
      "name": "Familiar Care",
      "amount": 0.15,
      "threshold": 0.5
    }
  },
  {
    "id": "SM01",
    "name": "Scale Mail",
    "slot": "armor",
    "rarity": "uncommon",
    "minimumLevel": 17,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden",
      "Barbarian",
      "Barmaid",
      "Scoundrel",
      "Ranger"
    ],
    "stats": {
      "maxHp": 80,
      "armor": 60,
      "agility": 4,
      "constitution": 4,
      "dodge": 0.005,
      "block": 0.015
    },
    "price": 900,
    "sellPrice": 270,
    "description": "Overlapping steel scales sewn onto leather, clattering faintly with each step.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ]
  },
  {
    "id": "SAD01",
    "name": "Splint Armor",
    "slot": "armor",
    "rarity": "uncommon",
    "minimumLevel": 12,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden"
    ],
    "stats": {
      "maxHp": 120,
      "armor": 120,
      "speed": -2,
      "constitution": 8,
      "block": 0.025
    },
    "price": 3600,
    "sellPrice": 1080,
    "description": "Thick leather backing fitted with vertical steel splints, built for frontline endurance.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "verge-delves",
      "murmuring-abyss"
    ]
  },
  {
    "id": "R1AP01",
    "name": "The Last Muster",
    "slot": "armor",
    "rarity": "rare",
    "minimumLevel": 15,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden"
    ],
    "stats": {
      "maxHp": 250,
      "armor": 240,
      "speed": -3,
      "constitution": 18,
      "block": 0.04
    },
    "price": null,
    "sellPrice": 1120,
    "description": "Captain Dorran wore this breastplate while counting his soldiers across the river below the Sunken Watch. He refused to leave the bank until every name on the muster had answered. The roll was found tucked behind its lining, water-stained but complete. Beside the captain's own name, someone later wrote, \"Still awaiting relief.\"",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ],
    "perk": {
      "id": "last_muster",
      "name": "Hold Until Relieved",
      "amount": 0.1,
      "threshold": 0.5
    }
  },
  {
    "id": "R1AL01",
    "name": "Forester's Debt",
    "slot": "armor",
    "rarity": "rare",
    "minimumLevel": 15,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden",
      "Barbarian",
      "Barmaid",
      "Scoundrel",
      "Ranger"
    ],
    "stats": {
      "maxHp": 170,
      "armor": 150,
      "speed": 2,
      "agility": 18,
      "constitution": 12,
      "dodge": 0.0175
    },
    "price": null,
    "sellPrice": 1120,
    "description": "When Jack Fenner's crew went unpaid, Pineshire's leatherworker made this coat for the hunter who kept them fed. She took payment in promises and stitched each family's mark beneath the lining. Years later, a bandit brought it in for repairs. The leatherworker recognized the marks and asked him to wait while she fetched her neighbors.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "pineshire-reach"
    ],
    "lootSources": [
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "murmuring-abyss"
    ],
    "perk": {
      "id": "woodland_cover",
      "name": "Woodland Cover",
      "amount": 0.05,
      "threshold": 0.5
    }
  },
  {
    "id": "STAP01",
    "name": "Starsteel Plate",
    "slot": "armor",
    "rarity": "uncommon",
    "minimumLevel": 23,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden"
    ],
    "stats": {
      "maxHp": 365,
      "armor": 350,
      "speed": -3,
      "constitution": 26,
      "block": 0.045
    },
    "price": null,
    "sellPrice": 1545,
    "description": "Pale starsteel plates worked by the armorers of Highmere Crags. The metal stays cold beneath a mountain sun.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": []
  },
  {
    "id": "STAL01",
    "name": "Starsteel Brigandine",
    "slot": "armor",
    "rarity": "uncommon",
    "minimumLevel": 23,
    "usableBy": [
      "Gladiator",
      "Oathwarden",
      "Dawnwarden",
      "Barbarian",
      "Barmaid",
      "Scoundrel",
      "Ranger"
    ],
    "stats": {
      "maxHp": 250,
      "armor": 220,
      "speed": 2.7,
      "agility": 26,
      "constitution": 18,
      "dodge": 0.025
    },
    "price": null,
    "sellPrice": 1545,
    "description": "Small starsteel plates lie concealed beneath supple leather, made for Highmere scouts who must climb as readily as they fight.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": []
  },
  {
    "id": "STAC01",
    "name": "Starseed Mantle",
    "slot": "armor",
    "rarity": "uncommon",
    "minimumLevel": 23,
    "usableBy": [
      "Umbramancer",
      "Spellbinder",
      "Arcanist"
    ],
    "stats": {
      "maxHp": 250,
      "maxMana": 440,
      "armor": 210,
      "constitution": 18,
      "intellect": 32,
      "wisdom": 9,
      "spellPower": 66
    },
    "price": null,
    "sellPrice": 1545,
    "description": "A Highmere weaver set pale starseeds into this mantle's hems. Their faint warmth survives even the bitter winds above the tree line.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": []
  },
  {
    "id": "STAH01",
    "name": "Starseed Vestments",
    "slot": "armor",
    "rarity": "uncommon",
    "minimumLevel": 23,
    "usableBy": [
      "Dawnpriest",
      "Grovekeeper",
      "Sanguinist"
    ],
    "stats": {
      "maxHp": 275,
      "maxMana": 440,
      "armor": 210,
      "constitution": 18,
      "intellect": 9,
      "wisdom": 32,
      "spellPower": 66
    },
    "price": null,
    "sellPrice": 1545,
    "description": "Highmere's mountain healers weave these vestments with starseeds carried home by rescued climbers. Each seed is a patient who returned.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": []
  },
  {
    "id": "UMI002",
    "name": "Inlaid Mithril Bracelet",
    "slot": "accessory",
    "rarity": "uncommon",
    "minimumLevel": 10,
    "usableBy": [
      "Barmaid",
      "Scoundrel",
      "Ranger"
    ],
    "stats": {
      "maxHp": 50,
      "attackPower": 10,
      "speed": 2,
      "agility": 4,
      "constitution": 2,
      "dodge": 0.01,
      "hitChance": 0.005,
      "critChance": 0.005
    },
    "price": null,
    "sellPrice": 2000,
    "description": "A small leather bracelet with inlaid Mithril threads.",
    "enchantmentSlots": 1,
    "lootRegions": [],
    "lootSources": [],
    "lootLocations": []
  },
  {
    "id": "UMI001",
    "name": "Splendid Pearl Ring",
    "slot": "accessory",
    "rarity": "uncommon",
    "minimumLevel": 10,
    "usableBy": [
      "Umbramancer",
      "Spellbinder",
      "Arcanist",
      "Dawnpriest",
      "Grovekeeper",
      "Sanguinist"
    ],
    "stats": {
      "maxMana": 80,
      "constitution": 2,
      "intellect": 8,
      "wisdom": 4,
      "hitChance": 0.005,
      "critChance": 0.005,
      "spellPower": 10
    },
    "price": null,
    "sellPrice": 2000,
    "description": "A small ring of white gold with a pearl set into the center.",
    "enchantmentSlots": 1,
    "lootRegions": [],
    "lootSources": [],
    "lootLocations": []
  },
  {
    "id": "UMI003",
    "name": "Stalwart Shield",
    "slot": "accessory",
    "rarity": "uncommon",
    "minimumLevel": 10,
    "usableBy": [
      "Oathwarden",
      "Dawnwarden",
      "Gladiator",
      "Barmaid"
    ],
    "stats": {
      "maxHp": 120,
      "armor": 100,
      "speed": -2,
      "strength": 4,
      "constitution": 6,
      "block": 0.03
    },
    "price": null,
    "sellPrice": 2000,
    "description": "A medium-sized shield decorated with gold lion in the center.",
    "enchantmentSlots": 1,
    "lootRegions": [],
    "lootSources": [],
    "lootLocations": []
  },
  {
    "id": "VMA01",
    "name": "Voidsteel Mace",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 35,
    "usableBy": [
      "Grovekeeper",
      "Dawnpriest",
      "Sanguinist"
    ],
    "stats": {
      "spellPower": 215.05,
      "speed": 3.3,
      "critChance": 0.0275,
      "critMultiplier": 0.026
    },
    "price": null,
    "sellPrice": 2775,
    "description": "Highmere's field clerics bind prayer cords beneath the head of this mace. Its hollow note carries through the gate winds when a spoken blessing cannot.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  },
  {
    "id": "VGST01",
    "name": "Voidgate Branch",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 35,
    "usableBy": [
      "Umbramancer",
      "Arcanist",
      "Spellbinder"
    ],
    "stats": {
      "spellPower": 215.05,
      "speed": 3.3,
      "critChance": 0.0275,
      "critMultiplier": 0.026
    },
    "price": null,
    "sellPrice": 2775,
    "description": "A branch gathered where a gate opened through a living tree. Its severed buds still turn toward unseen light, and Highmere mages keep its roots wrapped even after the wood has dried.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  },
  {
    "id": "VGBR01",
    "name": "Voidgate Bow",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 35,
    "usableBy": [
      "Ranger"
    ],
    "stats": {
      "attackPower": 74.8,
      "speed": 3.3,
      "agility": 112.2,
      "critChance": 0.0275,
      "critMultiplier": 0.026
    },
    "price": null,
    "sellPrice": 2775,
    "description": "This bow was shaped from timber bent around a sealed gate. Highmere bowyers leave that curve untouched, saying the wood remembers a farther shore.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  },
  {
    "id": "AMA01",
    "name": "Aetherium Mace",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 45,
    "usableBy": [
      "Grovekeeper",
      "Dawnpriest",
      "Sanguinist"
    ],
    "stats": {
      "spellPower": 318.33,
      "speed": 3.8,
      "critChance": 0.0325,
      "critMultiplier": 0.031
    },
    "price": null,
    "sellPrice": 4520,
    "description": "Three shallow channels circle this mace's Aetherium head, each left open for a cleric's own blessing. Highmere smiths deliver it without an inscription, refusing to choose the prayer for its bearer.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  },
  {
    "id": "ALST01",
    "name": "Aetherium-lined Staff",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 45,
    "usableBy": [
      "Umbramancer",
      "Arcanist",
      "Spellbinder"
    ],
    "stats": {
      "spellPower": 318.33,
      "speed": 3.8,
      "critChance": 0.0325,
      "critMultiplier": 0.031
    },
    "price": null,
    "sellPrice": 4520,
    "description": "Aetherium wire lines the grain of this staff instead of binding its surface. Highmere mages trace the pale seams with a thumb while waiting for a difficult working to settle.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  },
  {
    "id": "ALBR01",
    "name": "Aetherium-lined Bow",
    "slot": "weapon",
    "rarity": "uncommon",
    "minimumLevel": 45,
    "usableBy": [
      "Ranger"
    ],
    "stats": {
      "attackPower": 110.72,
      "speed": 3.8,
      "agility": 166.08,
      "critChance": 0.0325,
      "critMultiplier": 0.031
    },
    "price": null,
    "sellPrice": 4520,
    "description": "Fine Aetherium strips follow the inner limbs of this bow. Highmere bowyers tune them beside a running stream, listening for a note that disappears beneath the water.",
    "enchantmentSlots": 1,
    "lootRegions": [
      "highmere-crags"
    ],
    "lootSources": [
      "wave",
      "boss",
      "everdeep"
    ],
    "lootLocations": [
      "*"
    ]
  }
];

// New class gear shares the established regional tier and recipe rules.
AUTHORED_EQUIPMENT.push(...runebladeEquipment(AUTHORED_EQUIPMENT));
AUTHORED_EQUIPMENT.push(...EARLY_EQUIPMENT);
AUTHORED_EQUIPMENT.push(...pineshireEquipment(AUTHORED_EQUIPMENT));
for (const item of AUTHORED_EQUIPMENT) {

  // Only leather armor gains the new class, keeping mail, plate and robes restricted.
  if (['PV01', 'SAR01', 'R1AL01', 'STAL01'].includes(item.id)) item.usableBy.push('Runedancer');
}

export const AUTHORED_EQUIPMENT_RECIPES = [
  {
    "id": "RBDS01",
    "name": "Recipe: Bronze Dagger",
    "category": "equipment",
    "description": "Craft Bronze Dagger.",
    "output": {
      "type": "equipment",
      "itemId": "BDS01",
      "count": 1
    },
    "ingredients": {
      "MAT001": 1,
      "MAT005": 1,
      "MAT009": 1
    },
    "fee": 6,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RBLS01",
    "name": "Recipe: Bronze Longsword",
    "category": "equipment",
    "description": "Craft Bronze Longsword.",
    "output": {
      "type": "equipment",
      "itemId": "BLS01",
      "count": 1
    },
    "ingredients": {
      "MAT001": 3,
      "MAT005": 1,
      "MAT009": 1
    },
    "fee": 8,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RBSS01",
    "name": "Recipe: Bronze Shortsword",
    "category": "equipment",
    "description": "Craft Bronze Shortsword.",
    "output": {
      "type": "equipment",
      "itemId": "BSS01",
      "count": 1
    },
    "ingredients": {
      "MAT001": 2,
      "MAT005": 1,
      "MAT009": 1
    },
    "fee": 6,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RBHA01",
    "name": "Recipe: Bronze Handaxe",
    "category": "equipment",
    "description": "Craft Bronze Handaxe.",
    "output": {
      "type": "equipment",
      "itemId": "BHA01",
      "count": 1
    },
    "ingredients": {
      "MAT001": 3,
      "MAT005": 1,
      "MAT009": 1
    },
    "fee": 6,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RBGA01",
    "name": "Recipe: Bronze Greataxe",
    "category": "equipment",
    "description": "Craft Bronze Greataxe.",
    "output": {
      "type": "equipment",
      "itemId": "BGA01",
      "count": 1
    },
    "ingredients": {
      "MAT001": 5,
      "MAT005": 1,
      "MAT009": 1
    },
    "fee": 12,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RBRM01",
    "name": "Recipe: Bronze Mace",
    "category": "equipment",
    "description": "Craft Bronze Mace.",
    "output": {
      "type": "equipment",
      "itemId": "BRM01",
      "count": 1
    },
    "ingredients": {
      "MAT001": 3,
      "MAT005": 1,
      "MAT009": 1
    },
    "fee": 6,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RPSS01",
    "name": "Recipe: Pine Staff",
    "category": "equipment",
    "description": "Craft Pine Staff.",
    "output": {
      "type": "equipment",
      "itemId": "PST01",
      "count": 1
    },
    "ingredients": {
      "MAT005": 3
    },
    "fee": 6,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RPBS01",
    "name": "Recipe: Pine Bow",
    "category": "equipment",
    "description": "Craft Pine Bow.",
    "output": {
      "type": "equipment",
      "itemId": "PBR01",
      "count": 1
    },
    "ingredients": {
      "MAT005": 3
    },
    "fee": 6,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RIDS01",
    "name": "Recipe: Iron Dagger",
    "category": "equipment",
    "description": "Craft Iron Dagger.",
    "output": {
      "type": "equipment",
      "itemId": "IDS01",
      "count": 1
    },
    "ingredients": {
      "MAT002": 2
    },
    "fee": 25,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RILS01",
    "name": "Recipe: Iron Longsword",
    "category": "equipment",
    "description": "Craft Iron Longsword.",
    "output": {
      "type": "equipment",
      "itemId": "ILS01",
      "count": 1
    },
    "ingredients": {
      "MAT002": 3
    },
    "fee": 35,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RISS01",
    "name": "Recipe: Iron Shortsword",
    "category": "equipment",
    "description": "Craft Iron Shortsword.",
    "output": {
      "type": "equipment",
      "itemId": "ISS01",
      "count": 1
    },
    "ingredients": {
      "MAT002": 2
    },
    "fee": 25,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RIHA01",
    "name": "Recipe: Iron Handaxe",
    "category": "equipment",
    "description": "Craft Iron Handaxe.",
    "output": {
      "type": "equipment",
      "itemId": "IHA01",
      "count": 1
    },
    "ingredients": {
      "MAT002": 3,
      "MAT006": 1,
      "MAT009": 1
    },
    "fee": 25,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RIGA01",
    "name": "Recipe: Iron Greataxe",
    "category": "equipment",
    "description": "Craft Iron Greataxe.",
    "output": {
      "type": "equipment",
      "itemId": "IGA01",
      "count": 1
    },
    "ingredients": {
      "MAT002": 5,
      "MAT006": 1,
      "MAT009": 1
    },
    "fee": 50,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RIMA01",
    "name": "Recipe: Iron Mace",
    "category": "equipment",
    "description": "Craft Iron Mace.",
    "output": {
      "type": "equipment",
      "itemId": "IMA01",
      "count": 1
    },
    "ingredients": {
      "MAT002": 3,
      "MAT006": 1,
      "MAT009": 1
    },
    "fee": 25,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RMST01",
    "name": "Recipe: Maple Staff",
    "category": "equipment",
    "description": "Craft Maple Staff.",
    "output": {
      "type": "equipment",
      "itemId": "MST01",
      "count": 1
    },
    "ingredients": {
      "MAT006": 3
    },
    "fee": 28,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RMBS01",
    "name": "Recipe: Maple Bow",
    "category": "equipment",
    "description": "Craft Maple Bow.",
    "output": {
      "type": "equipment",
      "itemId": "MBR01",
      "count": 1
    },
    "ingredients": {
      "MAT006": 3
    },
    "fee": 28,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RMDS01",
    "name": "Recipe: Mithril Dagger",
    "category": "equipment",
    "description": "Craft Mithril Dagger.",
    "output": {
      "type": "equipment",
      "itemId": "MDS01",
      "count": 1
    },
    "ingredients": {
      "MAT004": 2,
      "MAT008": 1,
      "MAT009": 1
    },
    "fee": 66,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RMLS01",
    "name": "Recipe: Mithril Longsword",
    "category": "equipment",
    "description": "Craft Mithril Longsword.",
    "output": {
      "type": "equipment",
      "itemId": "MLS01",
      "count": 1
    },
    "ingredients": {
      "MAT004": 3,
      "MAT008": 1,
      "MAT009": 1
    },
    "fee": 89,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RMSS01",
    "name": "Recipe: Mithril Shortsword",
    "category": "equipment",
    "description": "Craft Mithril Shortsword.",
    "output": {
      "type": "equipment",
      "itemId": "MSS01",
      "count": 1
    },
    "ingredients": {
      "MAT004": 2,
      "MAT008": 1,
      "MAT009": 1
    },
    "fee": 66,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RMHA01",
    "name": "Recipe: Mithril Handaxe",
    "category": "equipment",
    "description": "Craft Mithril Handaxe.",
    "output": {
      "type": "equipment",
      "itemId": "MHA01",
      "count": 1
    },
    "ingredients": {
      "MAT004": 3,
      "MAT008": 1,
      "MAT009": 1
    },
    "fee": 89,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RMGA01",
    "name": "Recipe: Mithril Greataxe",
    "category": "equipment",
    "description": "Craft Mithril Greataxe.",
    "output": {
      "type": "equipment",
      "itemId": "MGA01",
      "count": 1
    },
    "ingredients": {
      "MAT004": 5,
      "MAT008": 1,
      "MAT009": 1
    },
    "fee": 136,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RMMA01",
    "name": "Recipe: Mithril Mace",
    "category": "equipment",
    "description": "Craft Mithril Mace.",
    "output": {
      "type": "equipment",
      "itemId": "MMA01",
      "count": 1
    },
    "ingredients": {
      "MAT004": 3,
      "MAT008": 1,
      "MAT009": 1
    },
    "fee": 89,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "ROST01",
    "name": "Recipe: Oak Staff",
    "category": "equipment",
    "description": "Craft Oak Staff.",
    "output": {
      "type": "equipment",
      "itemId": "OST01",
      "count": 1
    },
    "ingredients": {
      "MAT008": 4,
      "MAT020": 2,
      "MAT014": 1
    },
    "fee": 25,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "ROBR01",
    "name": "Recipe: Oak Bow",
    "category": "equipment",
    "description": "Craft Oak Bow.",
    "output": {
      "type": "equipment",
      "itemId": "OBR01",
      "count": 1
    },
    "ingredients": {
      "MAT008": 4,
      "MAT009": 2,
      "MAT018": 1
    },
    "fee": 25,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RSDS01",
    "name": "Recipe: Steel Dagger",
    "category": "equipment",
    "description": "Craft Steel Dagger.",
    "output": {
      "type": "equipment",
      "itemId": "SDS01",
      "count": 1
    },
    "ingredients": {
      "MAT003": 3,
      "MAT007": 1,
      "MAT009": 1
    },
    "fee": 274,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RSLS01",
    "name": "Recipe: Steel Longsword",
    "category": "equipment",
    "description": "Craft Steel Longsword.",
    "output": {
      "type": "equipment",
      "itemId": "SLS01",
      "count": 1
    },
    "ingredients": {
      "MAT003": 4,
      "MAT007": 1,
      "MAT009": 1
    },
    "fee": 371,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RSSS01",
    "name": "Recipe: Steel Shortsword",
    "category": "equipment",
    "description": "Craft Steel Shortsword.",
    "output": {
      "type": "equipment",
      "itemId": "SSS01",
      "count": 1
    },
    "ingredients": {
      "MAT003": 3,
      "MAT007": 1,
      "MAT009": 1
    },
    "fee": 274,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RSHA01",
    "name": "Recipe: Steel Handaxe",
    "category": "equipment",
    "description": "Craft Steel Handaxe.",
    "output": {
      "type": "equipment",
      "itemId": "SHA01",
      "count": 1
    },
    "ingredients": {
      "MAT003": 4,
      "MAT007": 1,
      "MAT009": 1
    },
    "fee": 371,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RSGA01",
    "name": "Recipe: Steel Greataxe",
    "category": "equipment",
    "description": "Craft Steel Greataxe.",
    "output": {
      "type": "equipment",
      "itemId": "SGA01",
      "count": 1
    },
    "ingredients": {
      "MAT003": 6,
      "MAT007": 1,
      "MAT009": 1
    },
    "fee": 568,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RSMA01",
    "name": "Recipe: Steel Mace",
    "category": "equipment",
    "description": "Craft Steel Mace.",
    "output": {
      "type": "equipment",
      "itemId": "SMA01",
      "count": 1
    },
    "ingredients": {
      "MAT003": 4,
      "MAT007": 1,
      "MAT009": 1
    },
    "fee": 371,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RIST01",
    "name": "Recipe: Ironwood Staff",
    "category": "equipment",
    "description": "Craft Ironwood Staff.",
    "output": {
      "type": "equipment",
      "itemId": "IST01",
      "count": 1
    },
    "ingredients": {
      "MAT007": 5,
      "MAT020": 3,
      "MAT014": 2
    },
    "fee": 331,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RIBR01",
    "name": "Recipe: Ironwood Bow",
    "category": "equipment",
    "description": "Craft Ironwood Bow.",
    "output": {
      "type": "equipment",
      "itemId": "IBR01",
      "count": 1
    },
    "ingredients": {
      "MAT007": 5,
      "MAT009": 3,
      "MAT018": 2
    },
    "fee": 351,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RVSD01",
    "name": "Recipe: Voidsteel Dagger",
    "category": "equipment",
    "description": "Craft Voidsteel Dagger.",
    "output": {
      "type": "equipment",
      "itemId": "VSD01",
      "count": 1
    },
    "ingredients": {
      "MAT003": 4,
      "MAT004": 4,
      "MAT014": 4,
      "MAT020": 4
    },
    "fee": 2482,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RVLS01",
    "name": "Recipe: Voidsteel Longsword",
    "category": "equipment",
    "description": "Craft Voidsteel Longsword.",
    "output": {
      "type": "equipment",
      "itemId": "VLS01",
      "count": 1
    },
    "ingredients": {
      "MAT003": 6,
      "MAT004": 6,
      "MAT014": 4,
      "MAT020": 4
    },
    "fee": 3053,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RVSS01",
    "name": "Recipe: Voidsteel Shortsword",
    "category": "equipment",
    "description": "Craft Voidsteel Shortsword.",
    "output": {
      "type": "equipment",
      "itemId": "VSS01",
      "count": 1
    },
    "ingredients": {
      "MAT003": 4,
      "MAT004": 4,
      "MAT014": 4,
      "MAT020": 4
    },
    "fee": 3053,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RVHA01",
    "name": "Recipe: Voidsteel Handaxe",
    "category": "equipment",
    "description": "Craft Voidsteel Handaxe.",
    "output": {
      "type": "equipment",
      "itemId": "VHA01",
      "count": 1
    },
    "ingredients": {
      "MAT003": 5,
      "MAT004": 5,
      "MAT014": 4,
      "MAT020": 4
    },
    "fee": 3053,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RVGA01",
    "name": "Recipe: Voidsteel Greataxe",
    "category": "equipment",
    "description": "Craft Voidsteel Greataxe.",
    "output": {
      "type": "equipment",
      "itemId": "VGA01",
      "count": 1
    },
    "ingredients": {
      "MAT003": 8,
      "MAT004": 8,
      "MAT014": 4,
      "MAT020": 4
    },
    "fee": 4014,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RADS01",
    "name": "Recipe: Aetherium Dagger",
    "category": "equipment",
    "description": "Craft Aetherium Dagger.",
    "output": {
      "type": "equipment",
      "itemId": "ADS01",
      "count": 1
    },
    "ingredients": {
      "MAT004": 6,
      "MAT013": 5,
      "MAT014": 5,
      "MAT015": 4
    },
    "fee": 4042,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RALS01",
    "name": "Recipe: Aetherium Longsword",
    "category": "equipment",
    "description": "Craft Aetherium Longsword.",
    "output": {
      "type": "equipment",
      "itemId": "ALS01",
      "count": 1
    },
    "ingredients": {
      "MAT004": 8,
      "MAT013": 5,
      "MAT014": 5,
      "MAT015": 4
    },
    "fee": 4972,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RASS01",
    "name": "Recipe: Aetherium Shortsword",
    "category": "equipment",
    "description": "Craft Aetherium Shortsword.",
    "output": {
      "type": "equipment",
      "itemId": "ASS01",
      "count": 1
    },
    "ingredients": {
      "MAT004": 6,
      "MAT013": 5,
      "MAT014": 5,
      "MAT015": 4
    },
    "fee": 4972,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RAHA01",
    "name": "Recipe: Aetherium Handaxe",
    "category": "equipment",
    "description": "Craft Aetherium Handaxe.",
    "output": {
      "type": "equipment",
      "itemId": "AHA01",
      "count": 1
    },
    "ingredients": {
      "MAT004": 7,
      "MAT013": 5,
      "MAT014": 5,
      "MAT015": 4
    },
    "fee": 4972,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RAGA01",
    "name": "Recipe: Aetherium Greataxe",
    "category": "equipment",
    "description": "Craft Aetherium Greataxe.",
    "output": {
      "type": "equipment",
      "itemId": "AGA01",
      "count": 1
    },
    "ingredients": {
      "MAT004": 10,
      "MAT013": 5,
      "MAT014": 5,
      "MAT015": 4
    },
    "fee": 6539,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RSBS01",
    "name": "Recipe: Steel Breastplate",
    "category": "equipment",
    "description": "Craft Steel Breastplate.",
    "output": {
      "type": "equipment",
      "itemId": "SBB01",
      "count": 1
    },
    "ingredients": {
      "MAT002": 2,
      "MAT024": 4
    },
    "fee": 900,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RCMS01",
    "name": "Recipe: Chain Mail",
    "category": "equipment",
    "description": "Craft Chain Mail.",
    "output": {
      "type": "equipment",
      "itemId": "CMD01",
      "count": 1
    },
    "ingredients": {
      "MAT022": 3
    },
    "fee": 225,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RCSS01",
    "name": "Recipe: Chain Shirt",
    "category": "equipment",
    "description": "Craft Chain Shirt.",
    "output": {
      "type": "equipment",
      "itemId": "CSH01",
      "count": 1
    },
    "ingredients": {
      "MAT022": 6
    },
    "fee": 75,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RSHPS01",
    "name": "Recipe: Steel Half Plate",
    "category": "equipment",
    "description": "Craft Steel Half Plate.",
    "output": {
      "type": "equipment",
      "itemId": "SPB01",
      "count": 1
    },
    "ingredients": {
      "MAT002": 2,
      "MAT024": 4
    },
    "fee": 2700,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RPLVS01",
    "name": "Recipe: Padded Leather Vest",
    "category": "equipment",
    "description": "Craft Padded Leather Vest.",
    "output": {
      "type": "equipment",
      "itemId": "PV01",
      "count": 1
    },
    "ingredients": {
      "MAT009": 3
    },
    "fee": 6,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RSLAS01",
    "name": "Recipe: Studded Leather Armor",
    "category": "equipment",
    "description": "Craft Studded Leather Armor.",
    "output": {
      "type": "equipment",
      "itemId": "SAR01",
      "count": 1
    },
    "ingredients": {
      "MAT009": 2,
      "MAT021": 4
    },
    "fee": 25,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RPAS01",
    "name": "Recipe: Plate Armor",
    "category": "equipment",
    "description": "Craft Plate Armor.",
    "output": {
      "type": "equipment",
      "itemId": "PAD01",
      "count": 1
    },
    "ingredients": {
      "MAT003": 2,
      "MAT024": 4
    },
    "fee": 2700,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RRMS01",
    "name": "Recipe: Ring Mail",
    "category": "equipment",
    "description": "Craft Ring Mail.",
    "output": {
      "type": "equipment",
      "itemId": "RMD01",
      "count": 1
    },
    "ingredients": {
      "MAT022": 3,
      "MAT009": 2
    },
    "fee": 75,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RLRS01",
    "name": "Recipe: Linen Robes",
    "category": "equipment",
    "description": "Craft Linen Robes.",
    "output": {
      "type": "equipment",
      "itemId": "LRO01",
      "count": 1
    },
    "ingredients": {
      "MAT010": 3
    },
    "fee": 75,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RRWRS01",
    "name": "Recipe: Reinforced Wool Robes",
    "category": "equipment",
    "description": "Craft Reinforced Wool Robes.",
    "output": {
      "type": "equipment",
      "itemId": "RWR01",
      "count": 1
    },
    "ingredients": {
      "MAT011": 2,
      "MAT009": 1
    },
    "fee": 225,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RSRS01",
    "name": "Recipe: Silk Robes",
    "category": "equipment",
    "description": "Craft Silk Robes.",
    "output": {
      "type": "equipment",
      "itemId": "SRO01",
      "count": 1
    },
    "ingredients": {
      "MAT011": 2,
      "MAT012": 4
    },
    "fee": 900,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RRRS01",
    "name": "Recipe: Runethread Robes",
    "category": "equipment",
    "description": "Craft Runethread Robes.",
    "output": {
      "type": "equipment",
      "itemId": "RTR01",
      "count": 1
    },
    "ingredients": {
      "MAT012": 2,
      "MAT013": 4
    },
    "fee": 2700,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RSMS01",
    "name": "Recipe: Scale Mail",
    "category": "equipment",
    "description": "Craft Scale Mail.",
    "output": {
      "type": "equipment",
      "itemId": "SM01",
      "count": 1
    },
    "ingredients": {
      "MAT022": 3,
      "MAT023": 4
    },
    "fee": 225,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RSAS01",
    "name": "Recipe: Splint Armor",
    "category": "equipment",
    "description": "Craft Splint Armor.",
    "output": {
      "type": "equipment",
      "itemId": "SAD01",
      "count": 1
    },
    "ingredients": {
      "MAT002": 2,
      "MAT024": 4
    },
    "fee": 900,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RITS01",
    "name": "Recipe: Iron Studs",
    "category": "material",
    "description": "Craft Iron Studs.",
    "output": {
      "type": "material",
      "itemId": "MAT021",
      "count": 2
    },
    "ingredients": {
      "MAT002": 1
    },
    "fee": 0,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RILK01",
    "name": "Recipe: Iron Links",
    "category": "material",
    "description": "Craft Iron Links.",
    "output": {
      "type": "material",
      "itemId": "MAT022",
      "count": 3
    },
    "ingredients": {
      "MAT002": 2
    },
    "fee": 0,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RSCS01",
    "name": "Recipe: Steel Scales",
    "category": "material",
    "description": "Craft Steel Scales.",
    "output": {
      "type": "material",
      "itemId": "MAT023",
      "count": 2
    },
    "ingredients": {
      "MAT002": 3
    },
    "fee": 0,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RSPS01",
    "name": "Recipe: Steel Plates",
    "category": "material",
    "description": "Craft Steel Plates.",
    "output": {
      "type": "material",
      "itemId": "MAT024",
      "count": 1
    },
    "ingredients": {
      "MAT003": 3,
      "MAT002": 1
    },
    "fee": 0,
    "knownAtStart": true,
    "learnedFrom": "Known at start",
    "crafter": "Blacksmith"
  },
  {
    "id": "RVMA01",
    "name": "Recipe: Voidsteel Mace",
    "category": "equipment",
    "description": "Craft Voidsteel Mace.",
    "output": {
      "type": "equipment",
      "itemId": "VMA01",
      "count": 1
    },
    "ingredients": {
      "MAT003": 6,
      "MAT004": 6,
      "MAT014": 4,
      "MAT020": 4
    },
    "fee": 3053,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RVGST01",
    "name": "Recipe: Voidgate Branch",
    "category": "equipment",
    "description": "Craft Voidgate Branch.",
    "output": {
      "type": "equipment",
      "itemId": "VGST01",
      "count": 1
    },
    "ingredients": {
      "MAT003": 6,
      "MAT004": 6,
      "MAT014": 4,
      "MAT020": 4,
      "MAT007": 8
    },
    "fee": 3053,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RVGBR01",
    "name": "Recipe: Voidgate Bow",
    "category": "equipment",
    "description": "Craft Voidgate Bow.",
    "output": {
      "type": "equipment",
      "itemId": "VGBR01",
      "count": 1
    },
    "ingredients": {
      "MAT003": 6,
      "MAT004": 6,
      "MAT014": 4,
      "MAT020": 4,
      "MAT007": 8
    },
    "fee": 3053,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RAMA01",
    "name": "Recipe: Aetherium Mace",
    "category": "equipment",
    "description": "Craft Aetherium Mace.",
    "output": {
      "type": "equipment",
      "itemId": "AMA01",
      "count": 1
    },
    "ingredients": {
      "MAT004": 8,
      "MAT013": 5,
      "MAT014": 5,
      "MAT015": 4
    },
    "fee": 4972,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RALST01",
    "name": "Recipe: Aetherium-lined Staff",
    "category": "equipment",
    "description": "Craft Aetherium-lined Staff.",
    "output": {
      "type": "equipment",
      "itemId": "ALST01",
      "count": 1
    },
    "ingredients": {
      "MAT004": 8,
      "MAT013": 5,
      "MAT014": 5,
      "MAT015": 4,
      "MAT007": 8
    },
    "fee": 4972,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  },
  {
    "id": "RALBR01",
    "name": "Recipe: Aetherium-lined Bow",
    "category": "equipment",
    "description": "Craft Aetherium-lined Bow.",
    "output": {
      "type": "equipment",
      "itemId": "ALBR01",
      "count": 1
    },
    "ingredients": {
      "MAT004": 8,
      "MAT013": 5,
      "MAT014": 5,
      "MAT015": 4,
      "MAT007": 8
    },
    "fee": 4972,
    "knownAtStart": false,
    "learnedFrom": "Discovered in inventory",
    "crafter": "Blacksmith"
  }
];

AUTHORED_EQUIPMENT_RECIPES.push(...runebladeRecipes(AUTHORED_EQUIPMENT_RECIPES));

export const EQUIPMENT_LOOT_TABLES = [
  {
    "region": "pineshire-reach",
    "difficulty": "Easy",
    "source": "wave",
    "location": "slime-cave",
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0,
      "uncommon": 0,
      "common": 0.008
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Easy",
    "source": "boss",
    "location": "slime-cave",
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0,
      "uncommon": 0,
      "common": 0.4
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Difficult",
    "source": "wave",
    "location": "thornbriar-hollow",
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0,
      "uncommon": 0.00025,
      "common": 0.01
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Difficult",
    "source": "boss",
    "location": "thornbriar-hollow",
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0,
      "uncommon": 0.03,
      "common": 0.45
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Tough",
    "source": "wave",
    "location": "dolmark-den",
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0,
      "uncommon": 0.0005,
      "common": 0.012
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Tough",
    "source": "boss",
    "location": "dolmark-den",
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0,
      "uncommon": 0.06,
      "common": 0.5
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Very Tough",
    "source": "wave",
    "location": "march-west-delves",
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0,
      "uncommon": 0.001,
      "common": 0.012
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Very Tough",
    "source": "boss",
    "location": "march-west-delves",
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0,
      "uncommon": 0.1,
      "common": 0.5
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Very Tough",
    "source": "wave",
    "location": "verge-delves",
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0,
      "uncommon": 0.001,
      "common": 0.012
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Very Tough",
    "source": "boss",
    "location": "verge-delves",
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0,
      "uncommon": 0.1,
      "common": 0.5
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Incredibly Tough",
    "source": "wave",
    "location": "murmuring-abyss",
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0,
      "uncommon": 0.0015,
      "common": 0.012
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Incredibly Tough",
    "source": "boss",
    "location": "murmuring-abyss",
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0.08,
      "uncommon": 0.2,
      "common": 0.55
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Chest",
    "source": "everdeep",
    "location": "everdeep",
    "firstChest": 1,
    "lastChest": 1,
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0.005,
      "uncommon": 0.19999999999999998,
      "common": 1
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Chest",
    "source": "everdeep",
    "location": "everdeep",
    "firstChest": 2,
    "lastChest": 2,
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0.01,
      "uncommon": 0.22,
      "common": 1
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Chest",
    "source": "everdeep",
    "location": "everdeep",
    "firstChest": 3,
    "lastChest": 3,
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0.015,
      "uncommon": 0.24,
      "common": 1
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Chest",
    "source": "everdeep",
    "location": "everdeep",
    "firstChest": 4,
    "lastChest": 4,
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0.02,
      "uncommon": 0.26,
      "common": 1
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Chest",
    "source": "everdeep",
    "location": "everdeep",
    "firstChest": 5,
    "lastChest": 5,
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0.025,
      "uncommon": 0.28,
      "common": 1
    }
  },
  {
    "region": "pineshire-reach",
    "difficulty": "Chest",
    "source": "everdeep",
    "location": "everdeep",
    "firstChest": 6,
    "lastChest": 6,
    "rolls": {
      "legendary": 0,
      "epic": 0,
      "rare": 0.03,
      "uncommon": 0.3,
      "common": 1
    }
  }
];

// Early rares can now appear before the Abyss. Epics remain a small boss/chest
// opportunity; ordinary wave drops never roll the new epic tier.
const earlyBossRolls = {
  'slime-cave': { rare: 0.01, epic: 0 },
  'thornbriar-hollow': { rare: 0.02, epic: 0 },
  'dolmark-den': { rare: 0.03, epic: 0.004 },
  'march-west-delves': { rare: 0.04, epic: 0.005 },
  'verge-delves': { rare: 0.04, epic: 0.005 },
  'murmuring-abyss': { rare: 0.08, epic: 0.01 }
};
for (const table of EQUIPMENT_LOOT_TABLES) {
  if (table.region !== 'pineshire-reach') continue;
  if (table.source === 'boss') Object.assign(table.rolls, earlyBossRolls[table.location]);
  if (table.source === 'everdeep') table.rolls.epic = 0.001 + (table.firstChest - 1) * 0.0005;
}

export const LEGACY_EVERDEEP_ITEM_IDS = ["BLS01","ILS01","SLS01","MLS01","BSS01","ISS01","SSS01","MSS01","BDS01","IDS01","SDS01","MDS01","PST01","MST01","OST01","IST01","PBR01","MBR01","OBR01","IBR01","PV01","SAR01","CSH01","SM01","SBB01","SPB01","RMD01","CMD01","SAD01","PAD01","LRO01","RWR01","SRO01","RTR01","UMI004","UMI005","UMI006","UMI007"];
