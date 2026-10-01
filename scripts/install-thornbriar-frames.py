"""Download completed PixelLab bandit animation frames into the source tree."""

import json
import sys
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image


ROOT = Path('assets/enemies/thornbriar-hollow')
MANIFEST = ROOT / 'animation-jobs.json'
FRAME_COUNTS = {'idle': 5, 'walk': 9, 'attack': 9, 'block': 5, 'hit': 5, 'death': 9}


def install(name, state, direction, job_id):
    folder = ROOT / name / 'reference-v2' / state / direction
    folder.mkdir(parents=True, exist_ok=True)
    for index in range(FRAME_COUNTS[state]):
        target = folder / f'frame-{index}.png'
        if target.exists():
            continue
        url = f'https://api.pixellab.ai/mcp/images/{job_id}/download?index={index}'
        data = urllib.request.urlopen(url, timeout=45).read()
        with Image.open(BytesIO(data)) as frame:
            if frame.size != (256, 256) or frame.mode != 'RGBA':
                raise ValueError(f'Unexpected frame format: {name}/{state}/{direction}/{index}')
            if not frame.getchannel('A').getbbox():
                raise ValueError(f'Blank frame: {name}/{state}/{direction}/{index}')
        target.write_bytes(data)
    print(f'Installed {name}/{state}/{direction}')


jobs = json.loads(MANIFEST.read_text(encoding='utf-8-sig'))
selected = set(sys.argv[1:])
for name, states in jobs.items():
    for state, directions in states.items():
        for direction, job_id in directions.items():
            key = f'{name}/{state}/{direction}'
            if selected and key not in selected:
                continue
            try:
                install(name, state, direction, job_id)
            except urllib.error.HTTPError as error:
                if error.code in (404, 409, 423):
                    print(f'Pending {key}: HTTP {error.code}')
                    continue
                raise
