# Class abilities — provisional September 2026 roster

The active catalog contains thirteen classes and exactly fourteen characters.
`data/classes.js` owns tuning; `combat/ClassAbilitySystem.js` handles grid ability
AI and effects. Old class names survive only as save/equipment aliases, not
selectable classes or ability kits.

## Squares and targeting

Ranges use visible grid cells, with diagonal adjacency counting as one square.
Same-cell targets are also in adjacent range. Movement remains continuous.
Zones select an in-range anchor cell; odd zones center on it, even zones extend
in the positive column/row direction and shift inward at arena edges. AI chooses
the zone covering the most eligible targets. Crimson Chorus is two columns by
three rows. A beam is one square wide and five squares long in normalized grid
space, aimed toward its target; it can also damage party members in its path.
Existing tank-engagement gating still applies to enemy splash damage.

Healers prioritize injured allies; an explicit Attack order prioritizes offense.
Focus Fire does not disable healing. Basic attacks remain available between
spell cooldowns; old healer basic Mend is replaced by the requested spells.
Hold permits casting but suppresses autonomous movement and escape teleports.

Veilstep uses a Move/Hold destination more than three cells away when ready.
Only living units occupy cells; blocked terrain also prevents teleporting.
An unavailable teleport falls back to ordinary movement. Automatic Veilstep
escapes adjacent enemies toward an empty cell with greater separation.
Bloodsong Ascendance grants one teleport of up to two cells during its eight
seconds; Move consumes it, or an unheld cleric uses it immediately to escape.

## Provisional values and interpretations

- Defiant Stance: **15s** cooldown. Challenge: 10s. Both force targeting for 6s.
- Damage: small 8, light 12, moderate 24, heavy/high 40. Sanctity Nova and
  Spireburst use 24 because their damage magnitude was unspecified.
- Healing: light 12, moderate 24, high 42. Bramble Mend uses moderate healing.
- New spells cost no mana because no mana costs were specified. Existing mana
  pools remain; each spell has a 300ms interruptible windup.
- Basic attacks retain existing crits. Spell healing/damage uses existing crits
  and mitigation. Positive attack/healing stat gains above class defaults also
  improve new spell powers, so equipment and leveling remain useful.
- Arcane Stabilization halves incoming damage for 5s. Its next damaging spell
  gains 25% damage across all affected targets, consuming the bonus once.
- Scripted Refuge lasts 15s: five ticks of 15 HP at three-second intervals.
  Its separate one-hit 50% shield lasts until consumed. Healing ticks cannot crit.
- Lumenspear's nearby allies are within one cell of its target. Radiant Touch
  chooses the lowest health percentage. Damage-linked healing uses actual
  HP lost, so overkill does not inflate healing; these heals do not roll a second critical. Libram uses the sum of damage
  dealt and heals every living ally by twice that sum.
- Sanctity Nova adds twice its total actual damage as threat to **each** hit
  monster, without also adding normal damage threat for those hits.
- Solar Aegis persists until the next single-ally heal, triples its base healing
  on both recipients, and consumes once. Self-targeting heals to full instead.
- Rootbound Refuge multiplies armor by four (+300%) for 8s. Clerics have 8%
  baseline armor. Total armor mitigation is capped at 90%.
- Thornlance roots movement for 4s without stunning or preventing attacks.
- Sanguine Transfer inflicts 12 self-damage through normal mitigation.
- Crimson Chorus grants one temporary HP per ally whose HP actually increases;
  it stacks and absorbs damage after mitigation until spent or the battle ends.
- Vessel Rend scales linearly from 12 at full HP toward 24 at zero HP.
- Damage types describe the spell; there is no elemental resistance system.

## Roster and saved data

Caramon: Gladiator; Sturm: Oathwarden; Laurana: Dawnwarden; Goldmoon: Verdant;
Mishakal: Everbright; Fistandantilus: Sanguine; Riverwind and Flint: Barbarian;
Tasslehoff: Scoundrel; Tika: Barmaid; Dalamar: Umbral; Palin: Luminous;
Raistlin: Crimson; Tanis: Ranger. Justarius is removed. Dalamar is a new entry.

Retained character IDs preserve progression. Removed characters leave the saved
party selection. Equipped gear for reassigned characters migrates to equivalent
class gear; item instance IDs remain unchanged. World progress is untouched.

Compact class labels appear in mobile cards and inventory headings. Full class
names remain in character details. New ability balance and mobile rendering
still need a physical-device playtest.

## Martial kit tuning (2026-09-29)

Gladiator, Scoundrel, Barbarian and Ranger now use the shared grid ability system.
Goldmoon uses Verdant Covenant; Mishakal uses Everbright.
Caramon is Gladiator; Tasslehoff is a Scoundrel; Tika is a Barmaid. Stable character IDs,
levels, XP and party selections remain. Equipped Caramon Dawnwarden items and
Goldmoon holy-cleric items migrate to equivalent new-class items; unequipped
inventory retains its class. Rogue item IDs remain valid for Scoundrels.

Provisional base powers: light 12, moderate 24, high 40, extreme 60. Poison deals
24 total over three two-second ticks, with a 50% attack-speed reduction for six
seconds. Hunter's Mark adds 25% damage taken; Hunter's Trap has a 15-second
cooldown. A ranger holds one active trap, replaced by another placement and
cleared between waves. These choices are configurable in data/classes.js.

Enrage replaces the old Barbarian passive bonuses/death escape: 3x outgoing and
2x incoming damage for ten seconds, followed by 0.5x outgoing damage for ten.
Stealth breaks on an attack, preserves threat, excludes direct enemy targeting,
and still receives area damage. Surprise Attack uses a free rear-adjacent cell.
Charge moves into a free adjacent cell. Hold suppresses those repositioning
attacks. Stuns interrupt pending actions and do not break on damage.

## Barmaid and Oathwarden

Barmaid: Frying Pan (8s, high, stun 4s), Clumsy Swing (15s, moderate, adjacent
AoE), Shield Bash (10s, moderate, stun 4s), Last Call (provisional 20s, high,
line up to 6 squares ending at the selected square, stun 4s).

Oathwarden: Solemn Vow (provisional 20s) protects another ally within 6 squares
with 5s total damage immunity and redirects all that ally's attackers for 10s.
Parry attempts on monster hits, with a 65% success chance and 2s cooldown per
attempt, independent of current casts but disabled while stunned. Success
prevents the hit and reflects its incoming damage without a second critical or
party assault multiplier. Staunch Defense (20s) taunts every enemy within 4
squares for 6s and reduces incoming damage by 75% for those six seconds.

My Honor is My Life triggers only on the final boss wave while the Oathwarden
and exactly one other ally survive, and at least one ally is dead. It bypasses
all defenses to sacrifice the caster, restores every other ally to full HP/mana,
and grants DPS +50% damage and healers +50% healing for 10s. The caster cannot
be revived for the rest of that encounter. These buffs are separate from
other class/tactic buffs. Normal world progression and currencies are preserved.
