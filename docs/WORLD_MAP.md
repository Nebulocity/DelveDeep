# Delve Deep - World Map

## World layout

The map is one scrolling 120-by-72-tile world, divided into nine seamless 40-by-24-tile areas. Its three columns are progression Regions rather than separate screens. `data/worldMap.js` owns the area positions, shared road seams, graph, and POIs. The provisional terrain and roads use reusable tile and line rendering; final PixelLab terrain and road tiles can replace their presentation without moving graph coordinates.

| West: Pineshire Reach, levels 1-3 | Middle March, levels 4-6 | Eastern Verge, levels 7-9 |
| --- | --- | --- |
| Thornwood: Thornbriar Hollow | Northern March waypoint | Eastern Heights waypoint |
| Pineshire Vale: Pineshire, The Slime Cave | Crossroads waypoint | Eastern Crossing waypoint |
| Duskfall Foothills: Duskfall, Dolmark Den, The Murmuring Abyss | Southern March waypoint, The Verdant Tear | Far Verge waypoint |

Roads join north-center-south within each column. The Murmuring Abyss blocks the southwest-to-south road, and The Verdant Tear blocks the south-to-southeast road. These are the only roads across Region boundaries. Clearing a Portal opens its road crossing; it does not move the party. The east edge remains a waypoint, with no committed distant story destination.

## Progression and travel

The early route remains Pineshire, The Slime Cave, Thornbriar Hollow, Duskfall, then Dolmark Den. Clearing all three ordinary Delves makes both Void Portals eligible at the same time as the proposed opening Everdeep. The Murmuring Abyss must be cleared to reach The Verdant Tear, and The Verdant Tear must be cleared to travel into the eastern Region. Both Portals belong to the opening progression group for the proposed Everdeep, even though the second gate stands within the middle column.

Drag the terrain to pan across distant areas, then tap a reachable POI to send the visible party along authored roads. Travel resumes camera follow within world bounds; Find Party recenters it. Hold a POI for details. Towns and Delves open on arrival; waypoints stop the party. POI labels remain above their icons, while the top banner and controls stay fixed to the usable game area. A blocked destination explains its requirement. The profile saves the party's current location or road edge position within the current build.

## Art and interface

The map is landscape-first pixel art with large nameplates, generous touch targets, and haptics. The current renderer is provisional. Produce final terrain and road tiles as reusable PixelLab assets, with exact shared crossings at area boundaries; do not bake independent road ends into nine unrelated images. New party character art must use PixelLab and supplied references. Do not alter the combat floor: every Delve keeps the shared Slime Cave 10-by-6 tactical grid.

Development tools retain progress reset, unlock-all, and encounter replay controls. Unlock-all opens both road gates only while the mode is active; it does not write permanent clears.
