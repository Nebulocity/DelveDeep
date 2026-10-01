# Delve Deep – Project Context

## Project Summary

**Delve Deep** is a 2D pixel-art tactical RPG for Android.

The project was previously referred to as **Raid Night** during early design, but the current title is **Delve Deep**.

The player is not primarily controlling a single adventurer. Instead, the player is a persistent **Raid Leader / Party Leader** who recruits and commands a roster of adventurers.

Combat is intended to feel closer to classic console action-RPG battle arenas such as the original *Star Ocean* or *Lunar: Silver Star Story* than to a static turn-based grid. Characters move freely around a compact 2D battlefield, including up, down, left, right, and diagonally.

## Core Player Fantasy

The player:

- Builds a roster of adventurers.
- Selects a party for each encounter.
- Commands tactical behavior during combat.
- Progresses as a Raid Leader.
- Unlocks additional tactical capabilities over time.
- Advances through towns, roads, delves, and Void Portals.
- Replays content during development/testing.
- Manages a team rather than directly playing one permanent hero.

## Party Rules

Current party size:

- 5 adventurers.
- The player / Raid Leader does **not** count as one of the five.

Current composition limits:

- Maximum 1 Tank.
- Maximum 2 Healers.
- Maximum 4 DPS total.

DPS can be split between melee and ranged classes.

On the Party Select screen:

- On a first-ever playthrough, no characters should be selected by default.
- After the player has completed or entered previous encounters, Party Select should default to the party used for the previous encounter.

## Current Class Direction

- Tank: Dawnwarden (Laurana), Oathwarden (Sturm), and Gladiator (Caramon).
- Melee DPS: Scoundrel (Tasslehoff), Barmaid (Tika), and Barbarian (Riverwind, Flint).
- Ranged DPS: Ranger, Mage of the Umbral Veil (Dalamar), Mage of the Crimson Spire (Raistlin), Mage of the Luminous Archive (Palin).
- Healers: Cleric of the Everbright (Mishakal), Cleric of the Verdant Covenant (Goldmoon), Cleric of the Sanguine Song (Fistandantilus).

These are provisional Dragonlance-inspired roster assignments, not canonical class claims. Character IDs remain stable, including the renamed Aoth entry. See CLASS_ABILITIES.md for tuning and save compatibility.

## Raid Leader Progression

The player has a persistent Raid Leader identity that progresses separately from the adventurers.

Current progression direction:

- Raid Leader gains progress by completing sections of the Deep.
- Tactics Points (TP) unlock Raid Leader tactics. Old Inspiration Point saves retain their balances and purchases.
- One TP is earned at each five-level leader milestone (5, 10, 15, etc.).
- The Dev menu's + Level button uses this same progression rule and saves the new level.
- Equip up to five unlocked tactics in the Adventurer's Hall > Battle Tactics screen.

Exact progression values should remain configurable.

## Adventurer Progression

Adventurers are intended to become more distinct over time rather than remaining permanently generic.

Long-term concepts include:

- Individual experience.
- Specialization.
- Rarity.
- Personality traits.
- Happiness / morale affected by events.
- Class development.

Not every concept above is necessarily implemented yet.

## Monetization Direction

- No advertising.
- Consumables are intended to be both a gameplay gold sink and the primary monetization path.
- Google Play Billing is planned.
- Avoid designing systems that require ads.

## Development Philosophy

The game is being developed iteratively.

When Codex encounters incomplete or temporary systems, it should:

- Preserve existing working behavior.
- Make focused improvements.
- Prefer extensible systems over hard-coded temporary hacks.
- Avoid rewriting unrelated systems without need.
- Keep systems easy for the developer to modify later.
