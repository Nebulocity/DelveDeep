// This is sprite metadata, connecting stable IDs to textures, frames and animations. Frame
// sizes and origins come from the supplied sheets. An origin marks the anchor inside a
// frame, not a battlefield position. Direction and clip counts keep animation from
// stepping into unused cells at the end of a sheet.

const sheets = {
  caveSlime: [
    new URL('../assets/enemies/slime-cave/caveSlime/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/sheets/death.png', import.meta.url).href
  ],

  elderSlime: [
    new URL('../assets/enemies/slime-cave/elderSlime/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/sheets/death.png', import.meta.url).href
  ],

  slimeSovereign: [
    new URL('../assets/enemies/slime-cave/slimeSovereign/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/slimeSovereign/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/slimeSovereign/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/slimeSovereign/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/slimeSovereign/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/slimeSovereign/sheets/death.png', import.meta.url).href
  ]
};

const states = ['idle', 'walk', 'attack', 'block', 'hit', 'death'];
const defaultColumns = { idle: 4, walk: 8, attack: 9, block: 5, hit: 5, death: 9 };
const frameMs = { idle: 150, walk: 75, attack: 70, block: 85, hit: 60, death: 110 };
const rows = {
  south: 0, 'south-east': 0, east: 0,
  'south-west': 1, west: 1, north: 2, 'north-east': 2, 'north-west': 3
};

// Build a slime's facing and animation metadata from the accepted sheet configuration.
function createSlimeSprite(id, urls, scale, footFrameY, columns = defaultColumns) {

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry.
  const textures = urls.map((url, index) => ({
    key: `${id}-${states[index]}`, url, frameWidth: 192, frameHeight: 192
  }));
  const clips = {};

  for (const state of states) {
    clips[state] = {};

    // Object.entries turns own fields into [key, value] pairs so we can visit or transform
    // them.
    for (const [direction, row] of Object.entries(rows)) {
      clips[state][direction] = {
        frameMs: frameMs[state],
        frames: Array.from({ length: columns[state] }, (_, column) => ({
          key: `${id}-${state}`, frame: row * columns[state] + column,
          originX: 0.5, originY: footFrameY / 192, flipX: false
        }))
      };
    }
  }

  // Object.fromEntries turns [key, value] pairs back into an object. A later pair with the
  // same key replaces the earlier value.
  clips.dead = Object.fromEntries(Object.entries(clips.death).map(([direction, clip]) => [
    direction, { frameMs: 1000, frames: [clip.frames.at(-1)] }
  ]));

  return { textures, clips, scale, footY: 0 };
}

// Foot anchors match the opaque base of each 192 pixel sheet frame.
export const SLIME_SPRITES = {
  caveSlime: { ...createSlimeSprite('caveSlime', sheets.caveSlime, 2, 170, { ...defaultColumns, attack: 5 }), topFrameY: 115,
    motion: { kind: 'bob', period: 620, lift: 3, squish: 0.08, sway: 5 } },

  elderSlime: { ...createSlimeSprite('elderSlime', sheets.elderSlime, 2.2, 168), topFrameY: 65,
    motion: { kind: 'bob', period: 760, lift: 4, squish: 0.1, sway: 6 } },

  slimeSovereign: { ...createSlimeSprite('slimeSovereign', sheets.slimeSovereign, 3.3, 178), topFrameY: 54,
    motion: { kind: 'bob', period: 940, lift: 4, squish: 0.1, sway: 8 } }
};

// Queue the accepted Cave Slime, Elder Slime and Slime Sovereign sheets. scene is the
// Phaser screen that owns the objects, clock and input used here.
export function preloadSlimeSprites(scene) {
  for (const sprite of Object.values(SLIME_SPRITES)) {
    for (const { key, url, frameWidth, frameHeight } of sprite.textures) {
      if (!scene.textures.exists(key)) scene.load.spritesheet(key, url, { frameWidth, frameHeight });
    }
  }
}
