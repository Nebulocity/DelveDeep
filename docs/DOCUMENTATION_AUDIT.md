# Documentation audit

Audited 2026-09-30 on branch `0.1.2-3dSprites`. This is a map of the material that existed before the cleanup and the decisions made from it. Current source and data take precedence when older notes disagree.

| Original path | Purpose and major topics | Assessment, overlap, and conflicts | Destination and information retained |
| --- | --- | --- | --- |
| `AGENTS.md` | Codex rules, stack, layout, mobile, validation | Current but pointed to scattered notes; ignored by Git | Root `AGENTS.md`; concise workflow, chat naming, source and mobile rules |
| `README.md` | GitHub landing page plus extensive engineering guide | Partly current; duplicated architecture and build notes | Root `README.md` for players; technical details in `BUILD_AND_DEPLOY.md` and focused docs |
| `ABILITY_EDITING.md` | Class, enemy, and save-safe ability editing | Current, technical; root placement was confusing | `docs/ABILITY_EDITING.md`; preserve editing entry points and test guidance |
| `SPRITE_CONTINUATION.md` | Dated PixelLab session log and handoff | Actively used by another chat; historical notes mixed with unfinished work | Leave at root until that sprite session finishes; then move useful history to `changelog/` and current conventions to `ASSET_PIPELINE.md` |
| `docs/ARCHITECTURE.md` | Stack, folders, build, persistence, design direction | Partly current; overlaps README, AGENTS and build docs | Keep path; focus on runtime modules and flow; move build detail to `BUILD_AND_DEPLOY.md` |
| `docs/CLASS_ABILITIES.md` | Current class kit, targeting, provisional balance, migration | Valuable current detail mixed with dated tuning history | Keep as focused ability reference; cross-link from `GAME_DESIGN.md`; retain provisional values clearly |
| `docs/COMBAT_SYSTEM.md` | Combat behavior, HUD, tactics, spacing, threat | Largely current; repeats some ability tuning | Keep as detailed combat reference; authoritative rules summarized in `GAME_DESIGN.md` |
| `docs/GAME_DESIGN.md` | Core loop, raid leader, tactics, encounters | Partly current; long-term concepts mixed with implemented behavior | Keep as game rules; label planned ideas and link detailed references |
| `docs/PROJECT_CONTEXT.md` | Product context, party, roster, progression, monetization | Partly current; duplicates game design and architecture | Consolidate into `PROJECT_OVERVIEW.md`, `CURRENT_STATE.md`, `GAME_DESIGN.md`; archive original |
| `docs/SLIME_CAVE_LEVEL.md` | Phaser/Blender integration measurements and limits | Current technical snapshot, but some statements are dated; another chat is inspecting the Blender source | Preserve game integration facts in `BLENDER_PIPELINE.md`; archive original without editing Blender files |
| `docs/TODO.md` | Mixed unverified requests and current technical debt | Partly outdated: several items already implemented; not a reliable list of confirmed bugs | Replace with `KNOWN_ISSUES.md` and `CURRENT_STATE.md`; archive original for requested history |
| `docs/UI_RULES.md` | Landscape layout, touch and HUD rules | Current and distinct | Keep as focused UI authority |
| `docs/WORLD_MAP.md` | Locations, progression, visual rules, test mode | Mostly current; overlaps game design | Keep as focused map authority and link from game design |
| `assets/blender/the_slime_cave/README.md` | Local Blender source and export helper | Current, active Blender work; another session owns it | Leave in place; summarize stable workflow in `BLENDER_PIPELINE.md` |
| `ios/App/CapApp-SPM/README.md` | Capacitor-generated Swift package note | Generated platform documentation | Leave in place; outside project editorial docs |

`change_log/` was empty. No standalone release notes or version history existed. The dated sprite continuation is the only substantial development log and remains at its active path until the sprite session finishes. `changelog/README.md` now states the history convention.

## Conflicts and open questions

- `PROJECT_CONTEXT.md` describes current tank roster including Gladiator, and `data/classes.js` confirms Gladiator is a Tank. Older README combat prose described generic tank taunts; current abilities are defined per class in `data/classes.js`. Treat class data and `CLASS_ABILITIES.md` as the tuning source.
- Dawnwarden's Challenge, Defiant Stance, Sanctity Nova and Sunbrand Strike descriptions match `data/classes.js`; no class-name conflict was found there. Detailed values are duplicated across `CLASS_ABILITIES.md` and `COMBAT_SYSTEM.md`, so future tuning should update both or consolidate the values.
- `TODO.md` calls for features already present in source (for example the dev controls and per-character tonic HUD). Remaining physical Android layout and interaction checks are unverified, not confirmed defects.
- The Blender authoring source is local and intentionally outside Git. Its exact camera transform and export procedure are being checked in a separate chat; do not infer them from the Phaser floor coordinates.
- `docs/` and `AGENTS.md` were ignored by the current `.gitignore`, so local documentation was absent from fresh clones. This cleanup force-adds the selected authoritative files to Git without changing the other session's uncommitted `.gitignore` edit.

## Suspected obsolete code and assets

| Candidate | Evidence | Decision |
| --- | --- | --- |
| `data/levels/_old_SlimeCave.js` | No runtime import or scene registration; `data/delves.js` imports only `data/levels/SlimeCave.js`. The maintained environment test imported it only to compare stable ID, depth and difficulty. That test now asserts those saved values directly. The old definition duplicates `slime-cave` and points to prior art. | Remove the unused JS definition. Git retains history. Do not remove associated art while Blender work is active. |
| `entities/`, `systems/`, `utils/` | Only `.gitkeep` files and no runtime modules. | Remove empty placeholders; directory layout in old README was misleading. |
| `combat/BattlefieldTerrainEditor.js` | Imported and instantiated by `BattleScene.js`. | Keep; development tool is reachable. |
| `combat/TacticsController.js`, `combat/LayeredEnvironment.js`, `combat/UnitSprite.js`, `combat/SpriteMotion.js` | Direct imports from active battle or sprite code and tests. | Keep. |
| `services/OrientationService.js`, `ui/ConfirmationDialog.js` | Direct imports from active scenes. | Keep. |
| `data/items.js` compatibility aliases and `game/GameStorage.js` ID migrations | Referenced by persisted equipment and roster records. | Keep to preserve saves. |
| Character and environment assets | Runtime uses URL and string-key loading; PixelLab and Blender sessions are active. | Do not remove any assets in this pass. |

No other code deletion met the required confidence threshold during this audit. In particular, string-based Phaser scene/asset references make a simple filename or import-count test insufficient.
