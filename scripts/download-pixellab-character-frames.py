"""Install completed PixelLab animation frames listed in a character jobs.json."""
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image


root = Path(sys.argv[1])
jobs = json.loads((root / 'jobs.json').read_text())['animations']
states = set(sys.argv[2:]) or set(jobs)
counts = {'idle': 5, 'walk': 9, 'attack': 9, 'block': 5, 'hit': 5, 'death': 9}


def download(task):
    state, direction, job_id, index = task
    target = root / state / direction / f'frame-{index}.png'
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        return target
    url = f'https://api.pixellab.ai/mcp/images/{job_id}/download?index={index}'
    data = urllib.request.urlopen(url, timeout=90).read()
    temporary = target.with_suffix('.tmp')
    temporary.write_bytes(data)
    with Image.open(temporary) as frame:
        if frame.size != (256, 256) or frame.mode != 'RGBA' or not frame.getchannel('A').getbbox():
            temporary.unlink()
            raise ValueError(f'Invalid frame: {state}/{direction}/{index}')
    temporary.replace(target)
    return target


tasks = [
    (state, direction, job_id, index)
    for state, directions in jobs.items() if state in states
    for direction, job_id in directions.items()
    for index in range(counts[state])
]
with ThreadPoolExecutor(max_workers=8) as pool:
    installed = list(pool.map(download, tasks))
print(f'Installed {len(installed)} frames from {len(set((task[0], task[1]) for task in tasks))} clips.')
