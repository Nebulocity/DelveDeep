# Delve Deep sprite and data continuation log

Updated 2026-10-01. Upload this file to a new Codex session if this conversation or usage window ends. Read this current checkpoint first, then the latest sections at the end; the middle of this file is chronological history and some early status statements are superseded.

## Current checkpoint (2026-10-01)

- Sturm, Raistlin, Dalamar, Palin, Tasslehoff, Flint, Riverwind, and Fistandantilus are complete. Character/ability cleanup and Sturm's sacrifice ability change were tested and pushed to the user-confirmed `0.1.2-3dSprites` branch of `https://github.com/Nebulocity/DelveDeep.git`.
- Mishakal is the active character. Her supplied art is `C:\Users\kenwh\OneDrive\Desktop\DLChibi\Mishakal.png`. PixelLab character ID `5a8e0968-6c5e-427a-a3d8-a1b9c836c05a`. All four rotations and 17 of 24 animation clips are installed under `assets/characters/mishakal/reference-v2/`. The seven missing clips are block NE, hit NE/NW, and death in all four facings. Accepted/rejected job IDs are in the latest log entries and `work/mishakal-frame-manifest.json`.
- The Slime Cave references are now present at `assets/enemies/slime-cave/references/` and came from `C:\Users\kenwh\OneDrive\Desktop\DLChibi\TheSlimeCave\`. Do the slime sprites after completing Mishakal.
- The shared PixelLab animation queue is frequently full because other active chats are using it. Retry slots; do not use the rejected purple-crystal SE attack, broken-staff SW attack, or extra-hand NE block. Current filesystem permissions may require escalated commands for writes in `E:\Programming\DelveDeep`.
- Another chat has uncommitted `scenes/DungeonScene.js`, `tests/dungeon-reentry.test.js`, and Thornbriar enemy assets/scripts; preserve them. This chat's Mishakal work is uncommitted and not yet pushed. Stage only its files with explicit paths, check the index, and push only to existing `0.1.2-3dSprites`.

## User request and order

1. Correct Sturm wherever his sword points down during combat. Use supplied `Sturm (Good).png` as the raised sword reference, rather than `Sturm (Bad).jpg`.
2. Create four authored directional facings and six animated sheets for these characters, in order: Raistlin (updated art), Dalamar, Palin, Tasslehof (game ID `tasslehoff`), Flint, Riverwind, Fistandantalus (existing display spelling `Fistandantilus`, currently game ID `aoth`).
3. After all seven are done, remove obsolete character and ability data references from the code.
4. If PixelLab usage remains, create Slime Cave enemies from supplied art: Cave Slime (weak), Elder Slime (tough), Slime Sovereign (final boss). Update enemy data names to match. In current `data/enemies.js`, Cave Slime and Slime Sovereign already match; Elder is called `Elder Cave Slime`.
5. Update Sturm's `My Honor is My Life` so he can sacrifice himself when exactly Sturm and any one ally survive in the final boss wave. It restores the other party members and Sturm cannot be revived for the rest of that encounter.
6. Push all completed changes to the GitHub repo when finished.

User supplied art was displayed in this chat; local character source art is under `C:\Users\kenwh\OneDrive\Desktop\DLChibi\`. The three enemy files `CaveSlime.png`, `ElderSlime.png`, and `SlimeSovereign.png` are **not present** at those local paths despite the images shown in the chat. Ask for them to be reattached if still missing when reaching enemies.

## Repository and constraints

- Repo: `E:\Programming\DelveDeep`
- Branch: `0.1.2-3dSprites`
- Remote: `https://github.com/Nebulocity/DelveDeep.git`
- Read repo `AGENTS.md`; it requires PixelLab for sprites. The prior chat asked for 256×256 PixelLab frames, four authored facings `south-east`, `south-west`, `north-east`, `north-west`, and six states `idle`, `walk`, `attack`, `block`, `hit`, `death`. Do not mirror equipment.
- Keep user-unrelated untracked Laurana concept PNGs out of commits. `ios/App/CapApp-SPM/Package.swift` shows a line ending modification after builds; exclude it unless there is a real intended diff.
- `docs/` and `AGENTS.md` are Git-ignored. Local `docs/CLASS_ABILITIES.md` was edited but is not pushed.
- Sprite source frames: `assets/characters/<id>/reference-v2/<state>/<direction>/frame-<n>.png`. Reference art: `reference.jpg`; four facings: `rotations/`; sheet outputs: `sheets/<state>.png` and `sheets/layout.json`.
- `scripts/pack-sprite-sheets.py <id>` packs frames. It drops the last generated frame for idle/walk loops. `scripts/build-sprite-catalog.mjs` rebuilds `data/characterSprites.js`. Both scripts were extended with the remaining requested names; the catalog includes only characters whose `sheets/layout.json` exists.
- `assets/characters/reference-v2-animations.json` records completed PixelLab job IDs and frame counts. Update it for each completed character.
- The PixelLab account is Tier 1; about 653 generations remained at last check, resetting 2026-10-29. `animate_image_pixminimax` costs about one generation per 4- or 8-frame clip but sometimes queues for 10–20 minutes. `animate_image` is faster but spends more generations. PixelLab allows eight concurrent generation jobs.
- PixelLab tool access in Codex: discover `mcp__pixellab__*` dynamically through `ALL_TOOLS` in `functions.exec`.

## Completed and committed locally

