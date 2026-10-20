# Skill unlock progression

The final assigned character levels are stored by current ability ID in `data/abilityUnlocks.js`, including one shared level for each generic skill. These values supersede the former provisional progression tables and old starter exceptions. Current class category permissions and generic exclusions still apply.

Every eligible ability is learned automatically at rank 1, for free, when the character reaches its assigned level. Loading a character derives all earned rank-1 skills from their current level while retaining higher trained ranks. Level-1 abilities form the initial equipped kit, up to the normal four slots; later earned abilities do not replace equipped choices. Scoundrel's innate Stealth remains outside the slot limit.

Rank upgrades remain manual and retain their SP/Gold costs and existing curves. Ranks 2-10 require the greater of the skill's assigned unlock level and `(rank - 1) * 5`. First learning costs no SP or Gold. Revival skills use their assigned level 10.

Skills below their unlock level are absent from skill lists and equipped-slot labels. Equip actions, combat readiness and triggered reactions enforce the same current gate. Learning a skill does not automatically equip it. Basic attacks, movement and Party Leader tactics remain ungated.

Barmaid's Tavern Brawl and Grovekeeper's Entangling Roots remain authored in the catalog with disabled flags. A central disabled-ID rule also prevents their use from saved encounter definitions. They cannot be learned, equipped, displayed or used, regardless of level. The plan's level-99 values do not enable them.

Arcanist's Lightweaving is Restore. Grovekeeper's Lifequake is Assault. Their effects and rank curves are unchanged. Grovekeeper is the current class identity corresponding to the user's Grovewarden reference; no alias was added.

Wave and boss XP carry the IDs learned in that payout. Visible combat shows `Learned a new ability!` in vibrant green below the existing level-up text. The message fades with that celebration and its labels are cleaned up on scene shutdown. Displayed events are acknowledged and saved, so the menu does not repeat them. Offline and historical replay still learn skills and retain pending notifications, then show a green `Learned a new ability!` message under `Level Up!` on the next supported menu screen. Existing saved higher ranks and battle slot choices are retained where still eligible.

Focused rule coverage is in `tests/ability-unlocks.test.js`: current level boundaries,
automatic free learning, manual rank training costs, unchanged battle slots, disabled
skills, AI/reaction restrictions, and pending-notice save/reload behavior. Focused browser
coverage in `tests/visual/audit/ability-unlocks.spec.js` checks hidden locked skills,
newly learned skill rendering, and batched menu notices without repetition. Active-combat
celebration timing and physical-device readability remain outside these focused checks.
