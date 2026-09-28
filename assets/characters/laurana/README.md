# Laurana — PixelLab sprite source

PixelLab character: `4118d5c7-c020-467d-ab06-b9e0567c1481`

Laurana is the roster's existing Dawnwarden (`laurana`). Her art is based on the
user's reference: blonde elven woman, silver-blue helmet, red plume and cape,
steel armor with gold trim, spear and round shield.

## Source

Generated with the connected **PixelLab** service. The earlier imagegen sheet
is superseded and is not used in-game. The PixelLab standard character endpoint
does not accept an illustration as a direct reference; its description was
written from the supplied character art.

Final character prompt:

> Female elf paladin, long golden blonde hair with braids, silver-blue helmet
> with red plume, steel plate armor with gold trim, red cape, brown boots.
> Holding a long upright spear in her right hand and a round silver shield in
> her left hand. Full body, spear and plume fit in frame. Neutral standing
> stance. Clear classic tactical RPG pixel art.

Settings: standard humanoid, 96px requested, 8 directions, low top-down camera,
medium detail/shading, selective outline. PixelLab expanded the delivered canvas
to 136×136 to accommodate the equipment. PNGs retain their original transparent
pixels, without resampling, background removal, or color changes.

Animation templates: `breathing-idle` (4 frames) and `walking-8-frames` (8 frames).
The first runtime version uses front/back three-quarter cycles, mirrored for
left-facing motion. Mirroring also swaps the visible equipment sides. Eight
native directional stills are retained under `pixellab/rotations/` for future
full-direction animation authoring. PixelLab repeatedly rejected the other
animation directions under heavy load.

## Runtime

- `data/characterSprites.js`: PNG URLs, clips, frame timing, scale and foot pivot.
- `combat/SpriteMotion.js`: movement direction and idle/walk state, independent
  of Phaser, tested without rendering.
- `combat/UnitSprite.js`: nearest-neighbor display and animation playback.
- `BattleUnit`: sprite plus existing selection ring, hit flash, defeat tint,
  revival, and expanded touch target. No gameplay stat or save changes.
- `BattleScene`: preload assets and advance animation after actual movement.

Combat pause/inspection stops the animation clock. Small separation corrections
and teleport jumps do not start walking. Hold settles into idle after 90ms.
The same sprite persists across animation changes, preserving tint and alpha.

Open `preview.html` through a local web server to inspect idle/walk, directional
facing, pause, native pixel detail and approximate gameplay size.
