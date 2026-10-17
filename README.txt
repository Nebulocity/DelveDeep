DELVE DEEP — UI REDESIGN SCREENSHOT PACK

Extract this ZIP into E:\Programming\DelveDeep preserving folders.
Requires your existing tests/visual/devBridge.js with discover() and the existing Playwright configuration.
No changes to game files, and no Codex required.

PowerShell (project root):
  Remove-Item Env:UI_CAPTURE_SCENES -ErrorAction SilentlyContinue
  npm run test:visual -- ui-redesign-capture.spec.js --workers=1
  node scripts/build-redesign-gallery.mjs
  Start-Process output\qa\redesign-captures\index.html

OPTIONAL: Capture only a few scenes to save time:
  $env:UI_CAPTURE_SCENES = 'AdventurersHallScene,ItemsScene,BlacksmithScene,FacilityScene'
  npm run test:visual -- ui-redesign-capture.spec.js --workers=1

Screenshots and errors go into output/qa/redesign-captures/.
This is a breadth-first visual catalog, not a guaranteed complete crawler.
It never clicks equip or purchase buttons; certain informational holds may have no visible result.
Uses an existing dev fixture and can affect development save state through normal game events. Back up saves before running.
Review the manifest for failures and screenshot for whether the intended UI actually appeared.
