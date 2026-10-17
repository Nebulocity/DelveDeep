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
