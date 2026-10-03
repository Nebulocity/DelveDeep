# Art direction

Delve Deep aims for readable pixel-art characters and environments with a classic fantasy RPG mood. The game is viewed in landscape and must remain legible on a phone. Character silhouettes, weapons and class identity should read at battle scale; effects and floating text should clarify important actions without hiding the fight.

The world map is a pixel-art overworld with readable location nameplates and icons beneath them. Combat uses a compact arena with free movement and perspective projection. The Slime Cave uses a chibi anime pixel-art cave image, foreground occlusion, and localized pixel effects. Thornbriar Hollow uses a matching forest bandit camp image with foreground roots, firelight, and embers. Both runtime images are 1672 x 941, fitted into the 2400 x 1080 game canvas with a source-space upward offset of 105 pixels. The earlier Blender scenes remain separate authoring sources; preserve their production cameras.

New character art should follow supplied references and the PixelLab workflow in [Asset pipeline](ASSET_PIPELINE.md). Use four authored diagonal facings and six animation states where the current character sheet pipeline applies. Do not mirror distinctive weapons or equipment as a shortcut. New environments should leave a clear combat floor, account for foreground occlusion and keep UI readable above the scene. See [Blender pipeline](BLENDER_PIPELINE.md) for the retained 3D source.

The Slime Cave runtime art is `assets/environments/slime-cave-pixel/cave.png`. `data/levels/SlimeCave.js` controls its image size, floor corners, foreground mask polygons, and ambient effect coordinates. `combat/LayeredEnvironment.js` places a masked copy of the near rocks above character sprites while keeping UI above the scene. `combat/PixelEnvironmentEffects.js` animates crystal glows, ooze currents and bubbles, rock slime, mushroom spasms, and spores. The effects pause with combat. When replacing the art, adjust the floor, masks, and effect coordinates together, then check the battle on a landscape phone.

Thornbriar Hollow runtime art is `assets/environments/thornbriar-hollow-pixel/camp.png`. `data/levels/ThornbriarHollow.js` defines its floor, foreground roots, and fire effect locations. `combat/ForestEnvironmentEffects.js` animates firelight and embers. Its pixel image follows the world map's thorny forest bandit camp rather than the retained Blender render's material style.

Dolmark Den runtime art is `assets/environments/dolmark-den-pixel/den-v2.png`, an edited version of the supplied den composition. `data/levels/DolmarkDen.js` defines its open floor, foreground root masks, and lantern and fungus locations. `combat/DenEnvironmentEffects.js` adds subtle light pulses behind the combat units.

The Murmuring Abyss runtime art is `assets/environments/murmuring-abyss-pixel/portal.png`. `data/levels/MurmuringAbyss.js` defines its open stone floor, foreground corner rocks, and Void Portal effect positions. `combat/VoidEnvironmentEffects.js` animates portal motes, swirling clouds, violet witchfire, embers, and timed lightning. Keep those effects behind combatants and below the HUD.

The Vibrant Tear runtime art is `assets/environments/vibrant-tear-pixel/knoll.png`. `data/levels/VibrantTear.js` defines a grassy battle floor and a compact portal with fewer motes, clouds, and lightning flashes. It shares the Void Portal effect system with The Murmuring Abyss.

UI uses large text, generous touch targets, strong contrast, and a top banner flush with the usable game area. See [UI rules](UI_RULES.md) for exact interaction constraints. A detailed color palette has not yet been established as an authoritative repository standard; sample the approved existing art rather than inventing one.