- Commit `73f83bf`: Sturm's raised sword reference, four facings, all six corrected sheets, plus ability change. `combat/ClassAbilitySystem.js` removed the surviving ally's healer role requirement; `combat/BattleUnit.js` rejects revival of `delvesUsed.honorSacrifice`; `scenes/BattleScene.js` excludes sacrificed Sturm from `Arise`. Tests in `tests/class-abilities.test.js` and `tests/battle-behavior.test.js` pass. `npm run build` passed after Sturm.
- Sturm PixelLab 8-direction character: `4baf8049-ab98-4f9f-8f66-7bdfa1d3109c`. Source conversion job: `954f5802-12b5-4c84-ae03-d7ed8e7c49d1`. SW idle had a small shield artifact cleaned with PixelLab workbench result `ea7bc826-73e1-4114-ad88-ccf6432951cf`. SW attack and NW hit use selected raised sword frames. All 24 source jobs are recorded in `assets/characters/reference-v2-animations.json`.
- Commit `43b4695`: updated Raistlin art, four authored facings, all six animated sheets, runtime catalog, sprite asset test. `node tests/sprite-assets.test.js` passed. NW attack's corrupted last frame was replaced with the first clean frame of that clip.
- Raistlin PixelLab 8-direction character: `cf445947-307b-4ea0-b91f-0c5200160192`. Source conversion job: `7be2e932-74da-44a1-9128-31f766612058`. All 24 source jobs are in `assets/characters/reference-v2-animations.json`.
- Commit `5667f6e`: Dalamar reference, four facings, six animated sheets, runtime catalog, sprite asset test, and this continuation log. `node tests/sprite-assets.test.js` passed for seven characters. Dalamar PixelLab character: `f231196f-4737-4b3f-aa95-c7a90ab32ca6`; source conversion job: `6680ed12-c620-4c78-9eaf-128f13b2435d`.
- Commit `58a1414`: checkpoint of Palin's supplied reference, four rotations, eight idle/walk clips, two south-facing attacks, south-east block, and updated continuation log. Palin is still incomplete and is not yet in the runtime catalog.
- Commit `b45a64f`: completed Palin's remaining 24-clip source set, six transparent runtime sheets, sprite catalog, and test. `node tests/sprite-assets.test.js` passed for eight characters.
- Commit `0c6180c`: checkpoint of Tasslehoff's transparent authored rotations and first four idle/walk source clips; Tasslehoff remains incomplete.
- Commit `00b49df`: completed Tasslehoff's 24 source clips, six transparent runtime sheets, catalog, and test. `node tests/sprite-assets.test.js` passed for nine characters.
- These commits have **not been pushed yet**. Push only after remaining work and final tests.

## Dalamar source record (completed)

- Dalamar supplied art converted by PixelLab job `6680ed12-c620-4c78-9eaf-128f13b2435d`. 8-direction PixelLab character `f231196f-4737-4b3f-aa95-c7a90ab32ca6`; all four game facings visually checked (dark hood, black robe, jagged staff).
- Dalamar source frames, four rotations, six sheets, and job metadata are installed in the repo under `assets/characters/dalamar/reference-v2/` and `assets/characters/reference-v2-animations.json`.
- All 24 Dalamar animation jobs are complete. Each job returns `frame_count+1` PNGs; 5 frames for idle/block/hit and 9 for walk/attack/death.
- Dalamar jobs:

| State | Facing | Output frames | PixelLab job |
| --- | --- | ---: | --- |
| idle | south-east | 5 | `4adc53e2-4534-45d8-bd44-4b6e9657f8bb` |
| idle | south-west | 5 | `94266d45-db91-4ba9-96c5-af42b98de264` |
| idle | north-east | 5 | `83f82227-27f4-4fb7-9244-c1374e342ff8` |
| idle | north-west | 5 | `02becc4b-646f-4fa4-9300-e2dfb672ce36` |
| walk | south-east | 9 | `0c30bc77-598b-45d1-9ade-bdee38aadbe5` |
| walk | south-west | 9 | `116218f9-95b1-4498-84e3-f17697bfd4d7` |
| walk | north-east | 9 | `e7987394-cef4-4b03-98af-07eb70ffc522` |
| walk | north-west | 9 | `4c609c68-c792-4d39-9ddf-13c86aff9f7e` |
| attack | south-east | 9 | `c4d67be3-0371-48ae-8a77-0205a66fe75c` |
| attack | south-west | 9 | `aad58110-93ea-4013-8184-98818deab6e5` |
| attack | north-east | 9 | `2f2df8f8-9949-4677-a2fd-c61a76119c47` |
| attack | north-west | 9 | `393c6538-b9dc-4d56-a60f-0eb5efa78d30` |
| block | south-east | 5 | `94fe958c-365d-42c1-b35c-d3d116b7d731` |
| block | south-west | 5 | `54a124e5-257b-47d6-aa37-959b0fcc9443` |
| block | north-east | 5 | `9e1a5261-a9fd-406e-8806-3d8e6c3a3ef0` |
| block | north-west | 5 | `77de8d87-ad31-4850-aac4-f3a9d7797e41` |
| hit | south-east | 5 | `ae43c62b-f47b-4004-8238-d9bad681cf7b` |
| hit | south-west | 5 | `ee8b2f67-9902-4c0f-ae8e-3d54ad1fd5d9` |
| hit | north-east | 5 | `868b7029-2d47-4b8a-ab63-5e8a096f729b` |
| hit | north-west | 5 | `2b010d3b-d2f8-4a7d-91ad-a34abddc3e26` |
| death | south-east | 9 | `b8315d6a-cd6d-42c0-9d7c-7821f4c1d43c` |
| death | south-west | 9 | `9c06386b-e7a0-49a0-b8de-2c9aea745779` |
| death | north-east | 9 | `710eff01-f1bf-4ec6-9939-65615a377549` |
| death | north-west | 9 | `93878b97-ef71-4ace-bc82-4cc9970d7747` |

- Local scratch helpers for the current session are under `C:\Users\kenwh\Documents\Codex\2026-09-29\do-x20\work\`: `dalamar-frame-manifest.json` lists all 24 jobs, `install_pixellab_frames.py` downloads PNGs concurrently to the repo, `update_sprite_job_manifest.py` records jobs in the repo metadata, and `install_character_references.py` installs the four rotation frames from a PixelLab character ZIP. This file alone has the job IDs and download procedure if scratch files are unavailable.
- Dalamar was visually inspected, packed, catalogued, tested, and committed. The table remains for source reconstruction.

## Current work: Flint and remaining characters

- Palin is complete: conversion job `c0cd9d7c-9010-41b4-8c27-8c83c01753ed`, eight-direction character `a4079b0f-dec3-41ea-990d-cd9230e29c35`, supplied reference, four authored facings, and all 24 clips installed. Six transparent runtime sheets were packed, catalogued, and visually checked. `node tests/sprite-assets.test.js` passed for eight characters. All Palin source job IDs are also recorded in `assets/characters/reference-v2-animations.json`.

- Tasslehoff is complete: conversion job `d06869c7-7eb3-4cbe-9a78-c7a036a777bf`, eight-direction v3 character `c5584399-7532-4546-bdda-935fb424a4e9`, supplied art and four cleaned transparent facings. All 24 clips and six transparent runtime sheets are installed, catalogued, and visually checked. `node tests/sprite-assets.test.js` passed for nine characters. All source jobs are recorded in `assets/characters/reference-v2-animations.json`.

- Flint is next. Supplied art conversion job `df1f86d7-36d5-4b63-9f11-dea177e69766` completed and visually matched the source (older white-bearded dwarf, blue horned armor, red plume, large double-bladed axe). Eight-direction v3 PixelLab character `e88421d4-b575-4a98-ad3c-f0e55a81ba9e` is processing. Inspect four game facings, clean any background, then generate 24 clips.

Southwest attack job `5768cb34-bf38-414d-a505-17d60300358c` had white/green artifacts in source frames 2 and 7. Installed frame selection is `[0,1,3,3,4,5,6,6,8]`. Southeast, southwest, northeast and northwest block jobs had poor recovery frames; each installed selection is `[0,1,2,3,0]`. Original northwest walk job `8249ad79-0544-414d-8c98-e9683d5a16c2` changed the hoopak to a ring. Regeneration job `dd2014e9-c83a-419b-a510-cda7343da772` did the same after its first two clean frames. To retain the correct hoopak, installed NW walk uses source indices `[0,1,0,1,0,1,0,1,0]`. Its motion is subtler than the other walk facings.

Southwest death job `e1e6f7d5-a9a9-4bb8-ae9b-8ce748899a6f` had white artifacts over the face in source frames 2 and 3; installed selection is `[0,1,1,4,4,5,6,7,8]`. Original northwest death job `22335c40-45d2-4a70-91b9-26e7cace4e27` morphed the hoopak into a blue mirror; replacement job `f0ad2198-cf3c-45de-98ee-517fd03c5ee2` is installed and clean.

Tasslehoff cleaned rotation workbench image IDs: south-east `da929d41-5745-4a75-b0fe-5b5df4185805`, south-west `c4cfd8fa-2975-44e1-bbd7-c17ab0bffb5d`, north-east `5826d550-5319-47cf-b950-df6138d32590`, north-west `a61926ae-64ea-4b7e-9da3-cc63afc76542`. Animation first/last frame URLs use `https://api.pixellab.ai/mcp/pixel-tools/<workbench-id>/image.png`.

