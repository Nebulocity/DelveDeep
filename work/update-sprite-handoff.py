from pathlib import Path
path = Path('SPRITE_CONTINUATION.md')
lines = path.read_text(encoding='utf-8-sig').splitlines()
for index, line in enumerate(lines[:20]):
    if line.startswith('- Mishakal is the active character.'):
        lines[index] = '- Mishakal is complete and pushed in commit `2c53824`. Her supplied art is `C:\\Users\\kenwh\\OneDrive\\Desktop\\DLChibi\\Mishakal.png`; all four facings and 24 clips are installed under `assets/characters/mishakal/reference-v2/`, and six sheets are in the runtime catalog.'
    elif line.startswith('- The Slime Cave references are now present'):
        lines[index] = '- The Slime Cave references are preserved under `assets/enemies/slime-cave/references/`. Cave Slime, Elder Slime, and Slime Sovereign each have six packed sheets under `assets/enemies/slime-cave/<id>/reference-v2/sheets/`. Final runtime verification and push are in progress.'
    elif line.startswith('- Another chat has uncommitted'):
        lines[index] = '- Another chat has uncommitted Thornbriar enemy assets and encounter changes; preserve them. Commit only this task\'s slime files and exact code changes, then push only to existing `0.1.2-3dSprites`.'
path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
