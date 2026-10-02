"""Losslessly pack original PixelLab frames; never resize, repaint, or quantize."""
import json
import sys
from pathlib import Path
from PIL import Image

DIRECTIONS = ['south-east', 'south-west', 'north-east', 'north-west']
STATES = ['idle', 'walk', 'attack', 'block', 'hit', 'death']
NAMES = [
    'laurana', 'tika', 'tanis', 'sturm', 'goldmoon', 'caramon-gladiator',
    'raistlin', 'dalamar', 'palin', 'tasslehoff', 'flint', 'riverwind', 'fistandantilus', 'mishakal',
]
selected_names = sys.argv[1:] or NAMES
if any(name not in NAMES for name in selected_names):
    raise ValueError(f'Unknown character name; choose from {NAMES}')
for name in selected_names:
    root = Path('assets/characters') / name / 'reference-v2'
    sheets = root / 'sheets'
    sheets.mkdir(exist_ok=True)
    manifest = {'frameWidth': 256, 'frameHeight': 256, 'directions': DIRECTIONS, 'states': {}}
    for state in STATES:
        rows = []
        for direction in DIRECTIONS:
            files = sorted((root / state / direction).glob('frame-*.png'), key=lambda p: int(p.stem.split('-')[-1]))
            if state in ['idle', 'walk']:
                files = files[:-1]  # Closing reference frame is excluded from playback.
            if len(files) < 4:
                raise ValueError(f'Incomplete clip: {name}/{state}/{direction}')
            rows.append(files)
        columns = max(map(len, rows))
        sheet = Image.new('RGBA', (256 * columns, 256 * len(rows)))
        for row, files in enumerate(rows):
            frame_signatures = set()
            for column, file in enumerate(files):
                with Image.open(file) as frame:
                    if frame.size != (256, 256) or frame.mode != 'RGBA':
                        raise ValueError(f'Unexpected source format: {file}')
                    if not frame.getchannel('A').getbbox():
                        raise ValueError(f'Blank animation frame: {file}')
                    frame_signatures.add(hash(frame.tobytes()))
                    sheet.paste(frame, (column * 256, row * 256))
            if len(frame_signatures) < 2:
                raise ValueError(f'Animation has no movement: {name}/{state}/{DIRECTIONS[row]}')
        sheet.save(sheets / f'{state}.png')
        manifest['states'][state] = {'columns': columns, 'counts': dict(zip(DIRECTIONS, map(len, rows)))}
    (sheets / 'layout.json').write_text(json.dumps(manifest, indent=2))
    print(f'Packed {name}: six transparent sprite sheets.')