Tasslehoff jobs started:

| State | Facing | PixelLab job |
| --- | --- | --- |
| idle | south-east | `860f7998-d765-475e-984d-7946c34b042a` |
| walk | south-east | `3466ad08-3798-4bf5-b1b4-2d610340bdc2` |
| idle | south-west | `f831712e-6b58-4bb9-90c1-15f2187fe4a7` |
| walk | south-west | `4dfbce78-663c-44e3-9b09-e89657722b5e` |
| idle | north-east | `878fee8d-d07b-4737-b6c1-b62fc9efb86d` |
| walk | north-east | `13b75977-c86b-4f01-ba82-4ed044c5714b` |
| idle | north-west | `1d82544a-0125-49b6-a0fc-6538ef1a1381` |
| walk | north-west | `dd2014e9-c83a-419b-a510-cda7343da772` (regeneration) |
| attack | south-east | `aed06864-b93d-4bec-b2da-d2682f276138` |
| attack | south-west | `5768cb34-bf38-414d-a505-17d60300358c` |
| block | south-east | `f6028f7f-1994-4aba-b607-e686fb3de5fe` |
| attack | north-east | `3d62a9ab-e701-4c91-aa26-e4f055b7af6b` |
| attack | north-west | `35358a44-7181-43b7-9aa3-d7dfa429e54c` |
| block | south-west | `1781003f-cf82-4086-bcf6-9b261be78dfc` |
| block | north-east | `fc2ca3a1-d1c4-4601-8ae4-ceb57dd427ea` |
| block | north-west | `c7244636-c5f7-4f30-b448-5a2b834d00c5` |
| hit | south-east | `e0996555-afc1-40c8-91b8-252b443944a7` |
| hit | south-west | `25569f51-f339-422b-be18-cfda4b578bbc` |
| hit | north-east | `01449951-0e94-4486-a15b-45e2bd96caa7` |
| hit | north-west | `4d88dacc-266d-49e1-b4d3-7eb73ccd4a8a` |
| death | south-east | `6ae20965-b211-4bbe-a0d2-84ae7f4fd3e6` |
| death | south-west | `e1e6f7d5-a9a9-4bb8-ae9b-8ce748899a6f` |
| death | north-east | `b5b235c2-8af0-4e6b-90a6-7b704a1b4c6d` |
| death | north-west | `f0ad2198-cf3c-45de-98ee-517fd03c5ee2` (replacement) |

South-east block job `3a9c5e2e-a620-4170-833c-54b5df905edf` had a damaged final transition frame; installed output frames use source indices `[0,1,2,3,0]`.

Palin jobs started (each returns 5 frames for idle/block, 9 for walk/attack):

| State | Facing | PixelLab job |
| --- | --- | --- |
| idle | south-east | `23238654-490c-4d22-bb9c-575b8c99b053` |
| walk | south-east | `e756748b-b2fd-425b-8d4f-f263ca41854b` |
| idle | south-west | `5cd20645-f93d-495e-bd59-45e3c93f0e5f` |
| walk | south-west | `8641c1e9-a4c2-441b-a4bd-b6e03c289481` |
| idle | north-east | `539a44b7-3723-4e2c-92f6-aba6a6a2222c` |
| walk | north-east | `a5cc22af-9cdb-40ad-8041-8a5f7e8fee60` |
| idle | north-west | `4693d145-25f9-4ef0-94ee-822d84b837f5` |
| walk | north-west | `a98d391d-ac00-4a4f-bf9c-0fa74dfbf2c5` |
| attack | south-east | `ce4f9322-a241-4b46-af89-e4fb866d736a` |
| attack | south-west | `4ffd80eb-7685-475b-ac64-4ed677d6b1d2` |
| block | south-east | `3a9c5e2e-a620-4170-833c-54b5df905edf` |
| attack | north-east | `f5357bba-d107-45c3-9108-5ba7ce762a86` |
| attack | north-west | `657e60c7-8ed3-4486-ba66-a22bfd15d2e9` |
| block | south-west | `5d9dd113-3865-44af-b215-f374dc5337dd` |
| block | north-east | `46787c12-dddb-4806-bd8d-044db1d4e326` |
| block | north-west | `a573a2dd-38d5-4f65-9140-e98c0a9329bd` |
| hit | south-east | `41ffa4c2-9c47-4b38-a54a-eb9acf541d4f` |
| hit | south-west | `af1f34b3-060d-4163-a969-6a6ea2ee141e` |
| hit | north-east | `1abfbfbe-38b7-4267-a2e3-a46880cceb97` |
| hit | north-west | `383c8d1e-9abb-497a-a00c-271aaae88673` |
| death | south-east | `00d8b50d-9723-4902-ab1f-7a9b3ee6e686` |
| death | south-west | `9da5ca0b-2817-4f2b-a37c-88e734404159` |
| death | north-east | `4a307e6b-6d09-4985-8fff-7f4816bc7454` |
| death | north-west | `4fa8d435-b978-4e3b-8a05-63e88a521940` |

