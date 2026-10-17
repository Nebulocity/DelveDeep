Delve Deep UI Explorer v3
========================

Replace only tests/visual/ui-explorer.spec.js with the file supplied.
Keep your existing devBridge.js, gallery generator, and all existing reports.

From E:\Programming\DelveDeep in PowerShell:

$env:UI_EXPLORE_SCENES = 'AdventurersHallScene'
$env:UI_EXPLORE_ACTIONS = '1'
$env:UI_EXPLORE_MAX_ACTIONS = '4'
$env:UI_EXPLORE_START_AT = '0'
npm run test:visual -- ui-explorer.spec.js --workers=1

The new queue prioritizes tabs and informational actions over selecting every adventurer.
Run batches with UI_EXPLORE_START_AT of 4, 8, 12, etc. (these indices refer to the NEW v3 queue).

Afterward:
node scripts/build-ui-gallery.mjs
Start-Process output\qa\ui-explorer\index.html

The report at output/qa/ui-explorer/AdventurersHallScene/report.json now includes
v3Queue, attempts, and branches with controls discovered after each interaction.
Existing screenshots are retained. Exploration uses a fresh page per attempt.

CAUTION: These are screenshots of attempted interactions, not verified UI outcomes.
The tool does not reliably identify scrolling, Phaser masking, covered controls,
or all dynamic states. Keep using a disposable development save.

Production asset URLs
====================

GitHub Pages and Capacitor ship Vite's `dist/` output, not the source asset folders.
Reference runtime artwork, audio and video through explicit imports or a literal
`new URL(..., import.meta.url)` expression so Vite can include and rewrite them.
For filenames selected from data, use a template literal with a fixed directory:

```js
new URL(`../assets/effects/ranger/${name}-flight.png`, import.meta.url).href
```

Keep this expression in the module that defines the relative asset path. Do not
concatenate strings or pass a computed path variable to `new URL`; those forms
can work on the development server while leaving missing assets in production.
Use exact filename capitalization because GitHub Pages paths are case-sensitive.
