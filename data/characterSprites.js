// Native PixelLab frames; static URLs include each PNG in the Pages build.
const textures = [
  { key: 'laurana-idle-south-east-0', url: new URL('../assets/characters/laurana/pixellab/ready-idle/south-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-idle-south-east-1', url: new URL('../assets/characters/laurana/pixellab/ready-idle/south-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-idle-south-east-2', url: new URL('../assets/characters/laurana/pixellab/ready-idle/south-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-idle-south-east-3', url: new URL('../assets/characters/laurana/pixellab/ready-idle/south-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-idle-south-east-4', url: new URL('../assets/characters/laurana/pixellab/ready-idle/south-east/frame-4.png', import.meta.url).href },
  { key: 'laurana-idle-south-east-5', url: new URL('../assets/characters/laurana/pixellab/ready-idle/south-east/frame-5.png', import.meta.url).href },
  { key: 'laurana-idle-south-east-6', url: new URL('../assets/characters/laurana/pixellab/ready-idle/south-east/frame-6.png', import.meta.url).href },
  { key: 'laurana-idle-south-east-7', url: new URL('../assets/characters/laurana/pixellab/ready-idle/south-east/frame-7.png', import.meta.url).href },
  { key: 'laurana-idle-north-east-0', url: new URL('../assets/characters/laurana/pixellab/ready-idle/north-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-idle-north-east-1', url: new URL('../assets/characters/laurana/pixellab/ready-idle/north-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-idle-north-east-2', url: new URL('../assets/characters/laurana/pixellab/ready-idle/north-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-idle-north-east-3', url: new URL('../assets/characters/laurana/pixellab/ready-idle/north-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-idle-north-east-4', url: new URL('../assets/characters/laurana/pixellab/ready-idle/north-east/frame-4.png', import.meta.url).href },
  { key: 'laurana-idle-north-east-5', url: new URL('../assets/characters/laurana/pixellab/ready-idle/north-east/frame-5.png', import.meta.url).href },
  { key: 'laurana-idle-north-east-6', url: new URL('../assets/characters/laurana/pixellab/ready-idle/north-east/frame-6.png', import.meta.url).href },
  { key: 'laurana-idle-north-east-7', url: new URL('../assets/characters/laurana/pixellab/ready-idle/north-east/frame-7.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-0', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-1', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-2', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-3', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-4', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-4.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-5', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-5.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-6', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-6.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-7', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-7.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-0', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-1', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-2', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-3', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-4', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-4.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-5', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-5.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-6', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-6.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-7', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-7.png', import.meta.url).href },
  { key: 'laurana-attack-south-east-0', url: new URL('../assets/characters/laurana/pixellab/spear-attack/south-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-attack-south-east-1', url: new URL('../assets/characters/laurana/pixellab/spear-attack/south-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-attack-south-east-2', url: new URL('../assets/characters/laurana/pixellab/spear-attack/south-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-attack-south-east-3', url: new URL('../assets/characters/laurana/pixellab/spear-attack/south-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-attack-south-east-4', url: new URL('../assets/characters/laurana/pixellab/spear-attack/south-east/frame-4.png', import.meta.url).href },
  { key: 'laurana-attack-south-east-5', url: new URL('../assets/characters/laurana/pixellab/spear-attack/south-east/frame-5.png', import.meta.url).href },
  { key: 'laurana-attack-south-east-6', url: new URL('../assets/characters/laurana/pixellab/spear-attack/south-east/frame-6.png', import.meta.url).href },
  { key: 'laurana-attack-north-east-0', url: new URL('../assets/characters/laurana/pixellab/spear-attack/north-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-attack-north-east-1', url: new URL('../assets/characters/laurana/pixellab/spear-attack/north-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-attack-north-east-2', url: new URL('../assets/characters/laurana/pixellab/spear-attack/north-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-attack-north-east-3', url: new URL('../assets/characters/laurana/pixellab/spear-attack/north-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-attack-north-east-4', url: new URL('../assets/characters/laurana/pixellab/spear-attack/north-east/frame-4.png', import.meta.url).href },
  { key: 'laurana-attack-north-east-5', url: new URL('../assets/characters/laurana/pixellab/spear-attack/north-east/frame-5.png', import.meta.url).href },
  { key: 'laurana-attack-north-east-6', url: new URL('../assets/characters/laurana/pixellab/spear-attack/north-east/frame-6.png', import.meta.url).href },
  { key: 'laurana-block-south-east-0', url: new URL('../assets/characters/laurana/pixellab/shield-block/south-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-block-south-east-1', url: new URL('../assets/characters/laurana/pixellab/shield-block/south-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-block-south-east-2', url: new URL('../assets/characters/laurana/pixellab/shield-block/south-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-block-south-east-3', url: new URL('../assets/characters/laurana/pixellab/shield-block/south-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-block-south-east-4', url: new URL('../assets/characters/laurana/pixellab/shield-block/south-east/frame-4.png', import.meta.url).href },
  { key: 'laurana-block-north-east-0', url: new URL('../assets/characters/laurana/pixellab/shield-block/north-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-block-north-east-1', url: new URL('../assets/characters/laurana/pixellab/shield-block/north-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-block-north-east-2', url: new URL('../assets/characters/laurana/pixellab/shield-block/north-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-block-north-east-3', url: new URL('../assets/characters/laurana/pixellab/shield-block/north-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-block-north-east-4', url: new URL('../assets/characters/laurana/pixellab/shield-block/north-east/frame-4.png', import.meta.url).href },
  { key: 'laurana-hit-south-east-0', url: new URL('../assets/characters/laurana/pixellab/hit/south-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-hit-south-east-1', url: new URL('../assets/characters/laurana/pixellab/hit/south-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-hit-south-east-2', url: new URL('../assets/characters/laurana/pixellab/hit/south-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-hit-south-east-3', url: new URL('../assets/characters/laurana/pixellab/hit/south-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-hit-south-east-4', url: new URL('../assets/characters/laurana/pixellab/hit/south-east/frame-4.png', import.meta.url).href },
  { key: 'laurana-hit-south-east-5', url: new URL('../assets/characters/laurana/pixellab/hit/south-east/frame-5.png', import.meta.url).href },
  { key: 'laurana-hit-north-east-0', url: new URL('../assets/characters/laurana/pixellab/hit/north-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-hit-north-east-1', url: new URL('../assets/characters/laurana/pixellab/hit/north-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-hit-north-east-2', url: new URL('../assets/characters/laurana/pixellab/hit/north-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-hit-north-east-3', url: new URL('../assets/characters/laurana/pixellab/hit/north-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-hit-north-east-4', url: new URL('../assets/characters/laurana/pixellab/hit/north-east/frame-4.png', import.meta.url).href },
  { key: 'laurana-hit-north-east-5', url: new URL('../assets/characters/laurana/pixellab/hit/north-east/frame-5.png', import.meta.url).href },
  { key: 'laurana-death-south-east-0', url: new URL('../assets/characters/laurana/pixellab/death/south-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-death-south-east-1', url: new URL('../assets/characters/laurana/pixellab/death/south-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-death-south-east-2', url: new URL('../assets/characters/laurana/pixellab/death/south-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-death-south-east-3', url: new URL('../assets/characters/laurana/pixellab/death/south-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-death-south-east-4', url: new URL('../assets/characters/laurana/pixellab/death/south-east/frame-4.png', import.meta.url).href },
  { key: 'laurana-death-south-east-5', url: new URL('../assets/characters/laurana/pixellab/death/south-east/frame-5.png', import.meta.url).href },
  { key: 'laurana-death-south-east-6', url: new URL('../assets/characters/laurana/pixellab/death/south-east/frame-6.png', import.meta.url).href },
  { key: 'laurana-death-north-east-0', url: new URL('../assets/characters/laurana/pixellab/death/north-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-death-north-east-1', url: new URL('../assets/characters/laurana/pixellab/death/north-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-death-north-east-2', url: new URL('../assets/characters/laurana/pixellab/death/north-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-death-north-east-3', url: new URL('../assets/characters/laurana/pixellab/death/north-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-death-north-east-4', url: new URL('../assets/characters/laurana/pixellab/death/north-east/frame-4.png', import.meta.url).href },
  { key: 'laurana-death-north-east-5', url: new URL('../assets/characters/laurana/pixellab/death/north-east/frame-5.png', import.meta.url).href },
  { key: 'laurana-death-north-east-6', url: new URL('../assets/characters/laurana/pixellab/death/north-east/frame-6.png', import.meta.url).href }
];

// PixelLab pads larger canvases symmetrically; each source retains its foot pivot.
const sources = {
  "idle": {
    "frameMs": 110,
    "directions": {
      "south-east": {
        "count": 8,
        "originY": 0.8602941176470589
      },
      "north-east": {
        "count": 8,
        "originY": 0.8602941176470589
      }
    }
  },
  "walk": {
    "frameMs": 75,
    "directions": {
      "south-east": {
        "count": 8,
        "originY": 0.8602941176470589
      },
      "north-east": {
        "count": 8,
        "originY": 0.8602941176470589
      }
    }
  },
  "attack": {
    "frameMs": 70,
    "directions": {
      "south-east": {
        "count": 7,
        "originY": 0.85
      },
      "north-east": {
        "count": 7,
        "originY": 0.85
      }
    }
  },
  "block": {
    "frameMs": 85,
    "directions": {
      "south-east": {
        "count": 5,
        "originY": 0.85
      },
      "north-east": {
        "count": 5,
        "originY": 0.85
      }
    }
  },
  "hit": {
    "frameMs": 55,
    "directions": {
      "south-east": {
        "count": 6,
        "originY": 0.8602941176470589
      },
      "north-east": {
        "count": 6,
        "originY": 0.8602941176470589
      }
    }
  },
  "death": {
    "frameMs": 110,
    "directions": {
      "south-east": {
        "count": 7,
        "originY": 0.8602941176470589
      },
      "north-east": {
        "count": 7,
        "originY": 0.8602941176470589
      }
    }
  }
};
const facing = {
  south: ['south-east', false], 'south-east': ['south-east', false],
  east: ['south-east', false], 'north-east': ['north-east', false],
  north: ['north-east', false], 'north-west': ['north-east', true],
  west: ['south-east', true], 'south-west': ['south-east', true]
};
const clips = Object.fromEntries(Object.entries(sources).map(([state, source]) => [state,
  Object.fromEntries(Object.entries(facing).map(([heading, [direction, flipX]]) => [heading, {
    frameMs: source.frameMs, frames: Array.from({ length: source.directions[direction].count }, (_, index) => ({
      key: `laurana-${state}-${direction}-${index}`, originX: 0.5,
      originY: source.directions[direction].originY, flipX
    }))
  }]))
]));
// A corpse reuses the last death frame, with no extra generation or texture.
clips.dead = Object.fromEntries(Object.entries(clips.death).map(([direction, clip]) =>
  [direction, { frameMs: 1000, frames: [clip.frames.at(-1)] }]));

export const CHARACTER_SPRITES = { laurana: { textures, clips, scale: 1.25, footY: 30 } };

export function preloadCharacterSprites(scene) {
  Object.values(CHARACTER_SPRITES).forEach(definition => {
    definition.textures.forEach(({ key, url }) => {
      if (!scene.textures.exists(key)) scene.load.image(key, url);
    });
  });
}
