# Current state

Updated 2026-09-30. Source and data should be checked before treating a feature below as complete.

## Working now

- Landscape Phaser game with world map, town and facility navigation, roster, leader tactics, shop, delve and party selection, battle, and victory/defeat summaries.
- Five-member party limits, role-based combat behavior, direct orders, abilities, enemy waves, boss finales, healing tonics, equipment, rewards and local saved progression.
- Four current map delves with difficulty-based waves. The Slime Cave uses layered static art plus a masked ambient loop; other delves use the shared battlefield presentation.
- Web production build and JavaScript test scripts. Android project is present for Capacitor sync and Gradle builds.

## In progress or awaiting review

- Another chat is producing and integrating character and monster sprites through PixelLab. Do not rename or reorganize its active files.
- Another chat is inspecting the Slime Cave Blender project and production camera. Do not alter its `.blend`, scene, camera, geometry or materials in documentation work.
- Physical Android playtesting is still needed for mobile layout, touch flow, combat readability and new ability balance. The Slime Cave layer alignment and ambient mask need an in-game visual review.
- Some town facilities remain placeholders; long-term roster traits, monetization and deeper world paths are plans rather than finished systems.

## Near-term priorities

Finish active sprite and Blender investigations, review their integrations in game, then address confirmed device and combat findings. See [Known issues](KNOWN_ISSUES.md) for tracked uncertainty rather than assuming old TODO entries are still bugs.
