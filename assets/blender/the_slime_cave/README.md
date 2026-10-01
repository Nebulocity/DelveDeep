# Slime Cave authoring source

Current local project: `assets/blender/the_slime_cave/the_slime_cave_game_export_v1.blend`.
Continue editing this file. Its images are packed and it has no linked libraries.
The production camera is `CAM_SlimeCave_Game`; preserve its framing and DOF.
`Scene` is the approved full scene; `DD_Export` contains the four export view layers.

The large Blender binary and source ambient animation are intentionally **not stored in Git**. Keep a separate
backup of the current `.blend`: cloning GitHub alone does not restore the authoring file.
The Blender file has packed images and no linked libraries; its imported model and texture source files are unnecessary for rendering the current scene.

Git tracks the small export helper and final assets used by Phaser under
`assets/environments/slime-cave/`, plus the level and renderer JavaScript. Raw imported
GLBs, reference art and generated `dist` bundles are ignored.

To regenerate the three static layers from the current source, run from project root:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --factory-startup -b assets/blender/the_slime_cave/the_slime_cave_game_export_v1.blend --python assets/blender/the_slime_cave/export_phaser_stills.py
```

The helper renders one frame per static layer and does not save changes to the source.
The current runtime ambient loop is masked to pool neighborhoods and comes from the
retained `ambient_source_240frames.mp4` (24 fps, 240 frames), cropped at y=540 to 1920x540.
This preserves the complete existing loop without a new animation render. A future
RGBA/atlas export can replace it independently of characters and UI.