Prepare each supplied PNG as a ~512px JPEG. Call PixelLab `image_to_pixelart` with `faithful:true`, `init_image_strength:180`, `output_width:256`, `output_height:256`. Then call `create_character` in `v3` mode with eight directions, 256px, low top-down, using the converted image download URL as `reference_image_url`. Inspect the four game facings before animation. Download the PixelLab character ZIP (`https://api.pixellab.ai/mcp/characters/<character-id>/download`) and install only `Idle/rotations/<direction>.png` as the four facings and SE as `base.png`; do not use the generated template animation in that ZIP. Prior template animation changed Sturm's design.

For each facing, `animate_image_pixminimax` with the rotation URL as `first_frame_url`, `no_background:true`, and `direction`. Pin `last_frame_url` to the same rotation for idle, walk, attack, block, hit; leave death open to end in a fallen pose. Use frame counts 4 idle, 8 walk, 8 attack, 4 block, 4 hit, 8 death. Keep distinctive equipment in the same hand and design consistent. Contact sheets should be visually checked; fix or replace corrupted individual frames before packing.

Continue in order: Flint (`Flint.png`, game ID `flint`, double-bladed axe), Riverwind (`Riverwind.png`, game ID `riverwind`, **bow** per supplied art), Fistandantalus (`Fistandantalus.png`, likely game ID `fistandantilus`, red hood and ornate red crystal staff). Preserve user art and authored facings.

## Code/data cleanup and enemies after characters

- Current `data/adventurers.js` has `createAdventurer('aoth', 'Fistandantilus', ...)`; reconcile this obsolete ID with new Fistandantilus sprite only after all character sprites are in place. `data/classes.js` contains `CLASS_MIGRATIONS` for old classes, and there may be old ability/save migration references. User said old character and ability data are no longer needed, so inspect usages and remove obsolete references while keeping active class abilities, saves, and tests coherent.
- The current enemy data is `data/enemies.js`; Slime Cave encounter placement is in `data/encounters.js`, and level definition is in `data/levels/SlimeCave.js`. The first Delve needs Cave Slime as weak, Elder Slime as tough, Slime Sovereign as boss. Update the `Elder Cave Slime` name to `Elder Slime`. Existing IDs `caveSlime`, `elderSlime`, and `slimeSovereign` already appear in enemy data and encounters. The supplied enemy artwork needs to be recovered or reattached before creating their sprites.
- Final verification: run focused combat/ability, sprite asset, progression/encounter tests and `npm run build`. Stage only intentional changes, commit, then `git push origin 0.1.2-3dSprites`. Check remote status.


### Flint progress (2026-09-30)

- PixelLab conversion job `df1f86d7-36d5-4b63-9f11-dea177e69766`; v3 eight-direction character `e88421d4-b575-4a98-ad3c-f0e55a81ba9e`. Four game facings were visually checked: white beard, horned blue helmet, red plume, blue armor, double-bladed axe; transparent backgrounds. Character ZIP and supplied Flint reference are installed under `assets/characters/flint/reference-v2/`.
- Scratch manifest `work/flint-frame-manifest.json` in the original Codex projectless workspace tracks current animation jobs. Each output includes source frame zero, giving 5 total for 4-frame jobs or 9 for 8-frame jobs.

| State | Facing | PixelLab job |
| --- | --- | --- |
| idle | south-east | `08dcebd1-83a9-406a-8d5a-e635183736de` |
| walk | south-east | `c6428171-9cfd-44ce-ac05-118b5e0a0c50` |
| idle | south-west | `d78ec584-94f0-442a-88e8-ecbbbd81daa1` |
| walk | south-west | `86edcf77-8e26-4fd4-8e7b-fb4998d19cee` |
| idle | north-east | `f1902b50-1217-47c7-bd54-04a4937edb31` |
| walk | north-east | `e74a2515-fb8a-40ae-87ea-b8d2ef0be388` |
| idle | north-west | `e1357485-42d5-484e-80d6-9721591a0fde` |
| walk | north-west | `1c772a6a-1a77-422c-a13a-262b2ab33194` |


Further Flint jobs:

| State | Facing | PixelLab job |
| --- | --- | --- |
| attack | south-east | `b66e05bc-55e2-4dff-9256-862427742ec8` |
| attack | south-west | `049897a7-056b-4088-b450-90f623f43352` |
| attack | north-east | `05333e63-065a-452d-9649-c76bf9eb422a` |
| attack | north-west | `f5704e6e-1552-4095-b866-8c0a35613a0b` |
| block | south-east | `9016611e-c819-4dd5-9141-2b824592fa9f` |
| block | south-west | `1d5c40a9-f3c7-41be-a572-f4980ffdf647` |
| block | north-east | `1c169aad-6eab-4828-a630-fec3ea3068d7` |


Further Flint jobs. All four walking and four attack clips have been inspected and installed. Blocks, hits, and deaths are in progress.

| State | Facing | PixelLab job |
| --- | --- | --- |
| block | north-west | `defeb3a6-f096-44f6-adeb-b75c9679562c` |
| hit | south-east | `603f9354-b7ae-4c18-8166-b9e38ce564f0` |
| hit | south-west | `1ed1eba2-4b79-4565-8254-db77c3f6f109` |
| hit | north-east | `7885ed57-de22-4972-9031-97580cc7f237` |
| hit | north-west | `e3b05063-70e8-4a52-a2b5-8c2430121985` |
| death | south-east | `7726eede-be4f-4648-b0ac-2b5a8201023b` |
| death | south-west | `ec95e333-96e5-4827-bb2c-4bbb0c333911` |


- All 24 Flint animation jobs have now been submitted. Remaining death jobs: north-east `b0d40ea2-c95d-4228-b523-63a05dfa99be`, north-west `5cb010e9-85e8-40cb-b226-626072d41e26`. Four idle, four walk, four attack, and four block clips are installed. Hit and death clips are rendering.
- Flint south-west block job `1d5c40a9-f3c7-41be-a572-f4980ffdf647` had a damaged final transition frame; installed clip uses source indices `[0,1,2,3,0]`.


- Flint now has all 20 idle, walk, attack, block, and hit clips installed and visually checked. All four death clips remain in PixelLab generation. Four death job IDs are `7726eede-be4f-4648-b0ac-2b5a8201023b` (SE), `ec95e333-96e5-4827-bb2c-4bbb0c333911` (SW), `b0d40ea2-c95d-4228-b523-63a05dfa99be` (NE), and `5cb010e9-85e8-40cb-b226-626072d41e26` (NW).


### Riverwind preparation while Flint death animations render

