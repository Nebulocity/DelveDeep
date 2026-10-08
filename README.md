# Delve Deep

You are the raid leader. Pick five adventurers, send them into dangerous delves, and keep the party together when the monsters stop playing nice.

Delve Deep is a tactical, party-based RPG built around real-time battles. Tanks hold attention, healers keep the run alive, and melee and ranged fighters look for openings. You call the shots with movement, positioning, attack orders and leadership tactics while your adventurers use their own class abilities.

The playable region is Pineshire Reach, with traced road travel, five sequential Delves, and a boss-locked branch to the Everdeep and Void Portal. Start with The Slime Cave; boss victories open the next roads. Later illustrated regions await integration. Branch encounters reuse existing battle themes. Town shops support buying, selling, crafting, and gear enchantments.

Drag the map to explore, tap a destination to travel, and hold it for details. Visit towns to manage your roster, train abilities and tactics, craft gear, and buy or brew potion packs. Choose five adventurers before entering a Delve. Cleared waves bank rewards; camp lets you farm, return to town, or challenge the boss. HOW TO PLAY explains the loop, FIND PARTY recenters the map, and NEW GAME asks before resetting progress.

Progress is stored locally on the current device and origin. Each newly built version starts fresh; subsequent sessions of the same build preserve progress. Dev Tools are directly available from the region map, including in production. Resetting progress requires confirmation.

## Screenshots

### World Map

> Screenshot coming soon.

### Combat

> Screenshot coming soon.

### Party Selection

> Screenshot coming soon.

### Delves

> Screenshot coming soon.

## Development

Requires Node.js and npm.

```bash
npm install
npm run dev
npm run build
```

For Android builds and full setup, see [Build and deploy](docs/BUILD_AND_DEPLOY.md).

## Reading the code for the first time

Start with [main.js](main.js), then [gameConfig.js](config/gameConfig.js). Those create Phaser, choose the logical canvas size, and register the screens. There is no `src/` folder: the folders at the repository root are the source.

Read one small feature from its data to its screen before tackling the full battle. The camp is a useful example: [DelveCheckpoints.js](game/DelveCheckpoints.js) defines rewards and guards payouts, `showDelveCamp` in [BattleScene.js](scenes/BattleScene.js) builds the three choices, and [CarvedStone.js](ui/CarvedStone.js) creates their panels and text. Comments inside those functions explain the layout calculations and why the reward description starts below the measured title.

| Folder | What to look for |
| --- | --- |
| `data/` | Characters, classes, items, enemies, encounters, and authored artwork coordinates. |
| `config/` | Shared settings for text sizes, stat growth, reach, and spacing. |
| `game/` | Progression, inventory, rewards, and saving ordinary JavaScript data. |
| `scenes/` | Screens that connect the data and game rules to the player's actions. |
| `ui/` | Shared panels, text, button presses, scrolling, and held details. |
| `combat/` | Live combatants, movement, skills, waves, and battlefield projection. |
| `services/` | Music, haptics, host visibility, and background catch-up. |
| `tests/visual/` | Browser checks that interact with real Phaser screens. |

The game draws on a 2400 by 1080 **logical canvas**. Phaser scales it to the device. In that drawing space, x increases toward the right and y increases downward. An object's **origin** chooses which part sits at x/y: `(0.5, 0.5)` means its center, while `(0.5, 0)` means the middle of its top edge. **Depth** chooses draw order; it does not move an object farther away. Combat uses separate flat arena coordinates so perspective cannot change gameplay distances.

Most Phaser timestamps and delays are milliseconds. Movement usually needs seconds, so frame `delta` is divided by 1000 before multiplying it by a speed. A field ending in `Until` usually stores an expiry timestamp, rather than a remaining duration. Wall-clock timestamps such as `Date.now()` account for time when the app was suspended; they are different from the combat clock.

`GameState` holds current in-memory progress. Changing it is not the same as saving it. Catalog definitions describe a kind of item or character, while live battle units and owned gear copies have their own current state. Keep stable IDs intact when experimenting so a save can still reconnect the right records. Comments beside Maps, Sets, callbacks, spread copies, save conversion, and geometry explain those less familiar steps where they are used.

Try changing a displayed label or one named text size first, run the game, and see what changed. Keep a small edit focused, run `npm run build`, and follow the nearby test before changing a rule. Generated `dist/`, dependencies, and Capacitor-generated plugin files are build products, not places to edit gameplay.
