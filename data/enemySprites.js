// This is sprite metadata, connecting stable IDs to textures, frames and animations. Frame
// sizes and origins come from the supplied sheets. An origin marks the anchor inside a
// frame, not a battlefield position. Direction and clip counts keep animation from
// stepping into unused cells at the end of a sheet. Explicit URLs let Vite include every
// supplied sheet in the production build.
import { BAAZ_SPRITES } from './baazSprites.js';

const sheets = {
  lasher: [
    new URL('../assets/enemies/thornbriar-hollow/lasher/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/lasher/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/lasher/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/lasher/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/lasher/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/lasher/sheets/death.png', import.meta.url).href
  ],

  ruffian: [
    new URL('../assets/enemies/thornbriar-hollow/ruffian/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/ruffian/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/ruffian/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/ruffian/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/ruffian/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/ruffian/sheets/death.png', import.meta.url).href
  ],

  hedgeMage: [
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/sheets/death.png', import.meta.url).href
  ],

  rongarTheCrusher: [
    new URL('../assets/enemies/thornbriar-hollow/rongarTheCrusher/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/rongarTheCrusher/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/rongarTheCrusher/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/rongarTheCrusher/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/rongarTheCrusher/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/rongarTheCrusher/sheets/death.png', import.meta.url).href
  ],

  denWarden: [
    new URL('../assets/enemies/dolmark-den/denWarden/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/dolmark-den/denWarden/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/dolmark-den/denWarden/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/dolmark-den/denWarden/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/dolmark-den/denWarden/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/dolmark-den/denWarden/sheets/death.png', import.meta.url).href
  ],

  denProtector: [
    new URL('../assets/enemies/dolmark-den/denProtector/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/dolmark-den/denProtector/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/dolmark-den/denProtector/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/dolmark-den/denProtector/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/dolmark-den/denProtector/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/dolmark-den/denProtector/sheets/death.png', import.meta.url).href
  ],

  silvanarkTheForestLord: [
    new URL('../assets/enemies/dolmark-den/silvanarkTheForestLord/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/dolmark-den/silvanarkTheForestLord/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/dolmark-den/silvanarkTheForestLord/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/dolmark-den/silvanarkTheForestLord/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/dolmark-den/silvanarkTheForestLord/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/dolmark-den/silvanarkTheForestLord/sheets/death.png', import.meta.url).href
  ]
};

const states = ['idle', 'walk', 'attack', 'block', 'hit', 'death'];
const columns = { idle: 4, walk: 8, attack: 9, block: 5, hit: 5, death: 9 };
const dolmarkColumns = { idle: 4, walk: 8, attack: 8, block: 4, hit: 4, death: 8 };
const frameMs = { idle: 150, walk: 75, attack: 70, block: 85, hit: 60, death: 110 };
const rows = {
  south: 0, 'south-east': 0, east: 0,
  'south-west': 1, west: 1, north: 2, 'north-east': 2, 'north-west': 3
};

// Build the sprite metadata for a catalog enemy from its accepted sheets and clip
// settings.
function createSprite(id, urls) {

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const stateColumns = ['denWarden', 'denProtector', 'silvanarkTheForestLord'].includes(id)
    ? dolmarkColumns : columns;

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry.
  const textures = urls.map((url, index) => ({
    key: `${id}-${states[index]}`, url, frameWidth: 256, frameHeight: 256
  }));
  const clips = {};

  for (const state of states) {
    clips[state] = {};

    // Object.entries turns own fields into [key, value] pairs so we can visit or transform
    // them.
    for (const [direction, row] of Object.entries(rows)) {
      clips[state][direction] = {
        frameMs: frameMs[state],
        frames: Array.from({ length: stateColumns[state] }, (_, column) => ({
          key: `${id}-${state}`, frame: row * stateColumns[state] + column,
          originX: 0.5, originY: id === 'silvanarkTheForestLord' ? 1 : 0.9296875, flipX: false
        }))
      };
    }
  }

  // Object.fromEntries turns [key, value] pairs back into an object. A later pair with the
  // same key replaces the earlier value.
  clips.dead = Object.fromEntries(Object.entries(clips.death).map(([direction, clip]) => [
    direction, { frameMs: 1000, frames: [clip.frames.at(-1)] }
  ]));
  const scale = id === 'rongarTheCrusher' ? 1.17 : id === 'silvanarkTheForestLord' ? 0.78
    : id === 'denProtector' ? 1.2 : id === 'denWarden' ? 1.05 : 0.66;

  return { textures, clips, scale, footY: 0 };
}

export const ENEMY_SPRITES = Object.fromEntries(
  Object.entries(sheets).map(([id, urls]) => [id, createSprite(id, urls)])
);

// Register the finished Baaz set for ordinary combat loading. Its encounter placement
// can be authored separately without changing texture keys or the enemy definition.
Object.assign(ENEMY_SPRITES, BAAZ_SPRITES);

// Queue the enemy sprite sheets needed by the current catalog. scene is the Phaser screen
// that owns the objects, clock and input used here.
export function preloadEnemySprites(scene) {
  for (const sprite of Object.values(ENEMY_SPRITES)) {
    for (const { key, url, frameWidth, frameHeight } of sprite.textures) {
      if (!scene.textures.exists(key)) scene.load.spritesheet(key, url, { frameWidth, frameHeight });
    }
  }
}