- Supplied `Riverwind.png` converted to 256px pixel art by PixelLab job `014622bd-3e20-46d6-8544-4c4a954dd6b8`. Visual check: tan fringed archer, red headband, dark hair, bow and quiver intact.
- Eight-direction v3 character generation ID `d2975e85-6db3-4b5a-ad2a-8d8b5f6689c5` is processing. Do not replace or mirror his bow. Flint still takes integration priority; start Riverwind animations after Flint is complete.
- Flint southeast death clip `7726eede-be4f-4648-b0ac-2b5a8201023b` was visually checked and installed. Three other death clips remain in generation.


- Riverwind v3 character `d2975e85-6db3-4b5a-ad2a-8d8b5f6689c5` finished. All four game facings visually checked and installed under `assets/characters/riverwind/reference-v2/` with supplied reference; bow, quiver, headband, hair and outfit are preserved.
- Riverwind idle PixelLab jobs: SE `ac2243a8-b25c-46ec-abc1-f1a69f3d7cbf`, SW `8b37d17b-b9ba-4e02-8e93-ad323cfaa748`, NE `2ea3fc35-371a-42d2-8b23-b1d9a4acb39c`, NW `6f2a4f80-5c2c-42e7-9277-d870f5ca181c`. Jobs are pending; scratch manifest `work/riverwind-frame-manifest.json` records them.
- Flint southwest death clip `ec95e333-96e5-4827-bb2c-4bbb0c333911` visually checked and installed. Only north-east and north-west death clips remain for Flint.


- Riverwind walk PixelLab jobs queued: SE `19e3f3fc-17f8-4aa0-899b-b3db65b0c680`, SW `0e90cc44-6369-4a30-96f4-660dc4e4e62b`, NE `88e80eba-2815-4889-b7a2-e9fc5407bc34`. NW walk not yet submitted because the 8-job PixelLab queue is full.
- Flint northeast death `b0d40ea2-c95d-4228-b523-63a05dfa99be` visually checked and installed. Only northwest death `5cb010e9-85e8-40cb-b226-626072d41e26` remains.


- Riverwind four idle clips and south-east/south-west walk clips are visually checked and installed. Pending jobs: NW walk `379f7f2c-5cf0-4426-94a9-698ba07cc61d`; bow attack SE `29e0b663-837d-4dbc-b950-2fae20add061`, SW `e9f48882-1beb-4f6b-a25f-b744b75d6a46`, NE `df165433-2552-49f6-ba59-969a1c5e2f76`, NW `a3166056-6011-43b9-bf51-083687ea8c61`; block SE `b4067c8b-56df-4436-a462-d43eec15bc82`. Riverwind's `work/riverwind-frame-manifest.json` is the scratch manifest.
- The enemy art files were requested again from the user because the three chat images are not readable at the stated paths. Continue characters and data work while awaiting them.


- Riverwind northeast walk `88e80eba-2815-4889-b7a2-e9fc5407bc34` visually checked and installed. Northwest walk and four bow attacks are pending.
- Additional Riverwind jobs: southwest block `0e288341-adf6-4692-b343-264ba0f4c1c6`. Southeast block and four attacks remain listed above. All four idle clips are installed.


### Flint complete

- All 24 Flint clips are installed and visually checked. Six transparent sprite sheets were packed into `assets/characters/flint/reference-v2/sheets/`; runtime catalog now includes Flint. `node tests/sprite-assets.test.js` passed for ten characters. Attack sheet visually checked with consistent double-bladed axe.
- All source jobs recorded in `assets/characters/reference-v2-animations.json`. The southwest block selected clean source indices `[0,1,2,3,0]` as noted above. Flint is complete; continue Riverwind and then Fistandantalus.
- Riverwind northwest walk `379f7f2c-5cf0-4426-94a9-698ba07cc61d` visually checked and installed; all four Riverwind idle and walk clips are now installed. Newly queued blocks: northeast `702bfb70-f813-4d8f-b2c4-1bf7f33bdd3b`, northwest `c734dc58-7bf6-458a-a5be-0d46f5f30191`. Attack and block clips still pending.


- Riverwind four bow attack clips visually checked and installed. Source jobs: SE `29e0b663-837d-4dbc-b950-2fae20add061`, SW `e9f48882-1beb-4f6b-a25f-b744b75d6a46`, NE `df165433-2552-49f6-ba59-969a1c5e2f76`, NW `a3166056-6011-43b9-bf51-083687ea8c61`. Bow and quiver remain intact through the attack motion.
- Riverwind hit jobs now queued: SE `1476f67b-24e9-4ec6-9c21-2b4a35db6355`, SW `25708546-38b8-466f-8e52-6d22e2b3c5f8`, NE `553bf19d-8038-4e63-9d87-5ade54adc9d5`, NW `1d04268b-7da8-4d8e-bd39-17779b0b6d68`. Block clips are still processing; death clips not yet queued.


- Riverwind southeast block `b4067c8b-56df-4436-a462-d43eec15bc82` was visually checked and installed. Death SE job `9f56b426-0e58-4f0b-b533-21498a6a24cf` queued. Three other death facings remain unqueued until slots free.


### Fistandantilus preparation while Riverwind finishes

- Supplied `Fistandantalus.png` converted to 256px pixel art by PixelLab job `b1aa973d-5b31-47c0-8b71-e906180a5e50`. Visual check: pale-haired red-hooded mage, tattered crimson robe, ornate gold staff with red crystal.
- Eight-direction v3 character generation ID `0fd49919-ab42-4863-a91e-075c71d20a07` is processing. Planned game ID `fistandantilus`, reconciling the existing `aoth` record after sprite completion. Preserve user art file spelling separately.
- Riverwind all four block clips are visually checked and installed. Hit SE and SW are installed; NE and NW hits and all four deaths are still rendering. Death jobs: SE `9f56b426-0e58-4f0b-b533-21498a6a24cf`, SW `9803c1ab-14e5-40a6-b7d1-a45694e1bbb5`, NE `5f5340e0-7496-49b1-aed5-cabf22291631`, NW `213bfc8f-1d53-44a9-8cb3-32cf192ef0d8`.


### Riverwind complete; Fistandantilus queued next

