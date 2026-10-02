# Thornbriar Hollow bandit sprites

The four supplied portraits are preserved here as `Lasher.png`, `Ruffian.png`,
`Hedge Mage.png`, and `Rongar the Crusher.png`. Matching PixelLab conversions are saved as
`lasher-pixel.png`, `ruffian-pixel.png`, `hedgeMage-pixel.png`, and
`rongarTheCrusher-pixel.png`.

| Sprite ID | Design | Weapon |
| --- | --- | --- |
| `lasher` | Olive-cloaked rogue | Whip |
| `ruffian` | Red-lined hooded rogue | Two daggers |
| `hedgeMage` | Witch-hatted hexer | Purple crystal staff |
| `rongarTheCrusher` | Fur-cloaked chief | Spiked mace |

Each `<id>/reference-v2/` folder contains four authored facings in `rotations/`,
source frames under `<state>/<direction>/`, and six transparent sheets in
`sheets/`. The sheets use 256×256 cells and four facing rows in this order:
south-east, south-west, north-east, north-west. `sheets/layout.json` records the
frame count for each state and facing. States are `idle`, `walk`, `attack`,
`block`, `hit`, and `death`.

`pixellab-jobs.json` and `animation-jobs.json` record the generation sources.
Run `scripts/pack-thornbriar-bandits.py` from the repository root to repack
accepted frames. `data/enemySprites.js` registers these sheets for the four
bandit enemy types used by Thornbriar Hollow.
