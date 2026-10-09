# Delve Deep visual QA

Run `npm run test:visual` from the repository root for the maintained browser suite. Playwright starts Vite and launches Chromium at a 1920×1080 landscape viewport. The scene-capture check defaults to `TitleScene`; select only that check with `npm run test:visual -- scenes.spec.js`. Use `npm run test:visual:headed` to watch a run. Install Chromium once with `npx playwright install chromium` if Playwright reports that its browser is missing.

The maintained `illustrated-map.spec.js` and `ui-corrections.spec.js` exercise desktop and phone-sized map travel, reload, holds/drags, visible Dev Tools, full wooden How to Play, actual battlefield previews, Enchanter BUY/SELL empty states and potion quantities. Use `--workers=1` when software-rendered Chromium causes slow gesture dispatch. Windows sandbox `spawn EPERM` can require authorized escalation for Vite/esbuild/Chromium.

`button-press.spec.js` checks mouse and touch holds, fixed edge hit regions, drag cancellation, release activation and camp boss controls. `carved-stone.spec.js` checks the live delve interface, held details, farming and each authored continuous floor boundary across Slime Cave, Thornbriar and Dolmark. Their review screenshots are saved under `output/qa/carved-stone/`.

Screenshots and matching JSON bounds reports are written to `output/qa/scenes/<SceneName>-<ViewportWidth>.png` and the matching `.json`. They are generated locally and ignored by Git. Open the PNG and inspect the whole scene. The screenshot is the deciding evidence; the JSON warnings are only leads for inspection. Playwright also attaches the PNG to its test result.

Other suites put screenshots under `output/qa/screenshots/` or a feature folder under
`output/qa/`. Traces and failure reports are under `output/qa/test-results/`. These
generated reports and preserved archives are excluded from Vite's development watcher.

## Capture a scene

In PowerShell:

```powershell
$env:VISUAL_SCENES = 'PartySelectScene'
npm run test:visual -- scenes.spec.js
```

Capture several scenes in one run with a comma-separated list, such as `TitleScene,DelveSelectScene,PartySelectScene`. Scene names must match the Phaser keys listed in `devBridge.js`. The bridge runs only on the Vite development server with `?visualQa=1`. It starts the requested scene after BootScene restores game state. Delve scenes use The Slime Cave by default. The bridge supplies a five-member party only for the battle and battle overview scenes. For a different delve, extend the test's `activate(name)` call to pass `{ delve: 'delve-id' }`.

## Use after a scene or UI change

Run `npm run build`, then capture each affected scene with `VISUAL_SCENES`. Open each PNG and check text, panels, alignment, buttons, clipping, and the entire canvas. Read the JSON report for DOM overflow, viewport dimensions, Phaser text outside the logical game area, text exceeding interactive rectangle bounds, and nearly coincident interactive rectangles. World-map objects outside the camera are intentionally excluded from viewport warnings. Check any warning against the screenshot before treating it as a defect. Fix regressions, rerun, and inspect the new image. This browser check supplements Android device review.

## Add a scene

Add its key to `SCENES` in `devBridge.js`. If it requires context, set only the necessary `GameState` fields in `activate` and supply scene init data as the existing navigation does. Keep setup inside this development-only bridge. Then capture the scene and inspect the PNG and JSON. For phone landscape captures, set `$env:DELVE_QA_WIDTH = '915'` and `$env:DELVE_QA_HEIGHT = '412'`. Defaults are 1920 by 1080. Scene filenames include the viewport width to keep both reviews.
