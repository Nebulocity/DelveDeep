# Dolmark Den enemy sprites

The three original creature references are preserved in `references/`. PixelLab
created the four diagonal facings for Den Warden, Den Protector, and Silvanark
the Forest Lord. The Warden and Protector use quadruped character generation;
PixelLab does not accept a supplied reference image for that character type, so
their designs were described from the supplied art. Silvanark was generated
directly from its supplied reference.

Each creature's `reference-v2/` folder contains authored rotations, source
frames, and six transparent sheets in `sheets/`. The sheets have 256 x 256 cells
and four rows in the order south-east, south-west, north-east, north-west.
States are idle, walk, attack, block, hit, and death. `sheets/layout.json` records
the frame counts. The source frames are reproducibly packed by running
`scripts/pack-dolmark-den.py` from the repository root with the bundled Python
environment and Pillow.

`pixellab-jobs.json` records the character IDs. The animation frames are
currently posed from the PixelLab directional sprites by the pack script.
`preview.png` shows one representative south-east frame from each state.
