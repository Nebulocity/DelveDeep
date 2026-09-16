# Delve Deep

Delve Deep is a 2D pixel-art tactical RPG for Android. The player acts as
the Raid Leader, selects five adventurers, and issues tactical orders
during real-time battles. Delve victories advance the roster, leader,
and world map.

The game uses JavaScript, Phaser 3.90, Vite, and Capacitor 8. Development
targets Windows with VS Code and Android Studio. The mobile interface is
landscape only, with large text and touch targets for phone displays.

## Development and builds

Install the locked dependencies and start the development server:

```bash
npm ci
npm run dev
```

Run the normal production validation and optionally preview its output:

```bash
npm run build
npm run preview
```

To package updated web assets for Android, build first, then sync:

```bash
npm run build
npx cap sync android
```

Build a debug APK from PowerShell:

```powershell
cd android
.\gradlew.bat assembleDebug
```

`npm run deploy` builds the web game, syncs Android, and opens Android
Studio. It does not publish a release to a store.

### GitHub Pages

The `.github/workflows/pages.yml` workflow builds and publishes `dist`
when changes reach the repository's default branch. In GitHub, set
**Settings > Pages > Build and deployment > Source** to **GitHub Actions**.
Push the workflow to the default branch, or run **Deploy game to GitHub
Pages** manually from the Actions tab on that branch.

Pages needs the built game, not the repository's source `index.html`.
The workflow uses `npm run build -- --base=/DelveDeep/` so JavaScript,
styles, and imported artwork load under
`https://nebulocity.github.io/DelveDeep/`.

Local development and Android commands above remain unchanged; the
Pages base path is applied only in that workflow. To preview the Pages
build locally, run the same build command followed by
`npm run preview -- --base=/DelveDeep/`, then visit
`http://localhost:4173/DelveDeep/`. Run the normal `npm run build` again
before syncing Android.

Saves remain local to each browser origin or installed app; progress
does not automatically transfer between localhost, Pages, and Android.

## Project directories

The repository root is the source root. There is no `src/` directory.

- `scenes/`: Phaser screens, navigation, and the battle scene. This is
  where most screen-specific UI and combat orchestration live.
- `combat/`: Combatant state and presentation, battlefield perspective,
  formation positioning, and encounter logging.
- `game/`: Shared session state, profile persistence, adventurer growth,
  Raid Leader progression, and expedition outcomes.
- `data/`: Class and ability definitions, the starting adventurers,
  enemies and wave groups, and delve access metadata.
- `config/`: Phaser configuration, logical resolution, scaling, and
  scene registration.
- `services/`: Device haptics and browser orientation requests.
- `ui/`: Shared layout offsets and header positioning helpers.
- `assets/`: Source artwork, currently including the world map image.
- `docs/`: Local design, architecture, combat, UI, world map, and task
  notes. These files are currently ignored by Git and may be absent
  from a fresh checkout.
- `entities/`, `systems/`, `utils/`: Reserved folders containing
  `.gitkeep` placeholders; current gameplay lives in the folders above.
- `dist/`: Generated Vite production output used by Capacitor.
- `android/`: Capacitor Android project, Gradle wrapper, and native build
  output. Update bundled web assets through the build and sync commands.
- `node_modules/`: Installed dependencies managed by npm.

Do not manually edit generated output or dependency files in `dist/`,
`android/`, or `node_modules/` during ordinary source work.

## Important entry points and configuration

- `index.html`: Browser entry page and the game mount element.
- `main.js`: Imports global styles and creates the Phaser game.
- `style.css`: Full-screen page layout, canvas sizing, touch behavior,
  and safe-area insets for the game container.
- `config/gameConfig.js`: The 2400 by 1080 logical game area, FIT scaling,
  background, and ordered scene list.
- `capacitor.config.json`: Android app identity, bundled `dist` assets,
  and native edge-to-edge margin adjustment.
- `package.json`: Runtime dependencies and development/build scripts.
- `package-lock.json`: Locked dependency versions for repeatable installs.
- `.gitignore`: Generated output, dependencies, and local-only files.
- `AGENTS.md`: Local coding and validation instructions, ignored by Git.
- `ABILITY_EDITING.md`: Guide to editing class and enemy abilities,
  including which behavior requires changes in the battle scene.

