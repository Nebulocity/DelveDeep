# Dolmark Den battlefield environment

- Added a 1672 x 941 pixel-art mountain den battlefield with an open combat floor, stone arch, roots, lanterns, and fungi.
- Moved Dolmark Den's existing map and progression definition into `data/levels/DolmarkDen.js` without changing its persistent ID, unlocks, drops, or six authored waves.
- Added projected floor bounds, foreground root occlusion, and subtle lantern and fungal glow effects. Effects pause with combat and clean up when the scene closes.
- Added an environment and progression test for the new scene.
