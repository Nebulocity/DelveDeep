# Delve Deep UI QA

Run checks only when explicitly requested. `npm run test:ui:audit` runs the maintained UI suite headlessly with a process watchdog and saved logs. `npm run test:visual` runs the same tests directly. Install matching Chromium once with `npx playwright install chromium` if needed. These commands do not build or package the game.

The suite uses JavaScript and the existing development-only bridge at `?visualQa=1`. Scene keys come from current runtime registration and are compared with `config/gameConfig.js`. Boot is exercised by each fresh page. Retired Hall scene names are not aliases for current destinations.

Every test uses an isolated, nonpersistent browser context. Three projects cover landscape browser viewports: Pixel 9 representative (976x440, DPR 2.625), smaller phone (740x360, DPR 2), and tablet (1280x800, DPR 1.5). These emulate browser geometry and touch availability, not native Android system bars or physical haptics. Screenshots use CSS resolution to limit disk use; DPR remains in metadata.

Maintained files under `tests/visual/audit/`:

- `inventory.spec.js`: all registered scenes, viewport/text geometry and runtime object inventory.
- `navigation.spec.js`: nine town destinations, complete-card center/edge taps, return navigation, both layouts, modal blocking, unavailable feedback and seven-tap developer access.
- `workspaces.spec.js`: roster/library scrolling and selection, held details, equipment routing, merchant catalogs and repeated scene lifecycle.
- `transactions.spec.js`: isolated merchant transactions, insufficient funds, enchant/disenchant, categories and training confirmations.
- `actions.spec.js`: equipment/ability/tactic loadout changes, unlock cancellation and crafting at all three merchants.
- `combat.spec.js` and `encounter-controls.spec.js`: preparation, selection, Move/Focus, radials, pause, retreat/cancel, camp, ordinary/boss presentation and results.
- `environments.spec.js`: each current battlefield's preview, bestiary and HUD.
- `overlays.spec.js`: map destination states, native save transfer and the Tutorial preparation notice. No interactive tutorial implementation.
- `stability.spec.js`: live texture/animation frames and optional approved screenshot regression.

Open `output/qa/overnight-ui-audit/index.html` for the gallery. JSON companions contain source/runtime inventories, geometry, actual pointer attempts, coverage and execution results. Per-test records survive interruption. Failures retain screenshots; videos, traces and test retries are disabled. Each test and the whole run have time limits. The supervisor permits one restart only for Vite startup failure, never for assertions. It saves previous execution summaries before each run. It does not delete existing output folders; Playwright manages its own `test-results` folder.

Examples:

```powershell
npm run test:ui:audit -- --project=pixel9
npm run test:visual -- navigation.spec.js --project=small-phone
```

`DELVE_QA_PORT` selects Vite's local port. `DELVE_QA_REPORT_ROOT` selects a report directory for a reproduction pass. Use distinct ports/report roots for independent concurrent diagnostics.

The bridge's `discover(scene)` returns visible enabled controls. `audit(scene)` additionally includes disabled/masked controls, text, lifecycle counts and five real Phaser hit probes per surface. Geometry does not prove an action: tests must assert an observable navigation, selection, transaction, modal or command result. Masked rows are intentionally unreachable until scrolled. Transparent hit surfaces, modal blockers and edge-to-edge art are intentional.

No current redesigned-UI baselines have human approval. The optional screenshot regression is explicitly skipped until `DELVE_QA_APPROVED_BASELINES` names a manually reviewed baseline directory. Store approved files as `<project>/town-hub.png`. Snapshot updates are disabled by default. Captures and geometry checks do not imply visual approval; never update baselines to conceal defects.

The old coordinate catalog, global-guessing discovery, Hall-only explorer, read-only interaction inventory and redesign capture script were replaced. Existing specialist combat/effect/balance checks remain; their previous configuration is preserved as `specialist.config.js`, invoked with `npm run test:visual:specialist -- <file>`. They are outside the maintained UI audit. Several historical specialist/UI files still contain retired Hall selectors or superseded layout expectations and need individual migration before use; their presence is not a passing certification. No historical baseline was silently accepted or deleted.

Generated QA artifacts are ignored by Git and excluded from Vite's watcher. Keep them out of production assets/builds.
