"""Pack accepted PixelLab frames for the four Thornbriar Hollow bandits."""

import json
import sys
from pathlib import Path

from PIL import Image


ROOT = Path('assets/enemies/thornbriar-hollow')
NAMES = ('lasher', 'ruffian', 'hedgeMage', 'rongarTheCrusher')
DIRECTIONS = ('south-east', 'south-west', 'north-east', 'north-west')
STATES = ('idle', 'walk', 'attack', 'block', 'hit', 'death')


def pack(name):
    source = ROOT / name / 'reference-v2'
    output = source / 'sheets'
    output.mkdir(parents=True, exist_ok=True)
    layout = {
        'frameWidth': 256,
        'frameHeight': 256,
        'directions': DIRECTIONS,
        'states': {},
    }
    for state in STATES:
        rows = []
        for direction in DIRECTIONS:
            folder = source / state / direction
            frames = sorted(folder.glob('frame-*.png'), key=lambda path: int(path.stem[6:]))
            if state in ('idle', 'walk'):
                frames = frames[:-1]
            if len(frames) < 4:
                raise ValueError(f'Incomplete clip: {name}/{state}/{direction}')
            rows.append(frames)
        columns = max(map(len, rows))
        sheet = Image.new('RGBA', (256 * columns, 256 * len(rows)))
        for row, frames in enumerate(rows):
            signatures = set()
            for column, file in enumerate(frames):
                with Image.open(file) as frame:
                    if frame.size != (256, 256) or frame.mode != 'RGBA':
                        raise ValueError(f'Unexpected frame format: {file}')
                    if not frame.getchannel('A').getbbox():
                        raise ValueError(f'Blank frame: {file}')
                    signatures.add(hash(frame.tobytes()))
                    sheet.paste(frame, (column * 256, row * 256))
            if len(signatures) < 2:
                raise ValueError(f'No motion: {name}/{state}/{DIRECTIONS[row]}')
        sheet.save(output / f'{state}.png')
        layout['states'][state] = {
            'columns': columns,
            'counts': dict(zip(DIRECTIONS, map(len, rows))),
        }
    (output / 'layout.json').write_text(json.dumps(layout, indent=2))
    print(f'Packed {name}: six sheets')


selected = sys.argv[1:] or NAMES
if any(name not in NAMES for name in selected):
    raise ValueError(f'Choose from {NAMES}')
for name in selected:
    pack(name)
