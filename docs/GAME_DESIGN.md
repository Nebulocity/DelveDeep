# Game design

## Core loop and player role

The player is a persistent Raid Leader, separate from the five adventurers they command. Select a world-map location, choose a party and equipped leadership tactics, enter a delve, direct real-time combat through waves and a boss, then collect rewards and advance Player progression, Character progression, and map progress. The battle is a compact free-moving 2D arena, not a turn-based grid, though ability targeting uses visible grid cells.

## Party and classes

A party has five adventurers, at most one Tank, two Healers and four DPS. DPS include melee and ranged roles. Current classes and individual kits are defined in `data/classes.js`; the provisional tuning and saved roster mappings are in [Class abilities](CLASS_ABILITIES.md). Character identity persists through roster IDs, experience, equipment and encounter history. Personality, rarity and event-driven happiness are longer-term ideas, not complete systems.

## Combat commands

Adventurers acquire targets, move, attack, heal and cast by class. The player can select individuals or role groups, issue Move, Hold, Attack, Spread or Stack orders, and use equipped Raid Leader tactics. A tapped tile moves selected units and holds them at destination; tapping an enemy with a selected character issues Attack. Hold suppresses automatic repositioning while allowing actions in range. Spread and Stack use meaningfully different separation distances. Focus Fire favors a shared target while healers keep healing; an explicit healer Attack order prioritizes offense until replaced or the target dies. Interrupts require a valid cast and capable character. See [Combat system](COMBAT_SYSTEM.md) for threat, spacing, HUD and exact order behavior.

## Encounters and progression

Ordinary delve difficulties define encounter lengths: Easy has 6 waves, Difficult 10, Tough 16, Very Tough 24, Incredibly Tough 34, and Impossible 50. The Slime Cave, Thornbriar Hollow, and Dolmark Den are Easy with six authored waves each. Dolmark Den uses Den Wardens, Den Protectors, and Silvanark the Forest Lord in its boss wave. Current delves end with boss waves. Void Manifestations display Unknown; their hidden tier rules are undecided, so The Murmuring Abyss keeps its current six-wave encounter. A fifth-depth Void-Key Guardian inserts an extra wave before the final boss, though current map delves occupy depths one through four. Definitions live in `data/encounters.js` and `data/delves.js`. The current route is Pineshire to The Slime Cave, Thornbriar Hollow and Duskfall, then branches toward Dolmark Den and The Murmuring Abyss; see [World map](WORLD_MAP.md).

Player progression covers the player's level, Tactics Points, unlocked tactics, and equipped tactic loadout. Up to five tactics may be equipped. Assault, Protect, Restore, and Prepare remain the tactic categories; Prepare currently has no tactic. Character progression covers each adventurer's experience, level, happiness, ability training, and equipment. Gold and world unlocks persist as shared progress. Weapon, armor, accessory, and potion slots are present but start empty. Baseline gear, material, and potion definitions exist. The Alchemist sells and buys potion packs; item drops, recipes, and other stocked shops are not yet in the game. Future design ideas include deeper branching paths, Void Manifestations, roster rarity, morale events, consumables and more specialized parties. These are planned directions until implemented in source.

## Item reset

The old item catalog and crafting data were cleared. The Blacksmith and Quartermaster screens remain visible with empty states. The Items screen shows owned supplies. Characters retain weapon, armor, accessory, and potion slots. A potion slot holds one pack of a single potion type with up to three uses. The old shared Healing Tonic inventory and Prepared Supplies tactic are retired. Old saved item stock is discarded while character, gold, world, and tactics progression remain; players who unlocked Prepared Supplies receive its Tactics Point back.

## Baseline catalog

The first Common gear definitions are Field Blade, Trail Bow, Apprentice Focus, Pilgrim Staff, Padded Vest, and Iron Guard. Together they give every current class a weapon and armor option. The baseline materials are Iron Ore, Cured Leather, Woven Cloth, Wild Herbs, and Arcane Essence. Common Health and Mana Potion packs each contain three uses and cost 60 Gold at the Alchemist. Health restores 30% maximum HP; Mana restores 30% maximum mana and can only be equipped by mana users. Unequipped packs sell for half the full price, scaled by remaining uses. These definitions have stable IDs; individual item copies and material counts can be saved and shown in inventory. The catalog has no accessories, gear drop rules, or recipes yet.

## Planned item progression

Items use Common, Uncommon, Rare, Epic, and Legendary rarity. Ordinary delve loot rolls once after each successfully completed nonboss wave, with available rarities determined by delve difficulty. Bosses grant fixed difficulty-based gear and material rewards. Accessories primarily come from Void Portals, cannot be crafted, and may appear as a very rare bonus drop from the highest normal difficulties. Void loot distribution remains separate and undecided. Materials can craft weapons, armor, scrolls, and potions. Enchantment scrolls provide temporary effects; their duration rule is not yet chosen. Legendary items are reserved for major story progression. These drop rules, odds, and recipes are not implemented.
