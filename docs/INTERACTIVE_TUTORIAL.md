# Interactive tutorial runtime

The opening is `pineshire-first-adventure` in `game/OpeningTutorial.js`, using the
existing authority-based `TutorialController`. Curriculum version **2** has 22 primary
states, with Move/Attack conditional on a real ordinary warning and actionable combat:

```
welcome (Pineshire) → town-tavern → hire-garrick
→ prepare-heroes → party-fill → party-save → ready-map → slime-select
→ slime-travel → slime-depart → battle-hud → battle-select
→ [battle-move → battle-attack] → first-find → camp → boss-interrupt
→ victory → return-select → return-travel → town-rewards → complete
```

Recruitment precedes party preparation. Back to Town, Heroes, Manage Party, the real
Save and road travel remain actual controls and scene handoffs. The join and return
objectives span those controls without teleporting or fabricating scene entry.
Only welcome and the brief combat-autonomy explanation require a dialogue tap. Initial
selection shares its teaching pause with autonomy. Move/Attack practice requires an
actual arrival and executed Attack; absent warnings, blocked movement and safely
finished encounters record `deferred:` reasons instead of mastery.

First-clear settlement retains its existing economy and exactly-once guards. The
receipt now includes the real inventory instance ID. Tutorial observation metadata
(`find` / `finds`) is saved with that same settlement; it does not award another item.
The existing wave reward renderer shows the real name and rarity during the normal
return/rest interval. First-find never pauses combat or requires Continue. A separate
`presented:` marker records display availability, not comprehension or equipment use.

At actual camp, Leave/Farm/Face Boss stay available. Face Boss acknowledges readiness.
The first legal live boss cast offers ACTION → Interrupt → casting enemy. Only
`combat.interrupt.succeeded` in the current attempt and encounter earns mastery.
Warnings temporarily authorize defensive selection, Move and live Interrupt controls.
When a queued successful action removes its target, ambient presentation retains its
current observation scope until the deferred gameplay fact arrives. Missing targets
on action steps still suspend and revoke input safely. A genuine win before practice
records deferral and retains the ordinary Victory/Reward scene.

Actual Town return completes guidance automatically. The nonblocking Finds / Equipment
entry offers an optional comparison of an owned, unequipped earned copy that passes
current class, level and slot rules. Compatibility is not an upgrade claim. Compare
selects the eligible hero and opens the real Equipment screen; that screen owns Equip.
Declining, already-equipped copies and no compatible find cannot block completion.

The existing `?` / Tutorial entry opens a small help selector:

- Opening / Resume explicitly starts or resumes the main guidance. A new opening is
  refused during an unrelated active expedition.
- Role groups uses actual SELECT → Melee evidence in an ordinary encounter.
- Leader Tap uses one reachable ordinary enemy and actual positive resolved damage.
  Target replacement, empty presses, throttling and zero damage are not mastery.
- Formations explains Spread, Stack and Hold. Command practice/mastery is deferred.
- Tactics / Renown is chosen from the actual Tactics scene and completes on the real
  Restore category event, with no purchase. Back or Exit does not reopen the opening.

Optional modules use separate `help-*` lesson IDs and the same controller/scopes.
They own only their current scene/session, exit on scene changes or boss entry, and
never start practice encounters. A bounded `openingRecord` retains primary evidence
while optional modules own the current lesson. Explanation is distinct from practice.

Tutorial progress schema version remains 1; curriculum version is 2. Unsupported
curriculum saves retain gameplay and offer a deliberate guidance-only restart, without
old-ID mappings. Save transfer accepts unsupported guidance only for that discard and
restart path; supported current-version attempts retain checkpoint and attempt IDs.
Ownership and journaled party facts reconcile without repeating transactions. Optional
resume routes use real map/Town controls; they never manufacture scene-entry evidence.

Only tutorial-owned pauses are released. Saved `pauseOwnedEncounter` restores that
ownership after reload; pause events distinguish the tutorial from player changes.
Exit disposes presentation, input leases and listeners while preserving committed
navigation, earned items, currency, ownership and party saves. Failed tutorial writes
retain the prior checkpoint and expose retry/Exit. Historical replay does not earn
new mastery or first-clear rewards.

