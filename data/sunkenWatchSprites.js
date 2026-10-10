// Each monster has four authored diagonal facings. Layout metadata records the native
// cell size, playable counts, timing and foot anchor shared by all its animation states.
import sunkenWatcherLayout from '../assets/enemies/sunken-watch/sunkenWatcher/sheets/layout.json' with { type: 'json' };
import deepTongueLayout from '../assets/enemies/sunken-watch/deepTongue/sheets/layout.json' with { type: 'json' };
import drownedKnellLayout from '../assets/enemies/sunken-watch/drownedKnell/sheets/layout.json' with { type: 'json' };
import earthsinkerLayout from '../assets/enemies/sunken-watch/earthsinker/sheets/layout.json' with { type: 'json' };

const sources = {
  sunkenWatcher: {
    layout: sunkenWatcherLayout,
    urls: {
      idle: new URL('../assets/enemies/sunken-watch/sunkenWatcher/sheets/idle.png', import.meta.url).href,
      walk: new URL('../assets/enemies/sunken-watch/sunkenWatcher/sheets/walk.png', import.meta.url).href,
      attack: new URL('../assets/enemies/sunken-watch/sunkenWatcher/sheets/attack.png', import.meta.url).href,
      cast: new URL('../assets/enemies/sunken-watch/sunkenWatcher/sheets/cast.png', import.meta.url).href,
      block: new URL('../assets/enemies/sunken-watch/sunkenWatcher/sheets/block.png', import.meta.url).href,
      hit: new URL('../assets/enemies/sunken-watch/sunkenWatcher/sheets/hit.png', import.meta.url).href,
      death: new URL('../assets/enemies/sunken-watch/sunkenWatcher/sheets/death.png', import.meta.url).href,
    }
  },
  deepTongue: {
    layout: deepTongueLayout,
    urls: {
      idle: new URL('../assets/enemies/sunken-watch/deepTongue/sheets/idle.png', import.meta.url).href,
      walk: new URL('../assets/enemies/sunken-watch/deepTongue/sheets/walk.png', import.meta.url).href,
      attack: new URL('../assets/enemies/sunken-watch/deepTongue/sheets/attack.png', import.meta.url).href,
      cast: new URL('../assets/enemies/sunken-watch/deepTongue/sheets/cast.png', import.meta.url).href,
      block: new URL('../assets/enemies/sunken-watch/deepTongue/sheets/block.png', import.meta.url).href,
      hit: new URL('../assets/enemies/sunken-watch/deepTongue/sheets/hit.png', import.meta.url).href,
      death: new URL('../assets/enemies/sunken-watch/deepTongue/sheets/death.png', import.meta.url).href,
    }
  },
  drownedKnell: {
    layout: drownedKnellLayout,
    urls: {
      idle: new URL('../assets/enemies/sunken-watch/drownedKnell/sheets/idle.png', import.meta.url).href,
      walk: new URL('../assets/enemies/sunken-watch/drownedKnell/sheets/walk.png', import.meta.url).href,
      attack: new URL('../assets/enemies/sunken-watch/drownedKnell/sheets/attack.png', import.meta.url).href,
      cast: new URL('../assets/enemies/sunken-watch/drownedKnell/sheets/cast.png', import.meta.url).href,
      block: new URL('../assets/enemies/sunken-watch/drownedKnell/sheets/block.png', import.meta.url).href,
      hit: new URL('../assets/enemies/sunken-watch/drownedKnell/sheets/hit.png', import.meta.url).href,
      death: new URL('../assets/enemies/sunken-watch/drownedKnell/sheets/death.png', import.meta.url).href,
    }
  },
  earthsinker: {
    layout: earthsinkerLayout,
    urls: {
      idle: new URL('../assets/enemies/sunken-watch/earthsinker/sheets/idle.png', import.meta.url).href,
      walk: new URL('../assets/enemies/sunken-watch/earthsinker/sheets/walk.png', import.meta.url).href,
      attack: new URL('../assets/enemies/sunken-watch/earthsinker/sheets/attack.png', import.meta.url).href,
      cast: new URL('../assets/enemies/sunken-watch/earthsinker/sheets/cast.png', import.meta.url).href,
      block: new URL('../assets/enemies/sunken-watch/earthsinker/sheets/block.png', import.meta.url).href,
      hit: new URL('../assets/enemies/sunken-watch/earthsinker/sheets/hit.png', import.meta.url).href,
      death: new URL('../assets/enemies/sunken-watch/earthsinker/sheets/death.png', import.meta.url).href,
    }
  },
};

const rows = {
  south: 0, 'south-east': 0, east: 0, 'south-west': 1,
  west: 1, north: 2, 'north-east': 2, 'north-west': 3
};

// These native 128-pixel sprites are smaller than the older 256-pixel source artwork.
// Display scales keep ordinary monsters readable and make the rocky boss stand taller.
const scales = { sunkenWatcher: 1.35, deepTongue: 1.55, drownedKnell: 1.65, earthsinker: 2.15 };

// Turn standalone sheet metadata into the clips understood by UnitSprite.
function createSprite(id, { layout, urls }) {
  const textures = Object.entries(urls).map(([state, url]) => ({
    key: `${id}-${state}`, url, frameWidth: layout.frameWidth, frameHeight: layout.frameHeight
  }));
  const clips = {};

  for (const [state, spec] of Object.entries(layout.states)) {
    if (!urls[state]) continue;
    clips[state] = {};
    for (const [direction, row] of Object.entries(rows)) {
      const authoredDirection = layout.directions[row];
      const origin = layout.origins[authoredDirection];

      // Row aliases support eight movement headings without mirroring weapons or limbs.
      // Multiplying the row by its column count finds the row's first cell in Phaser.
      clips[state][direction] = {
        frameMs: spec.frameMs,
        frames: Array.from({ length: spec.counts[authoredDirection] }, (_, column) => ({
          key: `${id}-${state}`, frame: row * spec.columns + column,
          originX: origin.x, originY: origin.y, flipX: false
        }))
      };
    }
  }

  // Hold the last death cell until the shared monster fade and pop finish removing it.
  clips.dead = Object.fromEntries(Object.entries(clips.death).map(([direction, clip]) => [
    direction, { frameMs: 1000, frames: [clip.frames.at(-1)] }
  ]));
  return { textures, clips, scale: scales[id], footY: 0, topFrameY: layout.topFrameY };
}

export const SUNKEN_WATCH_SPRITES = Object.fromEntries(
  Object.entries(sources).map(([id, source]) => [id, createSprite(id, source)])
);

// Load these atlases on entry to Sunken Watch and reuse textures on subsequent visits.
export function preloadSunkenWatchSprites(scene) {
  for (const sprite of Object.values(SUNKEN_WATCH_SPRITES)) {
    for (const { key, url, frameWidth, frameHeight } of sprite.textures) {
      if (!scene.textures.exists(key)) scene.load.spritesheet(key, url, { frameWidth, frameHeight });
    }
  }
}
