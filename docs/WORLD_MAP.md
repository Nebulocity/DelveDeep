# Delve Deep – World Map

## Current Map Progression

The current early-world route is:

**Pineshire → The Slime Cave → Thornbriar Hollow → Duskfall**

After Duskfall, the path branches toward:

- **Dolmark Den**
- **The Murmuring Abyss**

## Location Types

### Towns

- Pineshire
- Duskfall

### Delves / Dungeon Caves

- The Slime Cave
- Thornbriar Hollow
- Dolmark Den

### Void Portal

- The Murmuring Abyss

Earlier organizational categories also included:

- Town
- Old Road
- Delves
- Void Portals

The visible "Old Road" map text itself should not be displayed if it is still present.

## Visual Direction

- Pixel-art world map.
- Inspired by classic tactical / console RPG overworld presentation.
- Darker ambience is acceptable.
- Current map is intended for horizontal / landscape presentation.

## Map UI Rules

- Location nameplates should remain readable.
- Icons should appear below the location nameplates.
- Avoid overlapping icons, labels, Android status areas, or top UI.
- The world-map top banner should be flush with the top of the usable game area.

## Progression

Locations unlock through progression.

Development tooling should allow:

- Clearing map progress.
- Unlocking all content.
- Re-running delves.
- Re-running Void Portals.
- Repeating content any number of times while testing.

Testing mode should not permanently corrupt or confuse normal progression state.

## Void Keys

Developer tools should include a way to add a Void Key.

Any Void Key count should be handled through the project's persistence system rather than temporary scene-only state.

## Void Portal Content

Void Portal enemies and bosses should remain distinct from ordinary delve content where appropriate.

Before adding or changing Void Portal enemies, inspect the current project data and use the established enemy / encounter system rather than creating unrelated one-off logic.