Presentation retains the charcoal-and-gold interface and the top banner. Live combat
HUD, radials, cards, casts and warnings are placement exclusions. Inspection suppresses
the guide body/dimmer and reserves the whole dialog while keeping Exit accessible.
Party guidance also excludes the full lineup. Narrative messages show Tap to advance; action lessons show the required action
and cannot be advanced by tapping the message. Scoped role-list wheel/drag routing and radial drag authority remain intact.

## Guidance API

Import `tutorialGuidance(game)` from `game/TutorialGuidance.js`. This returns one service
per Phaser game and reuses the accepted `TutorialController` and gameplay stream.
Register definitions before restoring their scenes. For additional optional lessons, call begin only for explicit opt-in:

```js
const guide = tutorialGuidance(scene.game);
guide.define('example', {
  firstCheckpoint: 'visit',
  checkpoints: {
    visit: {
      targetId: 'town-tavern',
      instruction: 'Open the Tavern.',
      allowedInteractions: [],
      evidence: { type: 'scene.entered', source: 'system', sceneId: 'TavernScene' }
    }
  }
});
const result = guide.begin('example', scene);
```

This example is not activated by production. `guide.controller` retains its captured-token
lifecycle API. Resume/retry must succeed before `guide.refresh()` rebinds presentation.
Unknown definitions or missing targets fail closed with Exit available.

## Target registration

The scene plugin installs before create. Interactive objects register automatically by
their existing name; later setName calls are recognized. Descriptors retain the actual
object/emitter receiver. Existing handlers continue to perform the authoritative action.
Rebuilt controls receive fresh registration generations.

```js
const remove = guide.register(scene, 'roster-scroll', {
  receiver: rosterController,
  bounds: () => liveCanvasBounds,
  kinds: ['gesture', 'wheel'],
  handlers: { pointerdown: startDrag, pointermove: moveDrag, pointerup: endDrag, wheel: scroll },
  available: () => rosterController.enabled
});
```

Include support IDs in allowedInteractions. Include them in missingInteractions when
scrolling must bring an absent primary target into view. Object-specific descriptors can
supply object, receiver, camera: () => camera, bounds: camera => canvasBounds,
clip: () => canvasClip, available and handlers. Bounds/clip providers return current
logical canvas rectangles before CSS/FIT scaling. The default object resolver projects
transformed world bounds through its camera, including viewport, zoom, rotation and
container scroll factors. It checks object/ancestor visibility, camera filters, enabled
state and tutorialEnabled. Unknown masks fail closed. Masked UI producers expose
actual tutorialClipBounds in canvas coordinates. Hall and Party Select supply their
existing rectangular clips and supporting scroll handlers.

Destroy/shutdown unregister automatically; remove() is idempotent. Cached projected
geometry is reused when measurements match. Inactive guidance does not poll geometry.
The overlay redraws only on layout changes. Missing targets revoke their old scope and
permissions; reacquisition needs a fresh scope. Checkpoint and attempt remain intact.
Disappearance never completes or skips a step.

## Input, presentation and priority

The gate checks object and scene input dispatch, hit order and keyboard dispatch.
Only the active target, authored supporting interactions, Exit and priority exceptions
may act. Press leases require pointer identity, timestamp and current presentation
revision. Gesture leases also require the original registration generation. Raw scene
input is suppressed; only explicitly registered supporting handlers are dispatched.
A scroll region does not authorize unrelated scene listeners. Tavern selection/hire,
Party Save, radial choices and delayed held details also check their action boundary.
DOM keyboard capture covers Key-object bypasses. Escape uses the Exit dispatcher.
There is no native Back bridge in this batch; a future bridge must call guide.exit().

TutorialOverlayScene renders through an independent screen-space camera above world/HUD
cameras. Charcoal strips create one or more true clear holes with restrained gold edging.
Instructions use existing typography. Placement avoids the target, supporting regions,
Exit and viewport edges; instructions are withheld when no placement fits. Exit and Continue stay attached to each rendered message. When presentation is suspended, Exit chooses
among safe corners. Suspended guidance hides artwork but retains Exit. The presenter does not change combat time scaling, warning geometry or art dependencies;
the opening curriculum owns only its explicit tactical pauses described above.

