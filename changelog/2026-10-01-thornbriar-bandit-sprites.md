# Thornbriar Hollow bandit sprite sheets

The four supplied bandit portraits were converted through PixelLab and given
four authored diagonal facings. Each bandit has idle, walk, attack, block, hit,
and death animations, with 168 transparent source frames packed into six
256×256-cell sheets. The whip, two daggers, purple crystal staff, and spiked
mace remain distinct in visual review.

Source portraits, PixelLab conversions, rotations, clips, packed sheets,
layouts, and generation job records are in
`assets/enemies/thornbriar-hollow/`. The Thornbriar encounter still uses its
existing shared enemy waves; these new assets have not been wired to runtime
enemy types.

Validation: all four sets repacked successfully, all 24 sheets passed size,
layout, and transparency checks, and `npm run build` passed. The maintained
`tests/sprite-assets.test.js` currently fails on missing Mishakal catalog data
from a separate active sprite task.
