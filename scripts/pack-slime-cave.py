import json
import sys
import zipfile
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path('assets/enemies/slime-cave')
DIRECTIONS = ('south-east', 'south-west', 'north-east', 'north-west')
STATES = ('idle', 'walk', 'attack', 'block', 'hit', 'death')
CELL = 192
BASELINE = 184


def source_folder(archive, prefix):
    folders = {name.split('/')[1] for name in archive.namelist() if name.startswith('animations/')}
    matches = [folder for folder in folders if folder.startswith(prefix)]
    if len(matches) != 1:
        raise ValueError(f'Expected one animation folder for {prefix}: {matches}')
    return matches[0]


def place(frame):
    if frame.mode != 'RGBA' or max(frame.size) > CELL or not frame.getchannel('A').getbbox():
        raise ValueError(f'Invalid PixelLab frame: {frame.mode}, {frame.size}')
    canvas = Image.new('RGBA', (CELL, CELL))
    canvas.alpha_composite(frame, ((CELL - frame.width) // 2, BASELINE - frame.height))
    return canvas


def pack(name, archive_path):
    root = ROOT / name / 'reference-v2'
    source = json.loads((root / 'source.json').read_text(encoding='utf-8-sig'))
    layout = {'frameWidth': CELL, 'frameHeight': CELL, 'directions': DIRECTIONS, 'states': {}}
    with zipfile.ZipFile(archive_path) as archive:
        for direction in DIRECTIONS:
            target = root / 'rotations' / f'{direction}.png'
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(f'rotations/{direction}.png'))
        sheets = root / 'sheets'
        sheets.mkdir(parents=True, exist_ok=True)
        for state in STATES:
            rows = []
            for direction in DIRECTIONS:
                prefix = source.get('animationFoldersByDirection', {}).get(state, {}).get(direction, source['animationFolders'][state])
                folder = source_folder(archive, prefix)
                names = sorted(n for n in archive.namelist() if n.startswith(f'animations/{folder}/{direction}/') and n.endswith('.png'))
                if len(names) not in (5, 9):
                    raise ValueError(f'Incomplete {name}/{state}/{direction}: {len(names)} frames')
                frames = []
                for index, path in enumerate(names):
                    data = archive.read(path)
                    target = root / state / direction / f'frame-{index}.png'
                    target.parent.mkdir(parents=True, exist_ok=True)
                    frame = Image.open(BytesIO(data)).convert('RGBA')
                    color_hexes = source.get('removeColors', {}).get(state, {}).get(direction, [])
                    if color_hexes and index:
                        colors = {tuple(bytes.fromhex(value)) for value in color_hexes}
                        frame.putdata([(r, g, b, 0 if (r, g, b) in colors else a) for r, g, b, a in frame.getdata()])
                        frame.save(target)
                    else:
                        target.write_bytes(data)
                    frames.append(place(frame))
                selection = source.get('frameSelections', {}).get(state, {}).get(direction)
                if selection is not None:
                    frames = [frames[index] for index in selection]
                elif state in ('idle', 'walk'):
                    frames.pop()
                if len({frame.tobytes() for frame in frames}) < 2:
                    raise ValueError(f'No visible motion in {name}/{state}/{direction}')
                rows.append(frames)
            columns = max(len(row) for row in rows)
            sheet = Image.new('RGBA', (CELL * columns, CELL * len(DIRECTIONS)))
            for row_index, frames in enumerate(rows):
                for column, frame in enumerate(frames):
                    sheet.alpha_composite(frame, (column * CELL, row_index * CELL))
            sheet.save(sheets / f'{state}.png')
            layout['states'][state] = {'columns': columns, 'counts': dict(zip(DIRECTIONS, map(len, rows)))}
        (sheets / 'layout.json').write_text(json.dumps(layout, indent=2), encoding='utf-8')
    print(f'Packed {name}: six sheets and source frames')


if __name__ == '__main__':
    pack(sys.argv[1], Path(sys.argv[2]))