Priority is critical boss warning, tutorial-owned confirmation, guidance, ordinary
ability notice. Real boss telegraphs provide warnings; overlapping and restored warnings
retain defensive grants until all live warnings end. The movement-warning exception
permits Select/Action radials, role choices, Move and the arena destination. Arena taps
require MOVE; attacks, spending, unrelated tactics and navigation stay blocked. AI
avoidance provides no manual evidence. Existing warning effects retain combat-clock timing.
The allowed Tavern hire opens a tutorialOwned confirmation. Only confirm/cancel receivers
are granted, and callbacks validate their captured scope. Other modals gain no implicit
permission. Ability notices stay pending until truly rendered without guidance obscuring them.

## Exit, Skip and Replay

`guide.exit(skip = false)` dispatches through game/TutorialOwner.js.

- Generic Exit pauses; generic Skip marks skipped. Both retain earned recruits, items,
  Gold, XP, legal saved parties and world progress.
- Recruitment Exit follows the established Skip policy and canonical transaction:
  free Garrick is granted once if needed. Generic exit alone never replaces this grant.
  Existing recruitment cancel/dismiss paths and Tavern Exit use the same dispatcher.
- Recruitment Replay uses the existing begin transaction. Owned Garrick remains owned
  and replay begins at party preparation. Generic deliberate begin makes a new attempt;
  resume preserves the saved attempt. These operations grant no rewards.

Exit invalidates presentation before persistence. A failed tutorial write cannot undo
committed gameplay. Failed Exit retains an available Exit for retry. No extra Exit
confirmation is required.

## Noncombat evidence and recovery

| Event | Successful authoritative boundary |
| --- | --- |
| scene.entered | Scene CREATE after the destination becomes active; system source. Navigation retains original tutorial/runtime authority. Readiness deduplicates within a scene session. |
| selection.changed | Accepted Tavern, shared character-selector or party selection; player source with resulting IDs and selection kind. |
| adventurer.recruited | Canonical recruitment after ownership/gear/cost persist; player source for scene hire, system for automatic skip. |
| party.saved | Party Select after legal lineup and recruitment completion persist; player source and resulting member IDs. Existing incomplete legal saves remain supported. |

These extend the existing immutable envelope, epoch/serial identity and attempt/authority
stamps. Noncombat events have null encounter/wave/combat-clock fields. Recruitment/party
facts have phase: committed and a bounded 16-fact journal persisted in the SAME write as
the gameplay transaction. Failed transactions publish no success. The controller checks
that journal, authored source/scene/character/member predicates and exact durable authority.

controller.reconcileFacts(scope.token) recovers committed evidence after reload or a
checkpoint-write failure. Only the transient observation watermark/session are reconstructed;
original source and durable lesson authority must match. Old attempts cannot borrow facts.
Recovery never repeats gameplay transactions or rewards. Persistent save failure suspends
automatic recovery until re-entry/foreground, avoiding write loops. No legacy development
save migrations are included.

Shutdown/destroy, background/blur, profile replacement and controller transitions dispose
scopes. Readiness/foreground acquire fresh authority. Scene shutdown restores input wrappers
and removes registrations. Presentation objects and rectangles are never saved. Rendered
camera/modal layering and native Android Back/background/touch remain explicit integration
checks; module fixtures alone do not certify them.

## Location-based story authoring

Studio stores independent `storyPoints` in the presentation document. Points select
registered locations from `data/storyLocations.js`, use ordered dialogue lines and
choose intro, scene-entry or after-previous triggers. Chronological and location
sections reference the same points. Scene exits support 0, 500, 1000 and 1500 ms.
`game/StoryDirector.js` plays published stories with the shared dialogue overlay,
using separate profile-local story completion/current-line state. Story dialogue
cannot complete tutorial checkpoints or grant gameplay resources. Intro completion
or exit routes into Pineshire; fresh tutorials now start there. Apply to game is an
explicit local write of the presentation document; Save draft remains independent.
See `TUTORIAL_STUDIO_USER_GUIDE.md` for authoring behavior. Runtime and visual
changes in this update have not been validated.
