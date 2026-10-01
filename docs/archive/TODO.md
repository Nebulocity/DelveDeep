# Delve Deep – Current TODO / Validation List

This file summarizes known current or recently-requested work. Treat the live codebase as authoritative for what is already complete.

## Party Select

- Verify first-time Party Select has no default characters selected.
- Verify subsequent Party Select screens default to the previously used party.
- Remove Caramon from Melee if he still appears there; keep him as Tank only.
- Ensure adventurer cards never spawn partially off-screen.

## Combat UI

- Verify mob health bars are visible.
- Show health clearly in character / party UI.
- Show mana in the bottom party interface.
- Do not show mana above battlefield character sprites.
- Show class beneath character name in the bottom party list.
- Announce spells, heals, and abilities through floating combat text.
- Make critical-hit floating combat text larger.

## Combat Behavior

- Fix global movement so battlefield clicks do not move the whole party unintentionally.
- Verify manually moved units stay in place after Hold.
- Verify Spread and Stack behave differently.
- Verify Focus targets DPS without breaking healer priorities.
- Verify unit tap toggles selection / deselection.
- Add / validate Rogue re-stealth after 5 seconds without attacking or being attacked.

## Ability / Spell Authoring

Improve or document the system so it is easy to:

- Modify existing abilities.
- Add new abilities.
- Add spells by class.
- Adjust cooldowns, costs, damage, healing, conditions, and AI priority.

Prefer data-driven definitions.

## Dev Tools

- Add / verify Clear Progress.
- Add / verify Unlock All / Testing Mode.
- Allow repeated runs of delves and portals in testing mode.
- Add a button to grant a Void Key.
- Make all warning / explanation text wrap inside the window.

## World Map

- Remove obsolete "Old Road" display text.
- Keep location icons below nameplates.
- Keep top banner flush with the top of the game area.
- Verify world map loads correctly on physical Android devices.

## Android / Capacitor

- Production APK must not depend on `http://localhost:5173/`.
- Development live-reload configuration should not accidentally ship in normal builds.
- Validate with:

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

## Ongoing Architecture

- Keep JavaScript; do not migrate to TypeScript.
- Keep repository root as source root; do not introduce `/src` unless explicitly requested.
- Avoid editing `dist/`, `android/`, or `node_modules/` as source.
- Keep systems extensible and data-driven.
