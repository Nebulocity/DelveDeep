"""Pack Dolmark Den's PixelLab rotations into four-facing battle animation sheets."""

import json
from pathlib import Path

from PIL import Image, ImageEnhance


ROOT = Path('assets/enemies/dolmark-den')
NAMES = ('denWarden', 'denProtector', 'silvanarkTheForestLord')
DIRECTIONS = ('south-east', 'south-west', 'north-east', 'north-west')
COUNTS = {'idle': 4, 'walk': 8, 'attack': 8, 'block': 4, 'hit': 4, 'death': 8}
CELL = 256


def shift(image, x=0, y=0):
    canvas = Image.new('RGBA', (CELL, CELL))
    canvas.alpha_composite(image, (x, y))
    return canvas


def brighten(image, factor):
    changed = ImageEnhance.Brightness(image.convert('RGB')).enhance(factor).convert('RGBA')
    changed.putalpha(image.getchannel('A'))
    return changed


def frame_for(base, state, index, direction, name):
    forward = 1 if direction.endswith('east') else -1
    if state == 'idle':
        return shift(brighten(base, (1, 1.03, 1.05, 1.02)[index]), 0, (0, -1, -2, -1)[index])
    if state == 'walk':
        stride = (0, 2, 4, 2, 0, -2, -4, -2)[index]
        return shift(base, forward * stride, (0, -3, -5, -3, 0, -3, -5, -3)[index])
    if state == 'attack':
        thrust = (0, -3, 1, 7, 12, 8, 3, 0)[index]
        posed = base.rotate((0, 0, -3, -6, -8, -4, 0, 0)[index] * forward,
                           Image.Resampling.NEAREST, center=(128, 238), expand=False)
        return shift(brighten(posed, 1.08 if index in (3, 4) else 1), forward * thrust,
                     (0, 0, -2, -4, -3, -2, 0, 0)[index])
    if state == 'block':
        return shift(brighten(base, (1, 0.85, 0.8, 1)[index]),
                     -forward * (0, 2, 3, 0)[index], (0, 2, 3, 0)[index])
    if state == 'hit':
        posed = base.rotate((0, 5, 9, 2)[index] * forward,
                           Image.Resampling.NEAREST, center=(128, 238), expand=False)
        return shift(brighten(posed, (1, 1.65, 1.25, 1)[index]),
                     -forward * (0, 4, 8, 2)[index], (0, -2, -3, 0)[index])
    angle = (0, 6, 16, 30, 45, 65, 78, 82)[index] * forward
    pivot_y = 250 if name == 'silvanarkTheForestLord' else 238
    posed = base.rotate(angle, Image.Resampling.NEAREST, center=(128, pivot_y), expand=True)
    posed = posed.crop(posed.getchannel('A').getbbox())
    if posed.width > 238 or posed.height > 238:
        factor = min(238 / posed.width, 238 / posed.height)
        posed = posed.resize((round(posed.width * factor), round(posed.height * factor)),
                            Image.Resampling.NEAREST)
    posed = brighten(posed, (1, 0.97, 0.93, 0.87, 0.8, 0.73, 0.68, 0.68)[index])
    frame = Image.new('RGBA', (CELL, CELL))
    foot = 256 if name == 'silvanarkTheForestLord' else 238
    frame.alpha_composite(posed, ((CELL - posed.width) // 2, foot - posed.height))
    return frame


def pack(name):
    source = ROOT / name / 'rotations'
    output = ROOT / name / 'reference-v2'
    rotation_output = output / 'rotations'
    rotation_output.mkdir(parents=True, exist_ok=True)
    sheets = output / 'sheets'
    sheets.mkdir(parents=True, exist_ok=True)
    bases = {}
    for direction in DIRECTIONS:
        with Image.open(source / f'{direction}.png') as image:
            sprite = image.convert('RGBA')
        if sprite.width > CELL or sprite.height > CELL:
            raise ValueError(f'Rotation too large: {name}/{direction}')
        sprite.save(rotation_output / f'{direction}.png')
        base = Image.new('RGBA', (CELL, CELL))
        bbox = sprite.getchannel('A').getbbox()
        foot = 256 if name == 'silvanarkTheForestLord' else 238
        base.alpha_composite(sprite, ((CELL - sprite.width) // 2, foot - bbox[3]))
        bases[direction] = base
    layout = {
        'frameWidth': CELL, 'frameHeight': CELL,
        'directions': DIRECTIONS, 'states': {}
    }
    for state, count in COUNTS.items():
        sheet = Image.new('RGBA', (CELL * count, CELL * len(DIRECTIONS)))
        for row, direction in enumerate(DIRECTIONS):
            frames = []
            for index in range(count):
                frame = frame_for(bases[direction], state, index, direction, name)
                if frame.getchannel('A').getbbox() is None:
                    raise ValueError(f'Blank frame: {name}/{state}/{direction}/{index}')
                frame_dir = output / state / direction
                frame_dir.mkdir(parents=True, exist_ok=True)
                frame.save(frame_dir / f'frame-{index}.png')
                sheet.alpha_composite(frame, (CELL * index, CELL * row))
                frames.append(frame.tobytes())
            if len(set(frames)) < 2:
                raise ValueError(f'No motion: {name}/{state}/{direction}')
        sheet.save(sheets / f'{state}.png')
        layout['states'][state] = {'columns': count, 'counts': dict.fromkeys(DIRECTIONS, count)}
    (sheets / 'layout.json').write_text(json.dumps(layout, indent=2))
    print(f'Packed {name}: six sheets, four facings each')


for creature in NAMES:
    pack(creature)
