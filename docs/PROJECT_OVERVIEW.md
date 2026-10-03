# Project overview

Delve Deep is a landscape, Android-first, pixel-art tactical RPG. The player is the persistent Raid Leader, directing a five-adventurer party through real-time, free-moving encounters. The loop runs from world-map location selection through party selection, delve preparation, waves of combat, rewards and unlocks.

JavaScript and Phaser 3.90 run the game. Vite builds web assets; Capacitor 8 packages them for Android. The repository root is the source root. `scenes/` handles navigation and screens, `combat/` handles battlefield mechanics, `game/` holds shared state and progression, `data/` defines classes, characters, enemies and delves, `ui/` holds shared interface helpers, `config/` registers Phaser scenes, and `assets/` holds game art. `services/` contains haptics and orientation helpers.

Current systems include a world map with towns and delves, a roster and constrained party selection, real-time combat with role-aware AI and Raid Leader commands, class abilities, empty weapon/armor/accessory equipment slots, gold and experience rewards, saved progression and development controls. Item shops and the inventory screen remain available with no stock. The Slime Cave and Thornbriar Hollow use pixel-art scenery with foreground occlusion and localized animated ambience; other encounters still use the shared battle presentation. Character sprite integration is ongoing in a separate workflow.

Start with [Current state](CURRENT_STATE.md), then choose the focused [architecture](ARCHITECTURE.md), [game design](GAME_DESIGN.md), [art](ART_DIRECTION.md), [asset](ASSET_PIPELINE.md), [Blender](BLENDER_PIPELINE.md), [UI](UI_RULES.md), [combat](COMBAT_SYSTEM.md), [world map](WORLD_MAP.md), or [build](BUILD_AND_DEPLOY.md) reference needed for the task.
