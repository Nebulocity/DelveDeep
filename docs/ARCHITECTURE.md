# Architecture

The repository root is the JavaScript source root. `index.html` mounts the game; `main.js` creates Phaser using `config/gameConfig.js`. That config fixes a 2400 x 1080 logical landscape canvas, FIT scaling and the registered scene list. Vite resolves modules and artwork; Capacitor packages the built `dist/` for Android. See [Build and deploy](BUILD_AND_DEPLOY.md) for commands and native packaging.

## Scene flow

`BootScene` preloads and restores state, then `TitleScene` presents the world map. Town navigation uses `TownScene` and facility scenes such as roster, shop, equipment and Raid Leader. A delve flows through `DelveSelectScene`, `PartySelectScene`, `DungeonScene`, `BattleScene`, then `RewardScene` or `EncounterSummaryScene`. Scene registration is explicit in `config/gameConfig.js`; some scene transitions use Phaser string keys, so search registrations and `scene.start`/`launch` before removing a scene.

## Data and state

`data/classes.js` defines class stats and adventurer abilities; `data/adventurers.js` builds the starting roster; `data/enemies.js` and `data/encounters.js` define enemy types and wave composition; `data/delves.js` defines locations and imports the active `data/levels/SlimeCave.js`. `data/items.js` defines baseline gear, materials, and rarity metadata. `game/Equipment.js` handles gear instances, material grants, and weapon, armor, accessory, and potion pack equipment. `GameState` is the live session object. `GameStorage` reads and writes the profile under `delveDeep.profile.v2`, rebuilding current base stats plus saved progression and discarding old catalog gear and shared Healing Tonics. `LeaderProgression` uses a separate saved record and refunds the retired Prepared Supplies tactic. `ExpeditionProgression` applies run outcomes, rewards and world reveals. Keep roster identity migrations when changing persistent IDs.

## Battle composition

`BattleScene` orchestrates waves, commands, HUD, AI and outcomes. `BattleUnit` owns unit resources and damage/status lifecycle; `ClassAbilitySystem` selects and resolves class abilities. `CombatMovement`, `TacticsController`, `BattlefieldGeometry`, `BattlefieldTerrain` and `config/combatSpacing.js` handle movement, positioning and arena bounds. `UnitSprite` and `SpriteMotion` present accepted sprite sheets. `LayeredEnvironment` loads and places the Slime Cave background, floor, ambient regions and foreground. `CombatLog` records encounter events. Direct scene references and dynamic asset keys both matter when auditing usage.

## UI and services

`ui/Layout.js` centralizes safe layout helpers. Other `ui/` modules cover selection details, confirmations, inventory and the loading screen. `services/HapticsService.js` and `OrientationService.js` connect touch feedback and landscape requests. `style.css` sizes the host canvas and handles safe-area behavior. Screen-specific UI remains in scenes; consult [UI rules](UI_RULES.md) before moving or shrinking controls.

See [Game design](GAME_DESIGN.md), [Combat system](COMBAT_SYSTEM.md), [Class abilities](CLASS_ABILITIES.md), and [Ability editing](ABILITY_EDITING.md) for behavior and editing guidance. Avoid treating a past implementation note as more authoritative than active code.