- All 24 Riverwind clips (idle, walk, bow attack, block, hit, death in four facings) are installed and visually checked. Six transparent sheets packed; death sheet checked for coherent bow/quiver and complete falling poses. `node tests/sprite-assets.test.js` passes for 11 characters.
- Last Riverwind jobs completed: hit NE `553bf19d-8038-4e63-9d87-5ade54adc9d5`, hit NW `1d04268b-7da8-4d8e-bd39-17779b0b6d68`; death SE `9f56b426-0e58-4f0b-b533-21498a6a24cf`, SW `9803c1ab-14e5-40a6-b7d1-a45694e1bbb5`, NE `5f5340e0-7496-49b1-aed5-cabf22291631`, NW `213bfc8f-1d53-44a9-8cb3-32cf192ef0d8`.
- Fistandantilus v3 character `0fd49919-ab42-4863-a91e-075c71d20a07` finished. All four game rotations inspected; northwest had a small detached gray ground line. PixelLab workbench edit `d4e719ea-5859-4bfd-903a-11e3ef05a2be` removes 119 gray pixels without changing character colors. Use `https://api.pixellab.ai/mcp/pixel-tools/d4e719ea-5859-4bfd-903a-11e3ef05a2be/image.png` as the NW animation first frame if accessible. Other directions use v3 rotations.
- Future Blender level context, without opening the `.blend`: approved Slime Cave composition is 1920x1080, production camera named `CAM_SlimeCave_Game`; game fits art to a 2400x1080 canvas with `offsetY:-120`. Floor corner coordinates are in `data/levels/SlimeCave.js`. Exact camera location, rotation, lens and orthographic scale are not recorded in inspected docs/code.

### Fistandantilus animation jobs started

- Cleaned northwest rotation installed at `assets/characters/fistandantilus/reference-v2/rotations/north-west.png`; PixelLab workbench image ID `d4e719ea-5859-4bfd-903a-11e3ef05a2be`.
- First eight Fistandantilus jobs queued and recorded in scratch `work/fistandantilus-frame-manifest.json` (copy job IDs to a new session if scratch directory is unavailable): idle SE `a632fe15-bd48-4cb3-aa97-40557aefdbca`, SW `448408dd-0f35-4182-acc1-7e0b052889b0`, NE `0f9ded18-abf0-491a-9554-8c9dd78fc350`, NW `33030fb4-1207-4074-b5f9-2a32985d94bc`; walk SE `57191c6b-a9e6-4613-89e9-3455a0ea05b5`, SW `a5105b3f-720f-40f2-ad1d-8433d092364e`, NE `75d2129e-5246-40c0-8927-4adb662ff525`, NW `b2ef9f02-eb1d-4504-80fd-5be616f199c7`. Each idle has five frames; each walk has nine.

- Fistandantilus idle SW and walk SE/SW were visually checked and installed (23 frames). Walk motion preserves the red crystal staff and robe. Pending first-batch jobs listed above.
- Spell attacks queued: SE `49dc2123-440c-43b9-95ff-88711942e572`, SW `b8519ea5-838a-4f67-9ef8-997b613076c3`, NE `11f45c21-bd1a-4dcc-bcab-f7055cfc4a7c`. These are recorded in `work/fistandantilus-frame-manifest.json`; NW attack awaits a free job slot.
- Data audit: `data/adventurers.js` still has Fistandantilus under old ID `aoth`; update it after all sprites, with saved-roster/party migration in `game/GameStorage.js` to preserve existing progress. `data/classes.js` has obsolete class aliases; `data/items.js` still uses them to map stable equipment IDs, so remove only with coordinated item/save handling. `scenes/BattleScene.js` also contains legacy class checks and `scenes/old_BattleScene.js` is obsolete but inspect imports before deleting. `data/enemies.js` currently names `elderSlime` as `Elder Cave Slime`; rename to `Elder Slime` during enemy data work.

- Fistandantilus idle NE/NW, walk NW, attack NE, attack SE/NW, and block SE/SW/NE visually checked and installed. Total installed now 12 of 24 clips. Attack crystals and defensive red sigils read clearly. Tiny detached floor specks persist in some NW-generated frames; noncritical, clean during final QA if feasible.
- Original SE idle job `a632fe15-bd48-4cb3-aa97-40557aefdbca` generated unwanted hand-to-face motion; rejected. Replacement SE idle `e68ec3c5-bfef-4d28-a1d8-f00e8427067b` queued and is now the manifest job.
- More jobs queued: attack NW `89325498-e230-435f-9ad5-0ba3ea2fb241` (already installed); block SE `a1b226dd-f567-4a3d-91c9-e586f662b567`, SW `1aaa1e87-e55d-497d-9978-0d55ffd61d6f`, NE `d6348b77-b66d-4f6d-928c-ec97397ba127` (all installed); block NW `85801a00-2e86-40aa-9950-96faac6cf70f`; hit SE `32c0dc7a-ab72-432a-bb67-a49cff12a00e`, SW `1b403766-ce69-4667-927e-3991adcf7c6f`, NE `2e77c425-da73-4a58-a54b-bf099adaf741`, NW `4593ae07-3dd2-4617-8dd2-13cffd2cb6a9`. Attack SW and walk NE from prior log remain pending; death clips not yet queued.

- Fistandantilus walk NE `75d2129e-5246-40c0-8927-4adb662ff525` and spell attack SW `b8519ea5-838a-4f67-9ef8-997b613076c3` visually checked and installed. Total installed 14/24 clips.
- Death SE `9f229bba-5803-4e91-8231-c2f5d96b40fe` and SW `1b117434-3138-423a-afb2-2053c0911c06` queued; NE/NW death await free slots. See `work/fistandantilus-frame-manifest.json` for 22 of 24 planned jobs. Pending render: replacement idle SE, block NW, four hits, four deaths.

- Fistandantilus southeast idle replacement `e68ec3c5-bfef-4d28-a1d8-f00e8427067b` visually checked: hands stay in the correct ready pose. Installed with hit SE `32c0dc7a-ab72-432a-bb67-a49cff12a00e`, hit SW `1b403766-ce69-4667-927e-3991adcf7c6f`, and death SW `1b117434-3138-423a-afb2-2053c0911c06`. Death SE `9f229bba-5803-4e91-8231-c2f5d96b40fe` also installed after visual check. Now 19/24 clips accepted.
- Final death jobs queued: NE `25a61c9c-1bab-4245-8c92-ce53ca262a97`, NW `7f338ec0-c53d-4d4b-bc57-773367350dbb`. All 24 intended jobs now in `work/fistandantilus-frame-manifest.json`. Five clips remain to inspect/install: block NW, hit NE/NW, death NE/NW. After completion pack six sheets, update source job metadata/catalog/test, migrate `aoth` ID safely, and clean obsolete character/ability references.

- Fistandantilus block NW `85801a00-2e86-40aa-9950-96faac6cf70f`, hit NE `2e77c425-da73-4a58-a54b-bf099adaf741`, hit NW `4593ae07-3dd2-4617-8dd2-13cffd2cb6a9`, and death NE `25a61c9c-1bab-4245-8c92-ce53ca262a97` visually checked and installed. Total 23/24 clips. Only death NW `7f338ec0-c53d-4d4b-bc57-773367350dbb` remains in PixelLab generation.

