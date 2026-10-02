# Codebase audit

- Traced the runtime import graph from `main.js`; every source JavaScript module under `config/`, `scenes/`, `game/`, `combat/`, `ui/`, `data/` and `services/` is reachable. Scene registration and asset URLs were checked alongside imports.
- Removed a tracked browser crash profile, an unreferenced preview server, a stray shell configuration file under `android/~`, and a root screenshot showing the old four-wave encounter. Added the preview profile to `.gitignore`.
- Removed an unused terrain editor field and added comments around ability timing and targeting, terrain editing, sprite presentation, session state, and shop row construction. Existing comments were left intact.
- Preserved sprite source frames, packed sheets, PixelLab handoff files, and script tools because the active art pipeline still uses them. Saved ID migrations and placeholder facilities also remain intentional.
- `npm run build` succeeded. All 19 maintained JavaScript test files passed when run directly. The aggregate Node test runner could not spawn child processes in the workspace (`EPERM`).
