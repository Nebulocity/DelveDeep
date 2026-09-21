# Delve Deep Procedural World Assets - Grid Extraction Pass

This pass splits each supplied Midjourney sheet according to its repeated layout and removes
the sheet background to create individual transparent PNG sprites.

This intentionally favors extracting too many candidates rather than silently losing useful art.

## Workflow

1. Review each category folder.
2. Delete malformed assets, duplicates, partial objects, or cells containing multiple unwanted objects.
3. Keep the survivors as the curated world-art library.
4. The procedural generator should load only the curated set.

`manifest.json` records each sprite's source sheet and original grid position.

Background removal is automated and may leave a faint halo on some assets. Those can be cleaned
during the curation pass once we know which sprites are actually worth keeping.
