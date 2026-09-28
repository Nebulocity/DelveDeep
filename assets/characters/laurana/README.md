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

## Expanded combat animation set

The same PixelLab character now supplies front/back three-quarter combat clips,
mirrored for left-facing headings. Sources:

- Active idle: `fight-stance-idle-8-frames`, group `00129fbe-3dfa-4be5-b228-b9cbcc07f2cc`.
- Hit: `taking-punch`, group `135aed21-8d30-4195-97d9-e5b54457fc72`.
- Death: `falling-back-death`, group `888f9ba3-7c0e-4efc-912e-ea87c87e0777`.
- Attack: v3, six generated frames plus reference, group `751c8cdb-21e7-450d-85c3-7c8abef2ab76`.
  Prompt: Plant feet, draw spear back, thrust spear sharply forward at enemy, then
  recover to ready stance. Keep shield in other hand. Stationary spear jab attack,
  full spear stays in frame.
- Block: v3, four generated frames plus reference, group `3405270f-e62b-4d31-a7e4-9db01e46a800`.
  Prompt: Raise round shield in front of torso, brace visibly against an incoming
  blow, recoil slightly behind shield, then lower to ready stance. Keep spear in
  other hand. Feet planted.

Walk timing is 75ms/frame (formerly 110ms); active idle is 110ms/frame.
Attacks, taunts, incoming hits and existing defensive damage reductions drive
one-shot clips. Shield poses do not introduce a new block chance or change damage.
Death plays once, including after battle end, and holds the final frame as the
corpse. Revival resets it. Pause still freezes all animation. Combat movement
speed, cooldowns, stats and saves are unchanged.
