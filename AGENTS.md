# Delve Deep - Codex instructions

Project root: `E:\Programming\DelveDeep`. Delve Deep is a landscape Android tactical party RPG built with JavaScript, Phaser 3, Vite and Capacitor. The repository root is the source root; do not assume `src/`. Main source folders are `scenes/`, `game/`, `combat/`, `ui/`, `config/`, `data/` and `assets/`.

Before substantial work, read this file, `docs/PROJECT_OVERVIEW.md` and `docs/CURRENT_STATE.md`, then only the focused docs relevant to the task. Inspect current code before changing gameplay, and call out documentation conflicts. Keep established rules and save compatibility. Prefer small, data-driven changes. Use JavaScript, not TypeScript. In new code, use single-line comments, no em dashes in comments, and a blank line above each new comment block.

Use PixelLab and supplied character art for new character sprites. Do not edit generated `dist/`, dependencies in `node_modules/`, or generated Android build output. Keep text and touch targets large for a Pixel 9 landscape display, preserve haptics, respect Android system areas, and keep the top banner flush with the usable game area.

Run `npm run build` for normal validation. Run maintained tests relevant to changed behavior. For Android packaging, build, then run `npx cap sync android`; use `android/gradlew.bat assembleDebug` for a debug APK. See `docs/BUILD_AND_DEPLOY.md`.

Treat the repository as durable project memory. Update `docs/CURRENT_STATE.md` only when a substantial task materially changes current state; put development history in `changelog/`, not current-state notes. Preserve work from other active chats and inspect Git status before edits.

Name chats `<Category> - <specific task>` using Blender, Bugfix, Code, Integration, Planning, Research or Sprites. Keep each chat to one coherent task. At a natural stopping point, recommend a new chat for a substantially different system or discipline, using `Recommended next chat:`. Do not split tiny follow-ups into new chats.
