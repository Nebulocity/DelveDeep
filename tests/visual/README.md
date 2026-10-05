# Delve Deep visual QA

Run `npm run test:visual` from the repository root. Playwright starts Vite, launches Chromium at a 1920×1080 landscape viewport, waits for Phaser and the loading overlay, then captures `TitleScene`. Use `npm run test:visual:headed` to watch the run. Install Chromium once with `npx playwright install chromium` if Playwright reports that its browser is missing.

The maintained `illustrated-map.spec.js` and `ui-corrections.spec.js` exercise desktop and phone-sized map travel, reload, holds/drags, visible Dev Tools, full wooden How to Play, actual battlefield previews, Enchanter BUY/SELL empty states and potion quantities. Use `--workers=1` when software-rendered Chromium causes slow gesture dispatch. Windows sandbox `spawn EPERM` can require authorized escalation for Vite/esbuild/Chromium.

Screenshots and matching JSON bounds reports are written to `tests/visual/screenshots/<SceneName>.png` and `<SceneName>.json`. They are generated locally and ignored by Git. Open the PNG and inspect the whole scene. The screenshot is the deciding evidence; the JSON warnings are only leads for inspection. Playwright also attaches the PNG to its test result.

## Capture a scene

In PowerShell:

```powershell
$env:VISUAL_SCENES = 'PartySelectScene'
npm run test:visual
```

Capture several scenes in one run with a comma-separated list, such as `TitleScene,DelveSelectScene,PartySelectScene`. Scene names must match the Phaser keys listed in `devBridge.js`. The bridge runs only on the Vite development server with `?visualQa=1`. It starts the requested scene after BootScene restores game state. Delve scenes use The Slime Cave by default. The bridge supplies a five-member party only for the battle and battle overview scenes. For a different delve, extend the test's `activate(name)` call to pass `{ delve: 'delve-id' }`.

## Use after a scene or UI change

Run `npm run build`, then capture each affected scene with `VISUAL_SCENES`. Open each PNG and check text, panels, alignment, buttons, clipping, and the entire canvas. Read the JSON report for DOM overflow, viewport dimensions, Phaser text outside the logical game area, text exceeding interactive rectangle bounds, and nearly coincident interactive rectangles. World-map objects outside the camera are intentionally excluded from viewport warnings. Check any warning against the screenshot before treating it as a defect. Fix regressions, rerun, and inspect the new image. This browser check supplements Android device review.

## Add a scene

Add its key to `SCENES` in `devBridge.js`. If it requires context, set only the necessary `GameState` fields in `activate` and supply scene init data as the existing navigation does. Keep setup inside this development-only bridge. Then capture the scene and inspect the PNG and JSON. Add another landscape resolution by creating a Playwright project in `playwright.config.js` with its own viewport and by including its resolution in output filenames to avoid collisions.