## Screens and navigation

- `scenes/BootScene.js`: Loads the map, restores progression, and prepares
  the session before entering the world map.
- `scenes/TitleScene.js`: World map locations, access checks, cleared
  delve reviews, party location marker, and development tools.
- `scenes/TownScene.js`: Town facility destinations.
- `scenes/AdventurersHallScene.js`: Battle tactics and equipment/item
  destinations.
- `scenes/BlacksmithScene.js`: Equipment and material purchases, sales, and
  starter crafting recipes with class and rarity filters.
- `scenes/EquipmentScene.js`: Role-filtered roster, one weapon and armor
  slot per adventurer, and compatible owned equipment.
- `scenes/ItemsScene.js`: Battle supplies, crafting materials, and every
  owned equipment copy with its current wearer.
- `scenes/FacilityScene.js`: Shared placeholder for future town systems.
- `scenes/RosterScene.js`: Adventurer stats, experience, and happiness.
- `scenes/RaidLeaderScene.js`: Leadership unlocks and battle loadout.
- `scenes/ShopScene.js`: Healing Tonic purchases and owned supplies.
- `scenes/DelveSelectScene.js`: Selected delve overview.
- `scenes/PartySelectScene.js`: Party selection, role limits, scrollable
  roster columns, and adventurer detail panels.
- `scenes/DungeonScene.js`: Party and tactics review before starting a run.
- `scenes/BattleScene.js`: Real-time battle loop, tactical commands,
  class AI, attacks, healing, enemy waves, effects, and battle outcomes.
- `scenes/RewardScene.js`: Victory loot and progression summary.
- `scenes/EncounterSummaryScene.js`: Defeat or retreat summary.

## Combat, data, and progression

- `combat/BattleUnit.js`: Unit resources, action timing, movement,
  defenses, status effects, and battlefield presentation.
- `combat/BattlefieldGeometry.js`: Arena-to-screen projection, grid
  geometry, bounds, and perspective floor drawing.
- `combat/TacticsController.js`: Role-based positions and formation
  preferences used by automatic movement.
- `combat/CombatLog.js`: Encounter events and the latest saved combat log.
  During play, `globalThis.delveCombatLog` exposes the record and
  `globalThis.getDelveCombatLog()` returns formatted JSON for inspection.
- `data/classes.js`: Class stats, abilities, and the adventurer factory.
- `data/adventurers.js`: Starting roster and individual stat overrides.
- `data/enemies.js`: Enemy definitions and normal/void wave groups.
- `data/delves.js`: Delve metadata, prerequisites, key requirements,
  and map positions. Town positions are defined in `TitleScene.js`.
- `game/GameState.js`: Shared world, roster, party, inventory, tactics,
  and current-run state.
- `game/GameStorage.js`: Main profile save/load and stat reconstruction
  from current class/roster data plus saved progression.
- `game/AdventurerProgression.js`: Experience thresholds, level gains,
  and happiness adjustments.
- `game/LeaderProgression.js`: Leader unlocks, Tactics Points, depth records,
  and the equipped ability list, with separate persistence.
- `game/ExpeditionProgression.js`: Run snapshots, victory rewards,
  defeat morale, retreat rollback, map reveals, and duration formatting.
- `services/HapticsService.js`: Shared tactile feedback for interactions.
- `services/OrientationService.js`: Browser landscape-lock request with
  a fallback when locking is unavailable.
- `ui/Layout.js`: Shared safe-layout constants and header helper.

## Equipment and crafting

`data/items.js` defines rarity colors, the class equipment catalog, crafting
materials, prices, bonuses, and starter recipes. Every implemented class
(including Guardian) has three uncommon items at 100g and two rare items
at 350g. Uncommon gear includes two alternative weapons and one armor;
rare gear includes one weapon and one armor. Epic and legendary rarity
colors and sell values are supported for future equipment definitions.

