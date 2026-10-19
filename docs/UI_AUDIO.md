# Semantic UI audio

## Current delivery status

UI event wiring and saved controls are implemented. Audible UI feedback is pending all nine verified audio assets below. The repository's `sounds/` directory currently contains background music only. Existing music is not repurposed as UI audio. No synthesized placeholders, external audio downloads, or unverified third-party sounds were added.

`data/uiSounds.js` is the authoritative semantic registry and machine-readable asset request manifest. To integrate a delivered sound, add a Vite-resolved `url` and `license: { verified: true, source, rights }` to its registry entry only after reviewing commercial redistribution rights and the actual audio. Record the source/license evidence with the delivered asset. Boot preloads only verified entries; missing/unverified files are silent and never requested by the loader. No application code should select a sound by button caption or duplicate this registry.

## Required asset manifest

All files are **missing**. Each runtime filename below uses Ogg Vorbis `.ogg`, mono, 44.1 or 48 kHz. Keep lossless WAV masters outside shipped runtime. Trim leading silence, fade the tail gently, avoid clipping, match perceived loudness across the set, and exclude music/voice. The listed durations are authoring targets, not measurements of delivered files.

| Filename | Target duration | Sound description | Intended semantic event |
| --- | --- | --- | --- |
| `ui-click.ogg` | 0.04-0.10 s | Soft dry wooden tick with restrained attack and no ringing tail | Ordinary selection, filter, toggle, tutorial playback controls |
| `ui-navigation.ogg` | 0.12-0.22 s | Gentle leather/parchment movement with a quiet wooden accent | Enter a Town destination, return to Town/World Map, select a map destination or start travel |
| `ui-dialog-open.ogg` | 0.10-0.18 s | Subtle parchment unfolding | Open Settings, details, confirmation, tutorial, Save Transfer or recording archive |
| `ui-dialog-close.ogg` | 0.08-0.15 s | Short soft parchment settling, distinct from opening | Explicit dialog dismissal or cancellation |
| `ui-success.ogg` | 0.18-0.35 s | Small warm resolved metallic accent, no fanfare | Successful generic mutation, tactic unlock, character choice or backup export |
| `ui-failure.ogg` | 0.12-0.25 s | Muted low wooden double knock, no harsh buzzer | Actual failed action, insufficient requirements on an attempted action, backup/archive operation error |
| `ui-purchase.ogg` | 0.20-0.40 s | Two or three small gold coins settling on wood | Completed buy/sell/inscription merchant transaction |
| `ui-training.ogg` | 0.25-0.45 s | Page turn with a restrained bright magical resolution | Successfully learn or train an ability rank |
| `ui-equipment.ogg` | 0.12-0.28 s | Soft leather strap and small metal buckle | Successful gear/ability/tactic equip or unequip |

Accept original owned/commissioned recordings, verified CC0 sources, or a license explicitly allowing commercial game redistribution. Retain attribution where required. A public download or a vague royalty-free label alone is insufficient verification. Do not introduce a fallback tone or assign the same ordinary click to every semantic event merely to fill the manifest.

## Runtime ownership and duplicate prevention

`game.uiAudio` uses the existing Phaser sound manager alongside the unchanged `game.music` service. It owns only short UI sound instances, caps concurrent UI voices at four, cleans completed voices, and stops its voices when backgrounded or destroyed. It never changes the sound manager's global volume/mute, the BGM preference, or combat playback. Locked browser audio and unavailable devices fail silently without blocking gameplay.

`runUiAction(scene, action, fallback)` groups one accepted interaction. `playUiSound(scene, event)` records its specific outcome; the higher-priority outcome replaces the fallback click. Nested shared helpers reuse the group. Asynchronous operations receive a `report(event)` closure bound to that interaction. Report through that closure after `await`; do not use a global current gesture after an asynchronous boundary. DOM archive and backup operations use this pattern. Synchronous notifications are coalesced until a microtask flush.

`bindButtonPress` supplies the ordinary click on valid activation only. Visual-only bindings do not emit a sound. `bindSelectionDetails` owns the short-tap sound for inspectable selections, so a visual binding on the same target does not double-play it. Drag cancellation, pointer-out, disabled controls and held-details release do not acquire an extra ordinary-click sound. Held inspection uses the dialog-open event. No global pointerdown listener adds a second sound.

## Integrated screens and actions

- **Town Hub:** both navigation layouts use the same shared button path; destination/World Map travel uses navigation events; Settings uses dialog events and navigation-style options use clicks.
- **World Map:** header/footer/Settings controls use shared presses, destination selection and Travel use navigation, rejected travel uses failure, held location information opens details. The seven-tap developer unlock retains its original counter and release handler.
- **Heroes:** character selection, information controls and return navigation use shared feature/selection helpers.
- **Abilities:** selection/filter/slot controls use clicks; committed rank training uses training; loadout changes use equipment; failed mutations use failure.
- **Equipment:** selection uses clicks; actual equip/unequip results use equipment or failure.
- **Tactics:** selections use clicks; successful unlock uses success; loadout changes use equipment; rejected resource/loadout actions use failure.
- **Inventory:** shared category/item/recipe controls use clicks; unequip uses equipment or failure; return navigation is shared with the other Town features.
- **Market:** shared shop controls and merchant changes use clicks; completed purchases/sales/inscriptions use purchase; other committed service actions use success; failed transactions use failure.
- **Tavern, Exchange and Quest Journal:** existing selections and construction notices use ordinary clicks through the shared helper, with no false purchase/success event for unfinished features. Return uses navigation.
- **Shared dialogs:** details, confirmations, guild/shop variants, tutorial, encrypted Save Transfer and combat recordings have semantic hooks. Recordings changes are confined to archive dialog controls and do not change combat recording or playback rules. Backup import does not announce success before the replacement is actually committed.

## Saved controls and limits

World Map Settings contains Sound effects ON/OFF and SFX volume minus/plus controls in its existing masked scroll area. They write `preferences.sfxMuted` and `preferences.sfxVolume` through normal profile saving. Volume ranges from 0 to 1 with 10-percentage-point increments; default is 0.7 and SFX is initially unmuted. Restore clamps nonfinite/out-of-range input to a valid value. This adds supported preference fields without save migrations. BGM remains independent.

No automated tests, lint, builds, game launches or browser/audio checks were run for this audio change. All audible balance, format compatibility, touch behavior of the added Settings rows and Android lifecycle behavior remain unverified until approved sounds are supplied and a focused runtime check is requested. Native operating-system dialogs do not receive custom sounds internally. Automatic modal cleanup during scene shutdown/rerender intentionally does not emit dismissal sounds.
