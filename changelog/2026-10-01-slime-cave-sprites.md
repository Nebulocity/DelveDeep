# 2026-10-01: Slime Cave enemy sprites

- Converted the supplied Cave Slime, Elder Slime, and Slime Sovereign references with PixelLab and created four authored game facings plus idle, walk, attack, block, hit, and death clips for each enemy.
- Preserved the supplied art under `assets/enemies/slime-cave/references/`. Accepted source frames, directional rotations, source job IDs, packed sheets, and layout metadata are under each enemy's `reference-v2/` directory.
- Added `scripts/pack-slime-cave.py` to reproduce 192px transparent runtime sheets from PixelLab object archives. Rejected morphing Cave Slime attack frames and replaced opaque Elder Slime background colors after visual review.
- Registered the three sprite definitions in `data/slimeSprites.js` and wired stable enemy type lookup and preloading into combat. Cave Slime is the smallest, Elder Slime is larger, and Slime Sovereign is the largest.
- Added `tests/slime-cave-sprites.test.js` for sheet dimensions, clips, preload entries, names, and enemy strength ordering. Focused tests and `npm run build` passed. Physical Android combat review remains pending.