### Fistandantilus complete

- All 24 Fistandantilus PixelLab clips installed and visually checked; six transparent sheets packed under `assets/characters/fistandantilus/reference-v2/sheets/`. Final NW death job `7f338ec0-c53d-4d4b-bc57-773367350dbb` produces a coherent prone pose with fallen staff. Attack sheet checked across four facings; red crystal spell, single staff, hood/robe consistent.
- `assets/characters/reference-v2-animations.json` records all 24 accepted source jobs. `data/characterSprites.js` catalog now has 12 characters and 72 sheets. `node tests/sprite-assets.test.js` passes all asset, clip, facing and preloading checks.
- Next: clean old character/ability data references, migrate Fistandantilus ID from `aoth` without losing saved progress, run code tests/build, then optional Slime Cave enemies if reference files become available. Enemy artwork was displayed in chat but physical files were absent at paths supplied; user has been asked to reattach/place them.

### Character/ability data cleanup and verification

- Fistandantilus roster ID changed from `aoth` to `fistandantilus` in `data/adventurers.js`, matching his sprite catalog. `game/GameStorage.js` maps saved `aoth` roster records and party selection to the new ID, preserving level, XP, happiness, and equipped item instance. A focused test proves this migration.
- Removed unused class-name aliasing from `data/classes.js`; `data/items.js` retains a narrow `KIT_CLASS` mapping because equipment kit IDs are persisted in old player saves. This is save compatibility, not active class ability data.
- Removed unreachable pre-grid class ability branches and obsolete ability helpers from `scenes/BattleScene.js`; removed unreferenced `scenes/old_BattleScene.js`. The current `combat/ClassAbilitySystem.js` now honors the player-assigned healer priority, which the old branch previously handled. Removed obsolete Rogue opener logic from active battle damage. Rewrote `ABILITY_EDITING.md` for the current data/ability system.
- All 12 JS tests pass, including save migration, active healer priority, battle behavior, sprite assets, motion and encounter checks. Production Vite build passed when run with filesystem/process access; initial sandbox attempt had Windows `spawn EPERM`, which was a sandbox limitation rather than a code failure.
- The game repo currently also has unrelated changes made outside this sprite/data task (Blender files, loading UI, Laurana concepts, iOS package). Do not stage or overwrite those when committing this work. Three enemy reference image paths supplied in chat still do not exist on disk; requested reattachment or placement from the user.

### Slime Cave enemy data and remaining work

- `data/enemies.js` now displays `Elder Slime` (formerly `Elder Cave Slime`). The existing enemy keys and strength ordering already match the request: `caveSlime` weaker, `elderSlime` tougher, `slimeSovereign` final boss. `tests/progression-encounters.test.js` passes.
- Enemy sprite generation remains pending solely because `CaveSlime.png`, `ElderSlime.png`, and `SlimeSovereign.png` are absent from the supplied OneDrive path and repository. Do not invent replacements from memory; obtain the three actual files from the user, then PixelLab-convert/animate them and connect sheets to enemy rendering. The user has already been asked to reattach/place them.
- All requested Sturm and seven subsequent character sheets are complete. Code cleanup and `My Honor is My Life` gameplay change are complete. The remaining requested work is the optional three Slime Cave enemy sprite sets and a final integrated visual check once their source art is available. Push current completed commits to the GitHub branch so progress is preserved.

### GitHub push status

- All task commits through `ef6e14c` are local on branch `0.1.2-3dSprites`, 25 commits ahead of `origin/0.1.2-3dSprites`. Configured remote is `https://github.com/Nebulocity/DelveDeep.git`.
- An attempted `git push origin 0.1.2-3dSprites` was rejected by automatic approval review: the user authorized pushing generally, but the review could not verify the exact GitHub destination for sensitive code egress. Do not bypass the rejection. An explicit user confirmation of the exact remote URL has been requested asynchronously. Retry only once that confirmation is supplied.
- Other working-tree changes in `.gitignore`, Blender, loading UI, Laurana concepts, and iOS package are unrelated and were not staged or committed by this task. Preserve them.

### Push resolved

- User explicitly confirmed `https://github.com/Nebulocity/DelveDeep.git` and the existing `0.1.2-3dSprites` branch. `git push origin 0.1.2-3dSprites` succeeded, advancing remote from `293108c` to `a6747f7`. The previous automatic-review rejection was resolved by this exact user confirmation.
- Do not push to other branches. Current remaining work is optional Slime Cave enemy sprite sheets after the three missing reference image files become available. Unrelated uncommitted workspace changes remain untouched.

### Enemy sprite integration audit

- `combat/UnitSprite.js` currently looks up `CHARACTER_SPRITES[unit.id]`. Enemy runtime IDs are unique spawn IDs (`cave-slime-wave-index-spawn-index-serial`) in `scenes/BattleScene.createEnemy`, so a future enemy sprite catalog should instead use the enemy type (`caveSlime`, `elderSlime`, `slimeSovereign`) or a stable `spriteId` passed into `BattleUnit` before its constructor calls `UnitSprite.create`. `enemy.enemyType` is currently assigned only *after* constructing `BattleUnit`, too late for constructor-time sprite lookup.
- Enemy data is in `data/enemies.js` and Slime Cave wave selection in `data/encounters.js`. Existing `combat/UnitSprite.js` can animate enemy `idle`, `walk`, `attack`, `block`, `hit`, and `death` if the sprite definition is registered and preloaded. Size/scale, hit zone, label offsets should be inspected visually for the small Cave Slime versus large boss. Write a focused runtime test for stable enemy sprite lookup when implementing.
- No enemy sprite code was changed without the missing source images. The user supplied the correct GitHub remote and the completed commits through `f071721` are already pushed on `0.1.2-3dSprites`.

### Final branch and concurrent documentation note

- The last handoff push advanced `0.1.2-3dSprites` to `b9275ca`. That commit includes this sprite continuation-log update **and documentation files (`AGENTS.md`, `docs/`, `changelog/README.md`) which another active workspace session had already staged**. These documentation files were not authored as part of this sprite task, but entered the same commit because Git commits all staged changes by default. They were pushed to the user-confirmed branch. Do not rewrite or force-push history to remove them without coordinating with the owner of that documentation work.
- Other concurrent edits remain uncommitted in the working tree. The three Slime Cave reference PNGs still need to be provided. All character sheets, game data cleanup, Elder Slime display name, tests, and build are complete.

### Mishakal and Slime Cave follow-up (2026-09-30)

