"""Remove confirmed baked-in crop remnants and passive hand effects."""

from pathlib import Path
from io import BytesIO
from time import sleep

import numpy as np
from PIL import Image


ROOT = Path('assets/characters')
STATES = ('idle', 'walk', 'attack', 'block', 'hit', 'death')
DIRECTIONS = ('south-east', 'south-west', 'north-east', 'north-west')


def save_rgba(path, pixels):
    output = BytesIO()
    Image.fromarray(pixels, 'RGBA').save(output, format='PNG')
    for attempt in range(10):
        try:
            path.write_bytes(output.getvalue())
            return
        except OSError:
            sleep(0.1)
    raise OSError(f'Could not save {path}')


def clean_tasslehoff(path):
    image = Image.open(path).convert('RGBA')
    pixels = np.array(image)
    rgb = pixels[:, :, :3].astype(np.int16)
    white = (rgb.min(axis=2) >= 245) & ((rgb.max(axis=2) - rgb.min(axis=2)) <= 10)
    white &= pixels[:, :, 3] > 0

    if path.parent.parent.name == 'attack' and path.parent.name == 'north-west' and path.stem == 'frame-2':
        white[20:195, 160:255] = False

    count = int(white.sum())
    pixels[white] = 0
    if count:
        save_rgba(path, pixels)
    return count


def clean_palin(path):
    image = Image.open(path).convert('RGBA')
    pixels = np.array(image)
    y, x = np.indices(pixels.shape[:2])
    direction = path.parent.name
    if direction == 'south-east':
        mask = (x >= 164) & (x < 229) & (y >= 66) & (y < 126)
    elif direction == 'south-west':
        mask = (x >= 155) & (x < 218) & (y >= 70) & (y < 135)
    else:
        mask = (((x < 54) & (y >= 68) & (y < 146)) |
                ((x < 84) & (y >= 68) & (y < 126)))

    red = pixels[:, :, 0].astype(np.int16)
    green = pixels[:, :, 1].astype(np.int16)
    blue = pixels[:, :, 2].astype(np.int16)
    cyan = (blue > red + 16) & (blue > green + 8) & (blue > 95)
    if direction == 'south-west':
        mask &= cyan
    skin = ((red >= 135) & (green >= 78) & (blue >= 42) &
            (red - green >= 22) & (green - blue >= 18) &
            (pixels[:, :, 3] > 0))
    hand_area = (((x >= 160) & (x < 201) & (y >= 90) & (y < 123))
                 if direction.startswith('south') else
                 ((x >= 42) & (x < 83) & (y >= 87) & (y < 123)))
    skin &= hand_area
    hand_outline = skin.copy()
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            shifted = np.roll(np.roll(skin, dy, axis=0), dx, axis=1)
            hand_outline |= shifted
    mask &= ~hand_outline
    if direction == 'south-east':
        mask |= ((x >= 164) & (x < 228) & (y >= 70) & (y < 146) & cyan)
        mask |= (x >= 198) & (x < 228) & (y >= 80) & (y < 143)
    elif direction == 'south-west':
        mask |= (x >= 187) & (x < 218) & (y >= 76) & (y < 127)
    elif direction in ('north-east', 'north-west'):
        pale = (red > 205) & (green > 195) & (blue > 155)
        mask |= ((x < 86) & (y >= 70) & (y < 119) & pale & ~hand_outline)

    count = int((mask & (pixels[:, :, 3] > 0)).sum())
    pixels[mask] = 0
    if count:
        save_rgba(path, pixels)
    return count


def clean_hedge_mage(path):
    direction = path.parent.name
    if direction == 'north-east':
        return 0
    image = Image.open(path).convert('RGBA')
    pixels = np.array(image)
    y, x = np.indices(pixels.shape[:2])
    if direction == 'south-east':
        area = (x >= 190) & (y >= 15) & (y < 145)
    elif direction == 'south-west':
        area = (x >= 75) & (x < 150) & (y >= 55) & (y < 177)
    else:
        area = (x < 94) & (y >= 16) & (y < 151)
    red = pixels[:, :, 0].astype(np.int16)
    green = pixels[:, :, 1].astype(np.int16)
    blue = pixels[:, :, 2].astype(np.int16)
    purple = ((blue > green + 9) & (red > green + 7) &
              (blue > red - 22) & (pixels[:, :, 3] > 0))
    mask = area & purple
    if direction == 'south-west':
        mask |= (x >= 84) & (x < 122) & (y >= 42) & (y < 158)
        pink = ((red > 140) & (blue > 125) & (blue > green + 5) &
                (blue > red - 85))
        mask |= area & pink
    count = int(mask.sum())
    if count:
        pixels[mask] = 0
    if direction == 'south-west':
        donor_path = path.parents[2] / 'attack' / direction / 'frame-3.png'
        donor = np.array(Image.open(donor_path).convert('RGBA'))
        donor_area = ((x >= 84) & (x < 125) & (y >= 42) & (y < 158) &
                      (donor[:, :, 3] > 0))
        pixels[donor_area] = donor[donor_area]
    if count or direction == 'south-west':
        save_rgba(path, pixels)
    return count


def clean_tika(path):
    if path.parent.name != 'south-east' or path.stem not in ('frame-2', 'frame-3'):
        return 0
    source_index = 0 if path.stem == 'frame-2' else 1
    source = path.with_name(f'frame-{source_index}.png')
    pixels = np.array(Image.open(path).convert('RGBA'))
    clean = np.array(Image.open(source).convert('RGBA'))
    count = int(np.any(pixels != clean, axis=2).sum())
    save_rgba(path, clean)
    return count


for state in STATES:
    for direction in DIRECTIONS:
        for path in sorted((ROOT / 'tasslehoff' / 'reference-v2' / state / direction).glob('frame-*.png')):
            count = clean_tasslehoff(path)
            if count:
                print(f'Tasslehoff {state}/{direction}/{path.stem}: {count} white pixels')

for state in ('idle', 'walk'):
    for direction in DIRECTIONS:
        for path in sorted((ROOT / 'palin' / 'reference-v2' / state / direction).glob('frame-*.png')):
            count = clean_palin(path)
            if count:
                print(f'Palin {state}/{direction}/{path.stem}: {count} hand-effect pixels')

for path in sorted((ROOT / 'tika' / 'reference-v2' / 'idle' / 'south-east').glob('frame-*.png')):
    count = clean_tika(path)
    if count:
        print(f'Tika idle/south-east/{path.stem}: {count} trail pixels')

for state in ('idle', 'walk'):
    for direction in DIRECTIONS:
        folder = Path('assets/enemies/thornbriar-hollow/hedgeMage/reference-v2') / state / direction
        for path in sorted(folder.glob('frame-*.png')):
            count = clean_hedge_mage(path)
            if count:
                print(f'Hedge Mage {state}/{direction}/{path.stem}: {count} hand-effect pixels')
