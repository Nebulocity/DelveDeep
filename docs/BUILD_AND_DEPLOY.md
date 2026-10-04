# Build and deploy

Use Node.js and npm from the repository root on Windows. `npm ci` installs locked dependencies; `npm run dev` starts Vite. `npm run build` generates `dist/`; `npm run preview` serves that build. The source root is the repository root, and `main.js` plus `config/gameConfig.js` start Phaser. Do not edit generated `dist/` or `node_modules/` as source.

For Android, run `npm run build`, then `npx cap sync android`. Open the Android project in Android Studio or run `cd android` and `.\gradlew.bat assembleDebug` in PowerShell. The Capacitor config bundles `dist/` with app ID `com.waywardkobold.app`. A packaged build should use bundled files, not a development-server URL. `npm run deploy` is a local helper that builds, syncs, opens Android Studio and also syncs iOS; it does not publish a store release.

The GitHub Pages workflow in `.github/workflows/pages.yml` builds on the default branch using the `/DelveDeep/` base path and publishes `dist`. Configure GitHub Pages to use GitHub Actions. The Pages base path is only for that workflow; run a normal `npm run build` again before Android sync. Browser, Pages and installed-app saves live in separate local-storage origins and do not transfer automatically.

Each Vite build embeds a unique build ID. On first launch of that build, the game clears Player progression (level, Tactics Points, unlocked tactics, and loadout), Character progression (adventurer levels, experience, happiness, and abilities), and shared progress (gold, inventory, world clears, and development settings). Progress saves normally during subsequent launches of the same build. Authored items, abilities, enemies, levels, and other source data are unaffected. A rebuild for Android after a web build creates another fresh save generation.

There is no `npm test` or lint script in `package.json`. The maintained `tests/*.test.js` files are direct Node scripts; run those relevant to a gameplay change, for example `node tests/battle-behavior.test.js` and `node tests/class-abilities.test.js`. A build checks bundling, while a phone review is still needed for touch, text, haptics and video playback.