- User supplied `C:\Users\kenwh\OneDrive\Desktop\DLChibi\Mishakal.png` and requested Mishakal before the three Slime Cave enemies. Mishakal already has roster ID `mishakal` in `data/adventurers.js` but no runtime sprite asset yet.
- Mishakal source was converted by PixelLab `image_to_pixelart` job `7bf11c28-6a0e-4857-b799-7a37c2e2db80`, Creator asset `4cae2490-501b-5273-aba0-54d33c4d0baf`. The 256px result preserves white/blue robes, long brown hair and silver cyan crystal staff. It has an opaque gray background, so use the transparent character rotations as animation sources.
- PixelLab v3 eight-direction character creation ID `5a8e0968-6c5e-427a-a3d8-a1b9c836c05a` is processing using that converted base. Poll `get_character(character_id=...)`, inspect four game facings (`south-east`, `south-west`, `north-east`, `north-west`), install reference and rotations, then generate 24 animation clips, pack sheets, update catalog and tests.
- The three earlier Slime Cave image paths (`CaveSlime.png`, `ElderSlime.png`, `SlimeSovereign.png`) were checked again and are absent from `C:\Users\kenwh\OneDrive\Desktop\DLChibi`. Asked user to reattach or place them in `E:\Programming\DelveDeep\assets\enemies\references`. Proceed with Mishakal while waiting.
- At task start, unrelated `scenes/DungeonScene.js` changes and `tests/dungeon-reentry.test.js` were present. Do not stage or overwrite them. Branch is `0.1.2-3dSprites` at `9e430fc` tracking `origin/0.1.2-3dSprites`; push task changes only to that branch.
- User supplied corrected paths under `C:\Users\kenwh\OneDrive\Desktop\DLChibi\TheSlimeCave\` for `CaveSlime.png`, `ElderSlime.png`, and `SlimeSovereign.png`; all three physical files were verified present. The prior missing-file blocker is resolved. Finish Mishakal first, then integrate these enemies.
- Mishakal v3 character completed. All four game facings visually inspected; staff, hair, blue/white robe and crystal remain coherent. Reference and four rotations installed under `assets/characters/mishakal/reference-v2/`. First 8 animation jobs queued; scratch manifest is `work/mishakal-frame-manifest.json`.
- idle south-east: `2700a354-765e-4bce-bfbb-611628bdebbc`
- idle south-west: `93f2a0e1-2f11-457b-af8c-3928df494b6a`
- idle north-east: `24bbf277-8e34-49c3-93d5-13b4c7d9b3b5`
- idle north-west: `c2e7d054-eea4-4ef2-b02a-48a064e8be51`
- walk south-east: `af9a9d19-66d7-44b8-9898-93eab84b7ccc`
- walk south-west: `9fb65859-b7f8-47a0-a8b9-0e0cd1b4362f`
- walk north-east: `303c600d-45a1-4880-8f85-2817ec6cd92d`
- walk north-west: `18221633-83c2-4172-a83f-22b9d389d60f`
- First six completed idle/walk clips were visually inspected and maintain the staff, crystal, robe and direction. Idle SW and walk SE were still processing at last check. Additional healing spell attack jobs queued: SE `ddaa0b48-60e8-4caf-9655-2d385ff9b783`, SW `4b1ab4d5-0bff-4067-a77e-99292bbdf48c`, NE `29137c55-59b3-4ced-977d-3d9e6fa003ad`. Attack NW and later states await PixelLab capacity. `scripts/pack-sprite-sheets.py`, `scripts/build-sprite-catalog.mjs`, and `tests/sprite-assets.test.js` now list Mishakal but catalog cannot be rebuilt until her 24 clips are complete.
- All four idle and four walk jobs completed and were visually inspected. Seven clips installed under `assets/characters/mishakal/reference-v2/`; idle SW still needs downloading. Attack NW job `60a6d1ea-2793-4a21-abc9-83cc80ee66f4` was queued and looks usable, as does NE attack. Original SE attack `ddaa0b48-60e8-4caf-9655-2d385ff9b783` changes the cyan crystal to purple and is rejected; original SW attack `4b1ab4d5-0bff-4067-a77e-99292bbdf48c` breaks staff geometry and is rejected. Regenerate both with a modest off-hand healing gesture while the staff stays fixed. Shared PixelLab queue is frequently full with other active jobs; retry as slots open.

- The eight idle/walk clips and accepted NE/NW attacks have been downloaded and installed. The next PixelLab batch is queued:
- attack south-east replacement: `e44566ad-87be-43d9-b5c5-ee32e4506e7d`
- attack south-west replacement: `75c9e4ee-f0da-4934-81b0-3f06cdc0aa5e`
- block south-east: `c378a558-5be6-4336-afc8-2f93224c9af0`
- block south-west: `e55c40d9-2a23-4970-8467-9aa62ceed6b4`
- block north-east: `3294f99e-ea81-477e-b6c3-5ed5321e9d84`
- block north-west: `2bcce22a-9bb1-4f9f-8134-ed661ccef0ed`
- hit south-east: `7e3e98f6-14cc-4ed9-a5ae-dc8deec04050`
- hit south-west: `b0309ff3-bebe-4a41-bb5d-dcc1943097b9`
- These job IDs are the source of truth for subsequent visual review. Reject any outputs that alter the cyan staff or costume before installing them.

- Mishakal replacements accepted: attack SE `e44566ad-87be-43d9-b5c5-ee32e4506e7d` and SW `75c9e4ee-f0da-4934-81b0-3f06cdc0aa5e` preserve the cyan staff and show a small free-hand healing effect. Accepted block SW `e55c40d9-2a23-4970-8467-9aa62ceed6b4`, NW `2bcce22a-9bb1-4f9f-8134-ed661ccef0ed`, and SE `c378a558-5be6-4336-afc8-2f93224c9af0` using only source indices 0-3 because index 4 turns the ward green. Accepted hit SE `7e3e98f6-14cc-4ed9-a5ae-dc8deec04050` and SW `b0309ff3-bebe-4a41-bb5d-dcc1943097b9`. These clips are installed.
- Block NE `3294f99e-ea81-477e-b6c3-5ed5321e9d84` has a duplicated hand in the generated ward and is rejected; regenerate. Still needed: hit NE/NW, four death directions, and NE block replacement. Shared PixelLab queue is full with other active work; keep retrying slots.
- Hit NE job `78c2fb7b-4654-4617-90cb-92d0e16c6d07` queued; NW hit, four deaths, and NE block replacement still need queue slots.
- Hit NE job `78c2fb7b-4654-4617-90cb-92d0e16c6d07` was visually checked and installed; 18 of 24 Mishakal clips are now installed. Remaining: block NE replacement, hit NW, and four death clips.
