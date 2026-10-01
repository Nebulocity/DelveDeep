# Slime Cave Phaser level

The world-map ID remains `slime-cave`. Enter through The Slime Cave, select a party,
then press DELVE DEEP. Existing combat, waves, commands, party HUD and 8 x 6 grid remain.
Existing circle combatants remain placeholders; no new character sprites were generated.

`data/levels/_old_SlimeCave.js` preserves the previous definition and terrain without
registering a second progression location. `data/levels/SlimeCave.js` is the active level.
Other delves still use the original shared presentation.

The environment renderer uses a shared camera-pixel transform for all layers and grid:
static reference fallback, background, battlefield, masked ambient patches, gameplay,
transparent foreground, then UI. The 16:9 art is fitted without stretching inside the
2400 x 1080 game canvas and translated up 120 source pixels to expose floor above the HUD.
This does not alter the Blender camera. The old artwork-specific blocked polygons are
removed for this cave; the new grid defines the open arena, with foreground occlusion.

## Assets and current limits

- Static layers: one frame each from `the_slime_cave_game_export_v1.blend`, `DD_Export`.
- `DD_Export` now has fake-user persistence so it survives saving/reopening.
- `reference.png`: first frame of the latest `SlimeCave_Lighting_v2.mp4`.
- That latest movie contains only 83 frames (3.458 seconds), not a full loop.
- `ambient.mp4`: bottom 540 pixels of the complete 240-frame, 24 fps
  `SlimeCave_Lighting_V1.mp4`. Phaser masks it to five pool neighborhoods, including
  nearby receiver pixels to carry the original shadows/reflections. The old movie's
  flickering upper highlights are outside these regions. The room is not a background video.
- This is a first integration, not a final transparent sprite atlas. Mask edges and
  differences between separately shaded stills and movie patches require an in-game
  visual review. The static reference fills any holdout gaps while video loads.
- Pool motion is environmental, so it continues during the tactical combat pause;
  Phaser scene pause/resume and shutdown stop/resume or clean up its playback.
- No new full Blender animation was rendered. Source geometry, materials, lighting,
  camera and animation were not changed.

Build with `npm run build`; preview with `npm run dev`. Browser validation was blocked
by a declined browser-access permission. Desktop interaction and Android playback remain
to be reviewed by the user. No persistence schema, encounter balance or party rules changed.

Validation: production Vite build passed; layer asset/projection checks, progression and
encounter checks, and combat-spacing simulations passed. The existing battle-behavior
test fails because its scene mock has no terrain object; this also fails with the
unchanged HEAD version of BattleScene. The original test-runner subprocess attempt was
blocked by EPERM, so the relevant test scripts were run directly with Node.
