# Interactive tutorial integration

The World Map footer's Tutorial button calls `openTutorialReplay(scene)` in
`ui/TutorialReplay.js`. It currently opens a dismissible region-themed preparation
notice. Its existing position, button styling, input feedback and map camera handling
are retained. The notice does not write saves or alter gameplay state. Recorded guide
clips, their slide catalog and their player have been removed.

The interactive tutorial is not implemented. Integrate it after its design is supplied:

- Reuse one set of interactive steps for first-time and replay modes.
- Launch first-time mode naturally for new players and track completion through the
  normal save system. Define its trigger and completion fields with the tutorial design.
- Route this map entry point to replay mode. Preserve progression, inventory, currency,
  recruitment, abilities, quests and completed delves.
- Keep temporary tutorial party and tactical changes isolated from the player's normal
  configuration, including across exit or interruption. Allow an explicit return to normal
  gameplay. Choose the isolation and restoration mechanism with the tutorial design.
- Prevent replay from granting duplicate one-time rewards or changing first-time
  completion state. Share instruction steps while keeping mode-specific persistence and
  reward handling explicit.
- Do not add development-save migrations or restore the video player.

Vite emits only referenced runtime assets; there is no root `public/` copy directory or
custom asset-copy plugin. Capacitor uses `dist/` as `webDir`. Rebuild, then use Capacitor
copy/sync before packaging so native projects replace their previous bundled web assets.
Previously built APKs and local archives retain their historical content.

Tutorial checks in `tests/visual/tutorial.spec.js`, `tests/visual/ui-corrections.spec.js`
and `tests/visual/audit/overlays.spec.js` verify the preparation notice. They no longer
import the removed catalog or expect video playback controls. Full interactive tutorial
coverage awaits its design and implementation.
