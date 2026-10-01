# Game design

## Core loop and player role

The player is a persistent Raid Leader, separate from the five adventurers they command. Select a world-map location, choose a party and equipped leadership tactics, enter a delve, direct real-time combat through waves and a boss, then collect rewards and advance roster, leader and map progress. The battle is a compact free-moving 2D arena, not a turn-based grid, though ability targeting uses visible grid cells.

## Party and classes

A party has five adventurers, at most one Tank, two Healers and four DPS. DPS include melee and ranged roles. Current classes and individual kits are defined in `data/classes.js`; the provisional tuning and saved roster mappings are in [Class abilities](CLASS_ABILITIES.md). Character identity persists through roster IDs, experience, equipment and encounter history. Personality, rarity and event-driven happiness are longer-term ideas, not complete systems.

## Combat commands

Adventurers acquire targets, move, attack, heal and cast by class. The player can select individuals or role groups, issue Move, Hold, Attack, Spread or Stack orders, and use equipped Raid Leader tactics. A tapped tile moves selected units and holds them at destination; tapping an enemy with a selected character issues Attack. Hold suppresses automatic repositioning while allowing actions in range. Spread and Stack use meaningfully different separation distances. Focus Fire favors a shared target while healers keep healing; an explicit healer Attack order prioritizes offense until replaced or the target dies. Interrupts require a valid cast and capable character. See [Combat system](COMBAT_SYSTEM.md) for threat, spacing, tonics, HUD and exact order behavior.

## Encounters and progression

Current easy, moderate and void delves end with increasingly dangerous boss waves. Easy has four waves, moderate five, and void six. A fifth-depth Void-Key Guardian inserts an extra wave before the final boss, though current map delves occupy depths one through four. Definitions live in `data/encounters.js` and `data/delves.js`. The current route is Pineshire to The Slime Cave, Thornbriar Hollow and Duskfall, then branches toward Dolmark Den and The Murmuring Abyss; see [World map](WORLD_MAP.md).

Raid Leader tactics unlock through Tactics Points and up to five may be equipped. Adventurers earn individual experience. Gold, healing tonics, equipment, Void Keys and world unlocks persist. Do not change save IDs or resource rules casually. Future design ideas include deeper branching paths, Void Manifestations, roster rarity, morale events, consumable sinks and more specialized parties. These are planned directions until implemented in source.
