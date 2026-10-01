# Delve Deep: editing character and enemy abilities

The active adventurer roster is in `data/adventurers.js`. Each roster entry selects a class from `data/classes.js`. Class abilities there use the `spell(name, cooldownSeconds, rangeInTiles, effect, extra)` helper. The helper converts cooldown seconds to milliseconds and supplies a default 300 ms windup. Keep the roster ID stable once saves use it; migrate old IDs in `game/GameStorage.js` when a rename is necessary.

`combat/ClassAbilitySystem.js` selects and resolves current adventurer abilities. It uses the battlefield grid for range, areas, targeting, and movement. `scenes/BattleScene.js` owns battle state, enemies, and the player command UI. `combat/BattleUnit.js` applies damage, healing, status effects, and death/revival rules. Character art is selected through `data/characterSprites.js`.

For example, Sturm's Oathwarden ability is declared as `sacrifice: spell('My Honor is My Life', 0, 0, 'sacrifice', { duration: 10000, damageBoost: 0.5, healingBoost: 0.5 })`. Its exact activation and effect are in `ClassAbilitySystem.canSacrifice` and `ClassAbilitySystem.sacrifice`. This ability needs Sturm and one other living ally in the final boss wave, restores the rest of the team, and prevents Sturm from reviving for the remainder of the encounter.

Enemy definitions, including statistics and ability timing, are in `data/enemies.js`. The Slime Cave's wave composition is in `data/encounters.js`; level art and floor placement are in `data/levels/SlimeCave.js`. Use `node tests/class-abilities.test.js` for character ability behavior and `node tests/battle-behavior.test.js` for battle decisions. Run `npm run build` after changing gameplay data. There is no `npm test` script.

Equipment catalog IDs in `data/items.js` are saved in player profiles. Some kit IDs retain historical names for save compatibility, even though the active character classes and abilities use the current names.
