// Baaz uses four authored facings and a petrification death sequence. Each cell is
// 256 pixels; playable counts exclude the padded cell in the south-east attack row.
const urls = [
  new URL('../assets/enemies/baaz-draconian/reference-v2/sheets/facing.png', import.meta.url).href,
  new URL('../assets/enemies/baaz-draconian/reference-v2/sheets/idle.png', import.meta.url).href,
  new URL('../assets/enemies/baaz-draconian/reference-v2/sheets/walk.png', import.meta.url).href,
  new URL('../assets/enemies/baaz-draconian/reference-v2/sheets/attack.png', import.meta.url).href,
  new URL('../assets/enemies/baaz-draconian/reference-v2/sheets/block.png', import.meta.url).href,
  new URL('../assets/enemies/baaz-draconian/reference-v2/sheets/hit.png', import.meta.url).href,
  new URL('../assets/enemies/baaz-draconian/reference-v2/sheets/death.png', import.meta.url).href
];

// These counts, timings and ground anchors come from the accepted sheet layout.
const layout = {
  "frameWidth": 256,
  "frameHeight": 256,
  "directions": [
    "south-east",
    "south-west",
    "north-east",
    "north-west"
  ],
  "origins": {
    "south-east": {
      "x": 0.5,
      "y": 0.8984375
    },
    "south-west": {
      "x": 0.5,
      "y": 0.8984375
    },
    "north-east": {
      "x": 0.5,
      "y": 0.8828125
    },
    "north-west": {
      "x": 0.5,
      "y": 0.8828125
    }
  },
  "states": {
    "facing": {
      "columns": 1,
      "counts": {
        "south-east": 1,
        "south-west": 1,
        "north-east": 1,
        "north-west": 1
      },
      "frameMs": 1000,
      "loop": false
    },
    "idle": {
      "columns": 4,
      "counts": {
        "south-east": 4,
        "south-west": 4,
        "north-east": 4,
        "north-west": 4
      },
      "frameMs": 150,
      "loop": true
    },
    "walk": {
      "columns": 8,
      "counts": {
        "south-east": 8,
        "south-west": 8,
        "north-east": 8,
        "north-west": 8
      },
      "frameMs": 75,
      "loop": true
    },
    "attack": {
      "columns": 8,
      "counts": {
        "south-east": 7,
        "south-west": 8,
        "north-east": 8,
        "north-west": 8
      },
      "frameMs": 70,
      "loop": false
    },
    "block": {
      "columns": 5,
      "counts": {
        "south-east": 5,
        "south-west": 5,
        "north-east": 5,
        "north-west": 5
      },
      "frameMs": 85,
      "loop": false
    },
    "hit": {
      "columns": 5,
      "counts": {
        "south-east": 5,
        "south-west": 5,
        "north-east": 5,
        "north-west": 5
      },
      "frameMs": 60,
      "loop": false
    },
    "death": {
      "columns": 9,
      "counts": {
        "south-east": 9,
        "south-west": 9,
        "north-east": 9,
        "north-west": 9
      },
      "frameMs": 110,
      "loop": false
    }
  }
};
const rows = { south: 0, 'south-east': 0, east: 0, 'south-west': 1, west: 1,
  north: 2, 'north-east': 2, 'north-west': 3 };
const textures = Object.keys(layout.states).map((state, index) => ({
  key: 'baazDraconian-' + state, url: urls[index], frameWidth: 256, frameHeight: 256
}));
const clips = {};

// Build eight game headings from four supplied views without mirroring equipment.
for (const [state, settings] of Object.entries(layout.states)) {
  clips[state] = {};
  for (const [direction, row] of Object.entries(rows)) {
    const facing = layout.directions[row];
    const origin = layout.origins[facing];
    clips[state][direction] = {
      frameMs: settings.frameMs,

      // Phaser numbers cells left to right, then continues onto the next row.
      // Array.from makes one frame entry for each playable cell in this facing.
      frames: Array.from({ length: settings.counts[facing] }, (_, column) => ({
        key: 'baazDraconian-' + state, frame: row * settings.columns + column,
        originX: origin.x, originY: origin.y, flipX: false
      }))
    };
  }
}

// Keep the last stone pose available for the shared monster death presentation.
clips.dead = Object.fromEntries(Object.entries(clips.death).map(([direction, clip]) => [
  direction, { frameMs: 1000, frames: [clip.frames.at(-1)] }
]));
export const BAAZ_SPRITES = { baazDraconian: { textures, clips, scale: 1.05, footY: 0 } };
