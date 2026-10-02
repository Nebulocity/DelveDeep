# Delve Deep – Combat System

## Combat Style

Combat is real-time and takes place in a compact 2D battle arena.

Adventurers move around the arena and perform class-appropriate actions automatically, while the player issues tactical commands as the Raid Leader.

The feel should be closer to classic action-RPG party battles than a static turn-based grid.

## Party Size

- 5 adventurers.
- Maximum 1 Tank.
- Maximum 2 Healers.
- Maximum 4 DPS.

## Automatic Combat

Characters should generally:

- Acquire appropriate targets.
- Move into appropriate range.
- Use class abilities.
- Perform attacks.
- Heal when appropriate.
- React to player tactical commands.

Tactical commands should override or strongly influence default behavior where appropriate.

## Wave Transitions and Movement

Adventurers and enemies move at 1.5 times their configured movement speed during combat. When a wave ends, living adventurers walk back to their initial positions at twice their combat movement speed. Their return paths ignore ally spacing so they do not oscillate around each other. After everyone arrives, the party remains in place for two seconds before the next wave countdown begins. Idle sprite animations continue during the wave announcement. The final wave also returns the party home before victory appears.

## Player Movement Commands

A known undesirable behavior is having every character move toward any battlefield click.

Correct behavior:

- Only the selected unit(s) or currently commanded role group should respond to movement commands.
- A manual move followed by Hold should keep the unit at the assigned location.

## Hold

Hold must meaningfully suppress automatic repositioning.

A held unit should not:

- Immediately run back into melee.
- Resume target-chasing movement without a reason.
- Ignore the player's assigned position.

Combat actions that can be performed from the held position may continue.

## Health Bars

Mob health bars should be visible.

Player-character health should be clearly readable through the intended character UI.

Avoid unnecessary duplicate bars that clutter the battlefield.

## Healing Tonics

Each party HUD portrait has a TONIC button for healing that character.
The shared inventory count appears above the party HUD. Manual use restores
35% maximum HP and requires a living, injured party member. It cannot spend
stock while paused, between waves, or after the encounter ends.

Tonics are only used when the player taps a button. Uses share a 1.5-second
cooldown and the same saved inventory. Between waves, living party members
below 50% HP recover to 50% HP without using tonics.
Holding a tonic button shows its rules without consuming a tonic.

## Mana

Mana should be displayed in the bottom party UI for characters who use mana.

Do not show mana bars above battlefield character sprites.

## Floating Combat Text

Floating combat text should announce meaningful combat events, including:

- Damage.
- Critical hits.
- Healing.
- Spell names.
- Ability names.
- Other notable ability usage.

Critical hits should be visually larger than ordinary floating combat text.

Ability / spell announcements should be readable without overwhelming the battlefield.

Ability announcements last 1,140 ms (50% longer than the previous 760 ms).
Damage and critical damage text retain their 760 ms and 1,050 ms durations.

## Equipped Leader Tactics

Up to five tactics appear in a centered row above the battlefield, with
separate rows for the title, guidance, wave status, and tactics heading.

- Focus Fire: choose a shared enemy target; healers keep healing.
- Rally: gather living allies at a chosen point and hold.
- Coordinated Assault: 20% more party damage for 8 seconds.
- Encouragement: restore 25% maximum health to living allies.
- Brace!: 30% less incoming damage for 8 seconds.
- Prepared Supplies: add one Healing Tonic, once per encounter.
- Arise!: revive every fallen ally at half maximum health and mana, once
  per encounter. Class cooldowns and once-per-delve usage remain spent.

Arise costs 2 TP to unlock; Focus Fire is free; other tactics cost 1 TP.
An equipped, unused Arise remains available after a full party wipe.
Using Arise with no fallen allies does not consume it.

## Scoundrels / Stealth

Scoundrels use Stealth on an eight-second cooldown only while no living monster
targets them. Stealth preserves threat but removes them from direct target
selection. Monster area attacks still affect them. Surprise Attack consumes
stealth, strikes from a free adjacent rear cell, and stuns for four seconds.
New stuns persist through damage. Poison halves attack speed for six seconds.

## Attack and Focus Fire

