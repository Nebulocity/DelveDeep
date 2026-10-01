const sheets = {
  caveSlime: [
    new URL('../assets/enemies/slime-cave/caveSlime/reference-v2/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/reference-v2/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/reference-v2/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/reference-v2/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/reference-v2/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/reference-v2/sheets/death.png', import.meta.url).href
  ],
  elderSlime: [
    new URL('../assets/enemies/slime-cave/elderSlime/reference-v2/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/reference-v2/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/reference-v2/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/reference-v2/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/reference-v2/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/reference-v2/sheets/death.png', import.meta.url).href
  ],
  slimeSovereign: [
    new URL('../assets/enemies/slime-cave/slimeSovereign/reference-v2/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/slimeSovereign/reference-v2/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/slimeSovereign/reference-v2/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/slimeSovereign/reference-v2/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/slimeSovereign/reference-v2/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/slimeSovereign/reference-v2/sheets/death.png', import.meta.url).href
  ]
};

const states = ['idle', 'walk', 'attack', 'block', 'hit', 'death'];
const defaultColumns = { idle: 4, walk: 8, attack: 9, block: 5, hit: 5, death: 9 };
const frameMs = { idle: 150, walk: 75, attack: 70, block: 85, hit: 60, death: 110 };
const rows = {
  south: 0, 'south-east': 0, east: 0,
  'south-west': 1, west: 1, north: 2, 'north-east': 2, 'north-west': 3
};

function createSlimeSprite(id, urls, scale, columns = defaultColumns) {
  const textures = urls.map((url, index) => ({
    key: `${id}-${states[index]}`, url, frameWidth: 192, frameHeight: 192
  }));
  const clips = {};
  for (const state of states) {
    clips[state] = {};
    for (const [direction, row] of Object.entries(rows)) {
      clips[state][direction] = {
        frameMs: frameMs[state],
        frames: Array.from({ length: columns[state] }, (_, column) => ({
          key: `${id}-${state}`, frame: row * columns[state] + column,
          originX: 0.5, originY: 184 / 192, flipX: false
        }))
      };
    }
  }
  clips.dead = Object.fromEntries(Object.entries(clips.death).map(([direction, clip]) => [
    direction, { frameMs: 1000, frames: [clip.frames.at(-1)] }
  ]));
  return { textures, clips, scale, footY: 30 };
}

export const SLIME_SPRITES = {
  caveSlime: createSlimeSprite('caveSlime', sheets.caveSlime, 2, { ...defaultColumns, attack: 5 }),
  elderSlime: createSlimeSprite('elderSlime', sheets.elderSlime, 2.2),
  slimeSovereign: createSlimeSprite('slimeSovereign', sheets.slimeSovereign, 3.3)
};

export function preloadSlimeSprites(scene) {
  for (const sprite of Object.values(SLIME_SPRITES)) {
    for (const { key, url, frameWidth, frameHeight } of sprite.textures) {
      if (!scene.textures.exists(key)) scene.load.spritesheet(key, url, { frameWidth, frameHeight });
    }
  }
}
