# Current state

Updated 2026-10-03. Source and data should be checked before treating a feature below as complete.

## Working now

- Landscape Phaser game with world map, illustrated town and facility navigation, roster, leader tactics, shop, delve and party selection, battle, and victory/defeat summaries. Towns offer the Adventurer's Hall, Alchemist, Blacksmith, and Enchanter through gently swaying wooden signs; a lower Region Map sign returns to the map. Holding a sign opens its details.
- The Adventurer's Hall uses its supplied interior artwork across Adventurers, Items, and Tactics. The Alchemist, Blacksmith, and Enchanter use their supplied room art and facility-themed choice cards with distinct palettes and action icons, return flows, and detail pop-ups. Character sheets show stats and provide weapon, armor, accessory, and potion pack pickers. A baseline catalog defines six Common weapons and armor pieces, five materials, and two Common potion packs. The Alchemist sells three-use Health and Mana Potion packs for 60 Gold each and buys unequipped packs for a value based on remaining uses. Characters use their equipped packs during active combat to restore HP or mana. Owned materials persist and appear in the Items screen; encounters do not award catalog items yet. The Items and Quartermaster screens remain inventory and shop shells, while other facility choices show empty stock and recipe messages. Battle abilities have four slots. Each class has 10 or 11 abilities with ten ranks, three free starters, and skill point plus happiness-adjusted gold training. Tactics are grouped as Assault, Protect, Restore, and Prepare; Prepare currently has no tactic. The shared Healing Tonic and Prepared Supplies tactic have been removed.
- Five-member party limits, role-based combat behavior, direct orders, abilities, enemy waves, boss finales, gold and experience rewards, and local saved progression. Equipment slots persist for future items.
- Five current map delves. The Slime Cave, Thornbriar Hollow, and Dolmark Den are Easy with six authored waves each. The Murmuring Abyss displays Unknown and has six waves. The Vibrant Tear displays Unknown and has four authored waves. The Slime Cave uses chibi pixel-art cave scenery with foreground rock occlusion and localized ambience. Thornbriar Hollow uses a pixel-art forest bandit camp with foreground roots, flickering firelight, and drifting embers. Dolmark Den uses a pixel-art mountain den with foreground roots, animated rear waterfalls and pool surfaces, independently flickering lanterns and candles, and slow mushroom glows. The Murmuring Abyss uses a pixel-art Void Portal arena with animated violet lightning, witchfire, clouds, and portal motes. The Vibrant Tear uses a grassy wilderness knoll with a smaller, newer portal and restrained void effects.
- Battles use the same 6-row by 10-column tactical grid position and shape projected from The Slime Cave floor in every delve, with a wider logical arena. Each environment retains its own art, masks, and effects.
- Every wave selects clear grid squares away from characters, reserves upper-center squares for its strongest monsters, and drops monsters in with a short bounce. Combat sprites align their feet to the projected floor without ground circles.
- The Slime Cave now uses distinct Cave Slime, Elder Slime and Slime Sovereign PixelLab sheets for its weak, tough and final boss enemies.
- Slimes bob gently at idle and have visible attack and hit reactions. Monster deaths now flicker, fade, and pop after the death clip begins.
- After each nonfinal wave, living allies below 50% HP recover to 50%. Adventurers return home without steering around one another, and their idle animations continue during wave announcements.
- Thornbriar Hollow uses Lasher, Ruffian, Hedge Mage and Rongar the Crusher sprites in six waves, with independent dice rolls in the first five waves.
- Dolmark Den uses Den Warden, Den Protector, and Silvanark the Forest Lord sprites in six authored waves.
- Caramon now has four authored directional facings and six packed PixelLab animation sheets, registered under his stable `caramon-gladiator` roster ID.
- Web production build and JavaScript test scripts. Android project is present for Capacitor sync and Gradle builds.

## In progress or awaiting review

- Character and Slime Cave monster sprites are integrated. Physical Android review of scale, alignment and animation remains pending.
- Another chat is inspecting the retained Slime Cave Blender project and production camera. Do not alter its `.blend`, scene, camera, geometry or materials in documentation work.
- Physical Android playtesting is still needed for mobile layout, touch flow, combat readability and new ability balance. The Slime Cave, Thornbriar Hollow, Dolmark Den, The Murmuring Abyss, and The Vibrant Tear need on-device checks of floor alignment, near-edge occlusion, and pixel effect visibility.
- Some town facilities remain placeholders; long-term roster traits, monetization and deeper world paths are plans rather than finished systems.

## Near-term priorities

Review the new sprite integrations and pixel environment on a landscape phone, then address confirmed device and combat findings. See [Known issues](KNOWN_ISSUES.md) for tracked uncertainty rather than assuming old TODO entries are still bugs.
