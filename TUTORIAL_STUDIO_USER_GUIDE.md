# Tutorial Studio user guide

Tutorial Studio authors location-based stories separately from tutorial gameplay requirements. **Save draft** keeps work in the editor. **Apply to game** saves the draft and updates `data/tutorialPresentation.json`; restart the game to load that story. Neither changes recruitment, party-save, combat or reward rules.

## Open the editor

From the Delve Deep repository, run:

```powershell
npm run tutorial:studio
```

Open **http://127.0.0.1:5186**. Keep that terminal open; Ctrl+C stops Studio. The local development socket binds only to 127.0.0.1, on port 5187. The ordinary game continues to use `npm run dev` independently.

The preview has its own in-memory localStorage installed before game imports. It never loads the normal browser profile's save. Studio writes its draft and backup, imported art/audio and their manifests. Apply to game additionally writes the fixed presentation file with a backup. It has no general filesystem, account or cloud API. Offline progress and automatic curriculum startup are disabled in the disposable preview. Cue delays and duration limits follow its scene clock.

## Build a story

1. Choose **Add story point**. Drill into **Pineshire Reach > Pineshire > Enchanter**, or select Pineshire itself for the town hub, the region for the world map, or a Delve for its overview. Click **Add Story Point** at the selected location.
2. The point appears in **Chronological** and its location view: **Region**, **Town**, or the matching Delve. These are views of the same point. **Earlier point / Later point** changes chronological playback order.
3. Give the point a label and choose **Play when**: **Intro, before tutorial** starts on a fresh adventure; **Player enters this location** waits for that location in story order; **Previous story point finishes** continues the same sequence and opens its selected scene. Scene-entry points distinguish merchants that share a scene. Disabled points and disabled lines are skipped.
4. Edit the first dialogue's text, speaker, portrait and style. **Add dialogue** makes the next box. **Duplicate**, **up / down** and **Delete** work within that point. Use **Delete story point** to remove the whole conversation. The final line can be edited or disabled; delete the point to remove it entirely.
5. Choose **Scene Exit**: **Immediate**, **0.5s fade**, **1s fade** or **1.5s fade**. It runs after the last enabled dialogue is advanced, before the next point or return to gameplay.
6. Dialogue and newly created story points inherit the current window position. Drag the top of the window to reposition it. Each line can override placement, and safe-area placement protects the external Exit control.
7. Choose **Preview sequence**, then tap dialogue to advance. A **Tap to advance** footnote replaces the Continue button. A drag scrolls overflowing text without advancing. Exit remains outside the box. Playback crosses into the next enabled point only when its trigger is **Previous story point finishes**; otherwise it stops at that trigger boundary.
8. **Save draft** stores work without changing the game. **Apply to game** validates and writes the presentation used by the game. Story progress saves the current line and completed point IDs separately from tutorial evidence. An enabled, published intro replaces built-in onboarding, including its saved checkpoints; independent optional help remains available. Finishing a sequence keeps its final authored location and returns control to gameplay or waits for the next location/wave trigger. In the game, the framed **Exit Tutorial** button opens a centered confirmation. **Stay** resumes the current line. Confirming **Exit Tutorial** dismisses the published tutorial, including later location and wave lessons, and declines the built-in onboarding instead of starting it. Earned progress is kept and the existing recruitment skip policy makes Garrick available.

The story timeline begins empty. Existing tutorial checkpoints and their authored content remain under **Tutorial gameplay checkpoints**. Checkpoint order, real completion requirements and gameplay target grants stay protected. Gameplay instructions show the required action instead of offering a tap that could bypass it.

The preview blocks gameplay input while authoring. **Interact with scene: On** permits real controls in disposable preview data. Battle preview starts with an ordinary roster fixture and stays paused while editing; interacting with the Pause control can run that ordinary fight. There is no forced victory, fake reward or simulated mastery button. Story locations use Delve overviews. Map camera choreography and moving cinematic actors are separate from these conversation and scene-exit controls.

The draft present before this update is preserved as `authoring/tutorial-studio/draft.before-story-editor.json`. Normal Save maintains `draft.json.bak`. Undo/Redo, Revert, JSON import/export, readable HTML/Markdown storyboards and Restore backup remain available. JSON exports include story locations, triggers, order, exits and dialogue.

## Portraits

