// Explicit URLs let Vite include every supplied sheet in the production build.
const sheets = {
  banditWhip: [
    new URL('../assets/enemies/thornbriar-hollow/bandit1/reference-v2/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/bandit1/reference-v2/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/bandit1/reference-v2/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/bandit1/reference-v2/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/bandit1/reference-v2/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/bandit1/reference-v2/sheets/death.png', import.meta.url).href
  ],
  banditKnives: [
    new URL('../assets/enemies/thornbriar-hollow/bandit2/reference-v2/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/bandit2/reference-v2/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/bandit2/reference-v2/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/bandit2/reference-v2/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/bandit2/reference-v2/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/bandit2/reference-v2/sheets/death.png', import.meta.url).href
  ],
  banditHexer: [
    new URL('../assets/enemies/thornbriar-hollow/bandit3/reference-v2/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/bandit3/reference-v2/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/bandit3/reference-v2/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/bandit3/reference-v2/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/bandit3/reference-v2/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/bandit3/reference-v2/sheets/death.png', import.meta.url).href
  ],
  banditChief: [
    new URL('../assets/enemies/thornbriar-hollow/banditBoss/reference-v2/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/banditBoss/reference-v2/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/banditBoss/reference-v2/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/banditBoss/reference-v2/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/banditBoss/reference-v2/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/banditBoss/reference-v2/sheets/death.png', import.meta.url).href
  ]
};

const states = ['idle', 'walk', 'attack', 'block', 'hit', 'death'];
const columns = { idle: 4, walk: 8, attack: 9, block: 5, hit: 5, death: 9 };
const frameMs = { idle: 150, walk: 75, attack: 70, block: 85, hit: 60, death: 110 };
const rows = {
  south: 0, 'south-east': 0, east: 0,
  'south-west': 1, west: 1, north: 2, 'north-east': 2, 'north-west': 3
};

function createSprite(id, urls) {
  const textures = urls.map((url, index) => ({
    key: `${id}-${states[index]}`, url, frameWidth: 256, frameHeight: 256
  }));
  const clips = {};
  for (const state of states) {
    clips[state] = {};
    for (const [direction, row] of Object.entries(rows)) {
      clips[state][direction] = {
        frameMs: frameMs[state],
        frames: Array.from({ length: columns[state] }, (_, column) => ({
          key: `${id}-${state}`, frame: row * columns[state] + column,
          originX: 0.5, originY: 0.9296875, flipX: false
        }))
      };
    }
  }
  clips.dead = Object.fromEntries(Object.entries(clips.death).map(([direction, clip]) => [
    direction, { frameMs: 1000, frames: [clip.frames.at(-1)] }
  ]));
  return { textures, clips, scale: id === 'banditChief' ? 0.78 : 0.66, footY: 30 };
}

export const ENEMY_SPRITES = Object.fromEntries(
  Object.entries(sheets).map(([id, urls]) => [id, createSprite(id, urls)])
);

export function preloadEnemySprites(scene) {
  for (const sprite of Object.values(ENEMY_SPRITES)) {
    for (const { key, url, frameWidth, frameHeight } of sprite.textures) {
      if (!scene.textures.exists(key)) scene.load.spritesheet(key, url, { frameWidth, frameHeight });
    }
  }
}
