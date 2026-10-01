# Mishakal sprite integration (2026-10-01)

- Converted the supplied Mishakal art in PixelLab and authored four independent facing rotations.
- Generated and reviewed idle, walk, healing cast, block, hit, and death clips for each facing. Rejected outputs that changed her cyan crystal staff or added an extra hand.
- Packed six transparent 256 px sprite sheets and registered Mishakal in the runtime sprite catalog.
- Recorded the 24 accepted PixelLab source jobs in `assets/characters/reference-v2-animations.json`.
- Validated with `node tests/sprite-assets.test.js` and `npm run build`.

