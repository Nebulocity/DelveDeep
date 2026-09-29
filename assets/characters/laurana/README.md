# Laurana — PixelLab sprite source

## Current approved design: stern chibi

The runtime now uses `chibi/` and the exact approved design in
`concepts/chibi-laurana-stern.png` (PixelLab image
`3c2b2067-e1db-42bf-b78e-83c888f52190`). Keep its large head, short body and
stern expression. The taller anime experiment was rejected and is not used.

PixelLab reference-rotation character: `c7d1866b-fa72-410c-b483-1381110d7a8b`.
Four authored facings support eight movement headings; no frames are mirrored.
Idle, walk, attack, block, hit and death retain the existing combat event hooks.
The final death frame remains as a corpse until revival. Native frames are
192×224, displayed at 0.75 scale to preserve the prior battlefield footprint.
Looping clips omit the duplicate final reference frame. Generation provenance
is recorded in `chibi/source.json`. The older sprite history below is archived;
those PNGs are not loaded into the game.

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

## Shield grip correction

The original shield-block art incorrectly placed the spear behind the shield
while leaving the other hand empty. Runtime block clips now use
`pixellab/block-corrected/`, with individually authored SE, NE, SW and NW facings
and no horizontal flips. Other animation sets retain their existing mirroring.

PixelLab Pixen corrected poses (one generation each):
- NE: `a2d491ab-f55a-4c6d-9a08-1ca24528f090`
- SE: `62b88d69-2e5e-4bc6-b521-2b4e2eb03dfc`
- NW: `d5060313-060e-416f-a90c-820dd5d61829`
- SW: `b18dff3e-5d04-4c48-a2b2-d73fad3ab030`

Each edit asked for an upright spear gripped separately from the shield,
preserving the original character and transparent 140px canvas.
PixelLab animate_image jobs use those poses as both start and end frames,
with four generated frames, explicitly preserving the two weapon grips:
- NE: `f8ebc506-feb4-490e-a168-9c868946574d`
- SE: `33ee4a32-04cf-4f71-820a-fa25dd025b40`
- NW: `6c8ba0a5-08f6-4d62-adc4-6ff21a0361e8`
- SW: `9383615f-0354-4fe3-854f-e63c78462069`

The original faulty block PNGs remain only as source history and are not loaded.

The SW attack omits generated recovery frame 4, which had a duplicate spearhead.
The other frames play in order; source PNGs are preserved for provenance.