Blacksmith sales pay 50g per rarity level: uncommon 50g, rare 100g, epic
150g, legendary 200g. Equipped gear cannot be sold or consumed by a recipe.
Purchases, sales, crafts, and tactic unlocks show a confirmation dialog with
the cost or ingredients before committing. Cancel leaves resources unchanged.
Purchases and crafts create
individual item copies. Items can be replaced or unequipped in the Hall.

Iron Ingots, Cured Leather, and Runic Cloth cost 50g each at the Blacksmith.
Uncommon recipes consume two materials. Rare recipes consume the matching
uncommon weapon or armor, four materials, and 50g. Alternative uncommon
weapons are not substitutes for the recipe's named weapon. The Craft list
shows owned/required ingredients. Material drops from delves remain future
work; all starter recipes can be completed with merchant supplies.

`game/Equipment.js` validates purchases, sales, crafting, and ownership.
Equipment bonuses are added to a copy of the adventurer when creating a
battle unit or displaying stats. Base roster stats and class ability powers
remain unchanged: Attack and Healing bonuses improve basic attacks and
basic heals; armor bonuses add percentage points of damage mitigation.
Gear therefore increases combat power without compounding on reload or
level-up. Health bonuses also affect percentage-based heals and health costs.

Old profiles receive empty equipment slots, an empty owned-equipment list,
and empty material counts. The existing save key is retained; owned copies,
equipped instance IDs, and materials persist on the next save. Invalid or
duplicate equipment references are discarded during loading. Saves do not
transfer between browser origins or between the browser and Android.

Run `node tests/equipment.test.js` for catalog, economy, crafting, ownership,
stat, migration, and retreat checks. `node tests/inventory-scenes.test.js`
exercises the screen callbacks and combat setup with a display adapter;
it does not replace a visual phone check. Run `npm run build` for validation.

Persistence currently uses local storage keys `delveDeep.profile.v2`,
`delveDeep.leaderProgression.v1`, and `delveDeep.lastCombatLog.v1`.
Changing these keys or stored structures requires attention to existing
player progress.

## Documentation and commenting conventions

Consult the local `docs/PROJECT_CONTEXT.md`, `docs/GAME_DESIGN.md`,
`docs/ARCHITECTURE.md`, `docs/UI_RULES.md`, `docs/COMBAT_SYSTEM.md`,
`docs/WORLD_MAP.md`, and `docs/TODO.md` before substantial changes.
These notes include future design direction; inspect the implementation
before treating a described feature as complete.

For example, current tile movement immediately creates a persistent Hold
order. An Attack order releases Hold for the selected adventurers and
makes them pursue the chosen enemy. Select a character and tap a tile to
Move, or tap a monster to Attack. The right menu has Attack; the top
leadership bar retains Focus Fire. Explicitly ordering a healer to Attack
uses basic attacks until that target dies or a movement order replaces it;
ordinary Focus Fire leaves healers supporting the party.

Tanks automatically use a single-target taunt every 8 seconds and an area
taunt every 16 seconds when eligible enemies are in range. The area taunt
selects at most the nearest three enemies not already targeting that tank.
DPS wait for a tank hit or taunt on each enemy before attacking it. Healing
adds threat only to engaged enemies; normal threat resumes after engagement.
Without a living tank, the remaining party can fight immediately.

Run `node tests/battle-behavior.test.js` for combat behavior checks alongside
the normal production build. These checks exercise combat decisions and
delayed actions without rendering; touch layout still needs device review.

Current Interrupt handling clears a pending enemy action without
checking the selected class, while the combat notes call for class-aware
interrupts. Several leader ability descriptions still say "Future" even
though `BattleScene.js` implements effects for them. The documentation
pass preserves these existing behaviors.

Use short ASCII `//` comments in JavaScript with plain, descriptive wording.
Start function summaries with "This function..." and explain what the
function does, including its main responsibilities and relevant results.
Inside longer functions, explain the distinct sections, such as screen
setup, controls, input handling, and state changes. Add details where a
gameplay rule or implementation choice needs explanation.

Keep a blank line between every comment block and any code above it. A
comment can sit directly above the code it describes, and consecutive
lines of the same comment block stay together. Also leave a blank line
after the opening brace of each function body. Preserve JavaScript,
existing architecture, gameplay rules, and mobile readability.
