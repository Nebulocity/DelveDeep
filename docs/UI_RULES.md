# Delve Deep – UI / UX Rules

## General

- Landscape-only interface.
- Designed primarily for Android phone use.
- UI should remain readable on a Google Pixel 9-sized display.
- All game text has intentionally been increased substantially from the original scale.
- Do not reintroduce tiny fonts.
- Touch targets should be large enough for fingers.
- Haptic feedback should be preserved on appropriate interactions.

## Top Banner

- The top banner should sit flush with the top of the game area.
- Avoid leaving an unnecessary visible gap above it.
- Respect Android safe areas / system UI as needed.

## Text

- Text should wrap inside panels.
- Instructional text must not overflow outside windows.
- Developer/testing warnings should wrap cleanly.
- Avoid clipping or placing labels partially off-screen.

## Character / Party UI

### Battlefield Characters

- Do not place the class label over the battlefield character.
- Do not place a mana bar above the battlefield character.
- Show each battlefield health bar above its character or monster sprite, with the name above the bar.
- Place cast bars 1px below battlefield health bars, clear of the sprites.
- Do not outline battlefield tiles for character abilities. Keep enemy area warnings visible.
- Keep character health information in the bottom party card as well.

### Bottom Party List

Each party member should show:

- Name.
- Class on a line below the name.
- Health bar.
- Mana bar when applicable.

Mana belongs in the bottom character / party UI, not floating over characters on the battlefield.

## Character Selection

- Adventurer cards must remain fully on-screen.
- No newly-added adventurer card should appear partially off-screen in the upper-left or elsewhere.
- Character selection sections may scroll when needed.
- First-time Party Select should begin empty.
- Later Party Select screens should default to the previously used party.

## Selection Behavior

- Informational selections support a 550 ms long-press or mouse hold-click.
- Show an instruction on each screen with inspectable selections.
- A hold opens details without also performing the normal tap action.
- Dragging away, releasing, leaving the game, or changing scenes cancels a pending hold.
- Combat pauses while selection details are open and restores its previous pause state on dismissal.

- Tapping a unit selects it.
- Tapping the currently selected unit again should toggle it off / deselect it.
- Tapping arbitrary battlefield space should not automatically cause the entire party to move unless that is the active command.
- The bottom status card for each party member is a generous individual
  selection target: tapping its portrait, name, or class selects that member.

## World Map

- Location icons should appear below location nameplates.
- Avoid overlapping map icons with labels.
- Remove obsolete descriptive labels such as the old road text if present.
- Keep location names readable against the background.
- Preserve the pixel-art visual direction.

## Persistent Messages

Instructional / action-required messages should remain visible until the player has completed the relevant action.

Do not automatically dismiss important guidance purely on a short timer.

## Dev Tools

Developer/testing UI should:

- Fit inside its panel.
- Wrap explanatory text.
- Clearly distinguish destructive actions.
- Support progress clearing.
- Support unlock-all / testing mode behavior.
- Arrange controls in labeled rows for Dev mode, leader levels (+1/+5), gold (+100/+500), battlefield grid lines (on/off), and progress reset, with a separate Close button.
- Never shade the battlefield floor. Hide the battlefield border with the grid lines while keeping tile interaction active. Save the grid preference with the profile and show grid lines for older saves without that preference.
- Replace the previous Dev Tools feedback toast when another action is tapped before it fades.
