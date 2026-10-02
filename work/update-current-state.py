from pathlib import Path
path = Path('docs/CURRENT_STATE.md')
lines = path.read_text(encoding='utf-8-sig').splitlines()
for index, line in enumerate(lines):
    if line.startswith('Updated 2026-09-30.'):
        lines[index] = 'Updated 2026-10-01. Source and data should be checked before treating a feature below as complete.'
    elif line.startswith('- Another chat is producing and integrating character and monster sprites'):
        lines[index] = '- Character and Slime Cave monster sprites are integrated. Physical Android review of scale, alignment and animation remains pending.'
    elif line.startswith('Finish active sprite and Blender investigations'):
        lines[index] = 'Review the new sprite integrations and Blender environment in game, then address confirmed device and combat findings. See [Known issues](KNOWN_ISSUES.md) for tracked uncertainty rather than assuming old TODO entries are still bugs.'
lines.insert(next(i for i, line in enumerate(lines) if line.startswith('- Thornbriar Hollow has four bandit waves')), '- The Slime Cave now uses distinct Cave Slime, Elder Slime and Slime Sovereign PixelLab sheets for its weak, tough and final boss enemies.')
path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
