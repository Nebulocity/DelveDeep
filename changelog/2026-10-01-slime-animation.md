# Slime combat animation

- Advanced enemy sprite clips during battle so idle, attack, hit, and death sheets play in combat.
- Added a pronounced hop and squish to Cave and Elder Slimes, a slower pulse and sway to the Slime Sovereign, and action poses for attacks and hits.
- Added a shared monster death finish: brief flicker, fade, and pop. Wave cleanup waits for this finish before removing defeated enemies.
- Recorded the death rule in the asset pipeline for future monsters.
- Fixed reward handling so a defeated monster's container survives until its death animation finishes. Sprite updates now ignore destroyed containers.
