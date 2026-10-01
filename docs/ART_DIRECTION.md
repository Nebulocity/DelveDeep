# Art direction

Delve Deep aims for readable pixel-art characters and environments with a classic fantasy RPG mood. The game is viewed in landscape and must remain legible on a phone. Character silhouettes, weapons and class identity should read at battle scale; effects and floating text should clarify important actions without hiding the fight.

The world map is a pixel-art overworld with readable location nameplates and icons beneath them. Combat uses a compact arena with free movement and perspective projection. The Slime Cave currently combines rendered Blender environment layers with pixel-art combatants. Its approved composition is 1920 x 1080, fitted into the 2400 x 1080 game canvas with a source-space upward offset of 120 pixels. Preserve the production camera while iterating on export or integration.

New character art should follow supplied references and the PixelLab workflow in [Asset pipeline](ASSET_PIPELINE.md). Use four authored diagonal facings and six animation states where the current character sheet pipeline applies. Do not mirror distinctive weapons or equipment as a shortcut. New environments should leave a clear combat floor, account for foreground occlusion and keep UI readable above the scene. The current Slime Cave source is described in [Blender pipeline](BLENDER_PIPELINE.md).

UI uses large text, generous touch targets, strong contrast, and a top banner flush with the usable game area. See [UI rules](UI_RULES.md) for exact interaction constraints. A detailed color palette has not yet been established as an authoritative repository standard; sample the approved existing art rather than inventing one.
