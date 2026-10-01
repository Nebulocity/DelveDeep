# Known issues and verification needs

- Slime Cave layer alignment, ambient mask edges and Android video playback need a game/device visual review after the current Blender inspection. This is an integration verification need, not a confirmed rendering defect.
- New class ability values and mobile combat layout need a physical-device balance and readability pass. Provisional tuning is recorded in [Class abilities](CLASS_ABILITIES.md).
- Ability tuning values appear in both `docs/COMBAT_SYSTEM.md` and `docs/CLASS_ABILITIES.md`. Keep those references aligned with `data/classes.js` when balancing.
- Some facilities are placeholders. Their existence is intentional pending future gameplay work.
- The Blender authoring file and source ambient movie are local, not in Git. Back them up separately.
- Character and enemy sprite completion is owned by the active PixelLab chat; check its current handoff before changing those assets.