The right-hand order menu uses Attack. Selecting a character and tapping
an enemy also issues Attack without choosing the menu button. Attack
replaces that character's Move/Hold order and pursues the enemy into range.
Tapping a tile defaults to Move and then Hold at the destination.

Attack applies only to selected living characters. An explicitly commanded
healer attacks until that enemy dies or another movement order
replaces the attack. If any living ally falls below 80% health, the healer
pauses attacks and offensive abilities to heal, then resumes the order once
all living allies reach at least 80% health.

Focus Fire remains in the top leadership loadout and provides a shared
target priority. Individual Attack orders take precedence over that target.

Focus should direct DPS toward the designated enemy.

Healers should continue to prioritize healing rather than switching into inappropriate DPS behavior.

## Tank engagement and taunts

Each enemy starts unengaged. While a tank is alive, DPS wait for a tank
hit or taunt before attacking that enemy; area splash follows the same
rule. Healing generates threat only on engaged enemies. After engagement,
damage and healing generate their normal threat and can pull aggro.
Without a living tank, the remaining party fights normally.

New enemies prefer tanks when threat is tied. Ranged enemy abilities use
the threat target instead of automatically selecting ranged DPS.

Dawnwarden uses Challenge within four grid squares (10s cooldown) and
Defiant Stance on the three most distant living monsters across the arena
(15s cooldown). Both force targeting for six seconds, cancel queued attacks,
and establish engagement. Defiant Stance also makes ranged monsters approach.
Cooldowns persist across waves; a dead tank releases forced targeting.

See CLASS_ABILITIES.md for all new class rules and provisional balance choices.

## Spread / Stack

Combat positioning is shared by both armies through `combat/CombatMovement.js`.
Tuning lives in `config/combatSpacing.js`; distances are logical arena units
before perspective projection. Normal separation is 52, Stack is 28, and
Spread is 105. A soft, speed-limited separation pass includes living allies
and enemies together and resolves even exact overlaps. Fallen adventurers
remain solid obstacles for both armies, including during wave returns. Dead
monsters and inactive bodies do not participate.
Both approach and retreat steps pass through the same soft avoidance helper
before updating Phaser positions, so pursuit cannot overpower separation.

Melee attackers reserve one of six target-relative approach slots. Tank and
melee preferred radii are 52 and 65, capped by the attacker's actual reach.
Slots follow moving targets without changing sides every frame. Ranged units
settle in a 180–250 distance band; healers prefer 220–290, capped by reach.
Once settled, they stay put while their target remains within attack reach,
unless a nearby threat forces a retreat. Idle ranged units and healers face the
strongest living monster, with facing changes limited to once every 1.5 seconds;
they can retreat while facing it. Healers still prioritize
injured allies and Rogues retain their re-stealth retreat behavior.

Move assigns distinct destinations around the clicked location. Stack and
Spread assign tighter/wider destinations and hold there. Hold suppresses AI
pursuit; two overlapping held allies make small local corrections together
with their held anchors. Attack releases the selected units' formation and
restores normal personal spacing. Selection and target/threat rules are unchanged.

Enemy target names remain above enemy nameplates. Battlefield name/health
labels, ability windups, cast bars, and floating combat text remain; the
redundant basic "Attack" label is omitted.

Spread and Stack must be distinct tactical states.

### Spread

Units should increase separation.

### Stack

Units should intentionally group closely.

Do not implement both commands as minor variants of the same destination behavior.

## Interrupt

Interrupt should:

- Respect class capability.
- Require a valid interruptible cast.
- Avoid wasting interrupt abilities when no cast exists.
- Prefer sensible target selection.

## Dawnwarden Tank Direction

Sanctity Nova hits enemies within four squares and adds twice the total actual
damage as threat to each affected enemy. Sunbrand Strike hits an adjacent enemy.
The former Paladin self-heal and once-per-delve shield have been replaced.

## Extensibility Requirement

Spells and abilities should be easy for the developer to edit or expand.

Prefer centralized definitions that expose fields such as:

- Name.
- Class.
- Role.
- Cooldown.
- Mana cost.
- Range.
- Damage / healing.
- Target rules.
- Duration.
- Conditions.
- Floating combat text.
- AI priority.

Avoid scattering individual ability behavior across many unrelated files unless an ability genuinely requires custom logic.