**Find portrait** filters the registered **Portrait library** by name; it does not accept file paths or scan folders. Search updates as you type and the registered library is available before the preview finishes loading. Select a portrait, set **Speaker name**, and choose left or right. Selecting a portrait automatically chooses left if its side was none; typing a speaker name alone does not select artwork. **Idle loop**, **Still portrait**, **Speak 3 seconds, then idle**, and **Special clip, then idle** use registered artwork. Tiko speaks for three seconds before idling. Other characters use available registered clips. Scale and contain/cover cropping stay inside a masked portrait slot above the footer.

Use the **Portrait horizontal offset (%)** and **Portrait vertical offset (%)** sliders to move the artwork inside its frame for each line. Both range from -100 to +100 with zero at the center, a visible value and **Reset to 0**. Positive values move right/down; negative values move left/up; zero centers the art. Dragging updates the artwork immediately without restarting the line or repositioning the dialogue panel. Offsets are percentages of the visible portrait slot, so they follow the preview size. Increase **Scale** if repositioning reveals empty space. **Portrait frame size** adjusts the slot separately from the artwork zoom and defaults to 1.1 (about 10% larger), with room reserved for the footer and dialogue text. Save draft retains these settings; Apply to game publishes them with the dialogue.

**Scale** and **Portrait frame size** also use live sliders, with 0.01 increments and visible multipliers. Scale ranges from 0.50 to 1.50 and resets to 1; frame size ranges from 0.80 to 1.25 and resets to 1.1. Adjusting either keeps the dialogue and audio playing. Each completed slider adjustment is one Undo step.

To import a portrait, select a dialogue line and click **Import portrait**. Enter a speaker name and choose a square PNG, 32-1024 pixels per side and under 4 MB. Click **Import and use portrait**. Studio registers and selects it, fills the speaker name and uses the left side if no side was selected. Then **Save draft**.

Artwork is stored under `assets/npcs/imported/`, with a stable ID in `data/tutorialPortraitImports.json`. Import refreshes only the disposable preview, retaining the unsaved draft. Undo reverses selection but retains imported art for reuse. Copy the imported assets and manifest when moving a JSON draft to another computer. Imports do not recruit heroes or publish dialogue; use Apply to game when ready.

## Spotlights and placement

Select an added dialogue line, click **Pick spotlight target**, and click an actual scene control. Studio stores its registered semantic ID, not clicked pixel coordinates. The live library shows availability, bounds and reasons for unavailable controls. Decorative/unregistered artwork cannot become a gameplay identity. Hidden, clipped, disabled and off-camera controls are unavailable. An unavailable spotlight produces a warning. Existing checkpoint target grants stay locked.

Drag the panel's top strip to suggest a normalized placement preference. The translucent shadow shows the resolved drop position. When a dragged panel would overlap a protected control or leave the safe area, it settles at the nearest safe position; releasing saves that resolved position. A stationary tap advances a dialogue line. Placement remains subject to safe areas, the external Exit button, registered targets and scene controls. Inspect the stage status for resolved bounds and unavailable targets.

## Audio timeline

Choose registered music, sound effects, ambience or voice assets, or import OGG, MP3, WAV or M4A audio up to 8 MB. Imported files live under `sounds/tutorial-studio/` with `data/tutorialAudioImports.json`; copy both when moving drafts.

Each line supports bounded cues with volume, delay, maximum duration and fade-in:

- **onEnter** plays when the line starts; **afterMs** uses its bounded delay.
- **onAdvance** plays when dialogue is advanced; **onLeave** runs on a normal line handoff.
- **event** waits for a supported real gameplay event in the current scene session. Boss landing has no supported authoring adapter.

Use **Play audio**, **Stop audio**, or preview mute controls while authoring. Browser autoplay may require a real click. Cues respect game audio settings; unavailable assets and blocked playback are reported. Preview cue timing uses scene time. Preview mute affects only disposable preferences.

## Checks and limits

**Validate** displays data and asset diagnostics; it does not run gameplay or award evidence. Live target warnings depend on the selected scene. Drafts are bounded and accept only registered locations, supported presentation fields and audio events. Scripts, gameplay predicates and arbitrary filesystem paths cannot be authored.

Blur/background stops pending cues and hides dialogue with its external Exit presentation. Focus restores the presentation without unexpectedly restarting interrupted audio. Runtime playback, scene fades, Android Back, warning overlaps and physical Pixel 9 touch/layout behavior in this update remain unverified. No automated checks or game launches were performed for this change.

Studio error, import and location dialogs block the preview iframe and its game input until closed, including when Interact with scene is on. Registered audio choices are available before the live stage is ready; Preview sequence waits for readiness instead of treating an empty loading catalog as missing audio. Startup failures appear below the preview.

