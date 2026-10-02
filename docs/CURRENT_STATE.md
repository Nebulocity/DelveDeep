# Current state

Updated 2026-10-02. Source and data should be checked before treating a feature below as complete.

## Working now

- Landscape Phaser game with world map, illustrated town and facility navigation, roster, leader tactics, shop, delve and party selection, battle, and victory/defeat summaries. Towns offer the Adventurer's Hall, Alchemist, Blacksmith, and Enchanter.
- The Adventurer's Hall uses its supplied interior artwork across Adventurers, Items, and Tactics. Character sheets show stats and provide weapon and armor pickers. Battle abilities have four slots; Train is reserved for future work. Tactics are grouped as Assault, Protect, Restore, and Prepare.
- Five-member party limits, role-based combat behavior, direct orders, abilities, enemy waves, boss finales, healing tonics, equipment, rewards and local saved progression.
- Four current map delves. The Slime Cave, Thornbriar Hollow, and Dolmark Den are Easy with six authored waves each. The Murmuring Abyss displays Unknown and currently has six waves. The Slime Cave uses layered static art plus a masked ambient loop; other delves use the shared battlefield presentation.
- Battles use a centered 6-row by 10-column tactical grid with a wider logical arena; Slime Cave floor bounds follow its environment art.
- Every wave selects clear grid squares away from characters, reserves upper-center squares for its strongest monsters, and drops monsters in with a short bounce. Combat sprites align their feet to the projected floor without ground circles.
- The Slime Cave now uses distinct Cave Slime, Elder Slime and Slime Sovereign PixelLab sheets for its weak, tough and final boss enemies.
- Slimes bob gently at idle and have visible attack and hit reactions. Monster deaths now flicker, fade, and pop after the death clip begins.
- After each nonfinal wave, living allies below 50% HP recover to 50%. Healing Tonics are used only on player command. Adventurers return home without steering around one another, and their idle animations continue during wave announcements.
- Thornbriar Hollow uses Lasher, Ruffian, Hedge Mage and Rongar the Crusher sprites in six waves, with independent dice rolls in the first five waves.
- Dolmark Den uses Den Warden, Den Protector, and Silvanark the Forest Lord sprites in six authored waves.
- Caramon now has four authored directional facings and six packed PixelLab animation sheets, registered under his stable `caramon-gladiator` roster ID.
- Web production build and JavaScript test scripts. Android project is present for Capacitor sync and Gradle builds.

## In progress or awaiting review

- Character and Slime Cave monster sprites are integrated. Physical Android review of scale, alignment and animation remains pending.
- Another chat is inspecting the Slime Cave Blender project and production camera. Do not alter its `.blend`, scene, camera, geometry or materials in documentation work.
- Physical Android playtesting is still needed for mobile layout, touch flow, combat readability and new ability balance. The Slime Cave layer alignment and ambient mask need an in-game visual review.
- Some town facilities remain placeholders; long-term roster traits, monetization and deeper world paths are plans rather than finished systems.

## Near-term priorities

Review the new sprite integrations and Blender environment in game, then address confirmed device and combat findings. See [Known issues](KNOWN_ISSUES.md) for tracked uncertainty rather than assuming old TODO entries are still bugs.