When Studio server code changes, restart its terminal process; refreshing the browser alone does not restart Node. Export JSON before restarting if dialogue is unsaved. The server loads the live presentation validator, and the editor detects outdated server versions. Unsaved edits are also kept in tab session storage when possible and restored on refresh when the saved draft revision is unchanged. This is a recovery copy, not a successful Save draft or a replacement for JSON export.

The Tavern large character preview is a registered visual spotlight target, for example `tavern-preview-garrick`. It outlines the artwork without adding a gameplay button. Pick the large sprite directly or select that ID in the live target library. `tavern-character-garrick` refers to the roster row. Interact with scene can stay off while picking; turning it on enables normal scene controls only inside disposable preview data.

## Pause at the start of a selected wave

Opening a Delve overview or battle directly prepares a disposable starter roster
and a valid party including Garrick, unless your current preview party is already
valid. This happens once per Studio refresh; later party edits remain yours.
Tavern previews still begin with normal recruitment until you visit a Delve.
This preview fixture does not spend gold, emit a player recruitment event, complete
tutorial objectives or change your real save. Refresh Studio to reset it.

Add a story point at **The Slime Cave** (or another regular Delve), then set
**Play when > Wave starts, after all enemies land** and choose **Wave number**.
Use separate story points for waves 1, 3 and 5, with as many dialogue lines as each
lesson needs. The wave number starts at 1 and is bounded by the selected Delve's
actual wave count. Use one enabled story point per wave.

This trigger waits for a real battle in that Delve. It includes queued enemy spawns
and every landing animation, then pauses before the next combat decisions. Finishing
the dialogue or choosing the external Exit control releases the pause that this lesson acquired.
A pre-existing player or tutorial pause remains owned by its original controller.
Wave lessons record story progress separately and do not complete gameplay mastery.
Scene Exit stays Immediate, and the pause policy is automatic for the whole point.
Completed points do not repeat on subsequent visits.

Studio previews run the actual battle from its normal entry rather than jumping to
the requested wave. Combat runs while the preview waits, even with Interact with
scene off. During **Preview sequence**, subsequent wave points at the same Delve
wait in the same battle; combat continues between their lessons. Refresh Studio
for a fresh disposable run if the desired wave has already passed. No waves or successful actions are
fabricated. Save draft keeps the setup; Apply to game enables it in normal play.

Wave 6 can use this setting to pause after the boss lands. Pausing when its first
ability starts winding up requires a separate trigger and is not this setting.

## Wait for a spotlight click instead of a dialogue tap

For a story dialogue line, choose **Advance when > Click spotlight item**, then use
**Pick spotlight target** to select the real control, such as **Manage Party**.
The footnote changes to a highlighted-control instruction. Dialogue taps do nothing;
a press and release on the highlighted control performs its normal action and
advances the line. Other controls stay blocked, and Exit Tutorial remains available.
If several controls are spotlighted, clicking any one advances. Decorative artwork,
missing controls and cancelled presses cannot advance the line.

This works in Studio with **Interact with scene** off and in the game after
**Apply to game**. Use a navigation control as the last line at its location, then
put the following dialogue in a story point for the destination, such as Party
Select after Manage Party. Choose **After previous** for that following story point
to continue the conversation there. A spotlight click records story progress only;
use **Hire Garrick for Free** when the completed hire confirmation is required.

The town party editor is available under **Add story point > Pineshire > Manage Party**.
It opens party selection in town mode, with Back returning to Heroes. It is also
available in an existing story point's Location selector as **Pineshire / Manage Party**.

## Wait for hiring instead of a dialogue tap

For Tavern story dialogue, **Advance when > Hire Garrick for Free** replaces the tap
footnote with a hire instruction. It highlights/enables Hire for Free while keeping
Exit Tutorial available. The usual Hire confirmation must succeed before advancing;
Cancel returns to the waiting line. Other Tavern actions stay blocked during this
line. The Garrick preview is selected for the request without recruiting him.
Existing saved ownership satisfies the requirement on resume. This observes normal
recruitment; it does not invent a hire event or award another hero.

Studio enables this line's required control even with Interact with scene off. Its
transaction affects disposable preview data only. Previewing the sequence again
recognizes an already hired Garrick; reloading the preview resets disposable data.
Save draft preserves the setting; Apply to game makes it part of published playback.
Exiting this recruitment step follows the existing recruitment-tutorial skip policy.
