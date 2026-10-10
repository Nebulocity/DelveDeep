// Quarry sprite metadata connects the encounter roster to its finished sheets.
// Loading textures does not change saved enemy IDs or combat rules.

// new URL resolves each PNG relative to this file. Vite uses these explicit paths
// to include the texture files when a game screen imports this catalog.
const sheets = {
  quarryWorm: [
    new URL('../assets/enemies/old-quarry/quarryWorm/sheets/facing.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryWorm/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryWorm/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryWorm/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryWorm/sheets/cast.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryWorm/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryWorm/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryWorm/sheets/death.png', import.meta.url).href,
  ],
  quarryBehemoth: [
    new URL('../assets/enemies/old-quarry/quarryBehemoth/sheets/facing.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryBehemoth/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryBehemoth/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryBehemoth/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryBehemoth/sheets/cast.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryBehemoth/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryBehemoth/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryBehemoth/sheets/death.png', import.meta.url).href,
  ],
  quarryReaver: [
    new URL('../assets/enemies/old-quarry/quarryReaver/sheets/facing.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryReaver/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryReaver/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryReaver/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryReaver/sheets/cast.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryReaver/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryReaver/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/quarryReaver/sheets/death.png', import.meta.url).href,
  ],
  depthsSovereign: [
    new URL('../assets/enemies/old-quarry/depthsSovereign/sheets/facing.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/depthsSovereign/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/depthsSovereign/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/depthsSovereign/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/depthsSovereign/sheets/cast.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/depthsSovereign/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/depthsSovereign/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/old-quarry/depthsSovereign/sheets/death.png', import.meta.url).href,
  ],
};

// Counts and anchors come from the finished sheets. Coordinates are fractions of
// one 256 pixel cell; the origin is the point placed on the battlefield floor.
const layouts = {
  "quarryWorm": {
    "id": "quarryWorm",
    "name": "Quarry Worm",
    "frameWidth": 256,
    "frameHeight": 256,
    "directions": [
      "south-east",
      "south-west",
      "north-east",
      "north-west"
    ],
    "scale": 1.35,
    "footY": 0,
    "origins": {
      "south-east": {
        "x": 0.5,
        "y": 0.73828125
      },
      "south-west": {
        "x": 0.5,
        "y": 0.75
      },
      "north-east": {
        "x": 0.5,
        "y": 0.78515625
      },
      "north-west": {
        "x": 0.5,
        "y": 0.78515625
      }
    },
    "states": {
      "facing": {
        "frameMs": 1000,
        "loop": false,
        "file": "facing.png",
        "columns": 1,
        "counts": {
          "south-east": 1,
          "south-west": 1,
          "north-east": 1,
          "north-west": 1
        }
      },
      "idle": {
        "frameMs": 150,
        "loop": true,
        "file": "idle.png",
        "columns": 4,
        "counts": {
          "south-east": 4,
          "south-west": 4,
          "north-east": 4,
          "north-west": 4
        }
      },
      "walk": {
        "frameMs": 85,
        "loop": true,
        "file": "walk.png",
        "columns": 8,
        "counts": {
          "south-east": 8,
          "south-west": 8,
          "north-east": 8,
          "north-west": 8
        }
      },
      "attack": {
        "frameMs": 85,
        "loop": false,
        "file": "attack.png",
        "columns": 9,
        "counts": {
          "south-east": 9,
          "south-west": 9,
          "north-east": 9,
          "north-west": 9
        }
      },
      "cast": {
        "frameMs": 95,
        "loop": false,
        "file": "cast.png",
        "columns": 9,
        "counts": {
          "south-east": 9,
          "south-west": 9,
          "north-east": 9,
          "north-west": 9
        }
      },
      "block": {
        "frameMs": 85,
        "loop": false,
        "file": "block.png",
        "columns": 5,
        "counts": {
          "south-east": 5,
          "south-west": 5,
          "north-east": 5,
          "north-west": 5
        }
      },
      "hit": {
        "frameMs": 65,
        "loop": false,
        "file": "hit.png",
        "columns": 5,
        "counts": {
          "south-east": 5,
          "south-west": 5,
          "north-east": 5,
          "north-west": 5
        }
      },
      "death": {
        "frameMs": 110,
        "loop": false,
        "file": "death.png",
        "columns": 9,
        "counts": {
          "south-east": 9,
          "south-west": 9,
          "north-east": 9,
          "north-west": 9
        }
      }
    },
    "effects": [
      "groundSpike",
      "rockProjectile",
      "rockImpact"
    ]
  },
  "quarryBehemoth": {
    "id": "quarryBehemoth",
    "name": "Quarry Behemoth",
    "frameWidth": 256,
    "frameHeight": 256,
    "directions": [
      "south-east",
      "south-west",
      "north-east",
      "north-west"
    ],
    "scale": 1.6,
    "footY": 0,
    "origins": {
      "south-east": {
        "x": 0.5,
        "y": 0.75
      },
      "south-west": {
        "x": 0.5,
        "y": 0.75
      },
      "north-east": {
        "x": 0.5,
        "y": 0.75390625
      },
      "north-west": {
        "x": 0.5,
        "y": 0.7421875
      }
    },
    "states": {
      "facing": {
        "frameMs": 1000,
        "loop": false,
        "file": "facing.png",
        "columns": 1,
        "counts": {
          "south-east": 1,
          "south-west": 1,
          "north-east": 1,
          "north-west": 1
        }
      },
      "idle": {
        "frameMs": 150,
        "loop": true,
        "file": "idle.png",
        "columns": 4,
        "counts": {
          "south-east": 4,
          "south-west": 4,
          "north-east": 4,
          "north-west": 4
        }
      },
      "walk": {
        "frameMs": 85,
        "loop": true,
        "file": "walk.png",
        "columns": 8,
        "counts": {
          "south-east": 8,
          "south-west": 8,
          "north-east": 8,
          "north-west": 8
        }
      },
      "attack": {
        "frameMs": 85,
        "loop": false,
        "file": "attack.png",
        "columns": 9,
        "counts": {
          "south-east": 9,
          "south-west": 9,
          "north-east": 9,
          "north-west": 9
        }
      },
      "cast": {
        "frameMs": 95,
        "loop": false,
        "file": "cast.png",
        "columns": 9,
        "counts": {
          "south-east": 9,
          "south-west": 9,
          "north-east": 9,
          "north-west": 9
        }
      },
      "block": {
        "frameMs": 85,
        "loop": false,
        "file": "block.png",
        "columns": 5,
        "counts": {
          "south-east": 5,
          "south-west": 5,
          "north-east": 5,
          "north-west": 5
        }
      },
      "hit": {
        "frameMs": 65,
        "loop": false,
        "file": "hit.png",
        "columns": 5,
        "counts": {
          "south-east": 5,
          "south-west": 5,
          "north-east": 5,
          "north-west": 5
        }
      },
      "death": {
        "frameMs": 110,
        "loop": false,
        "file": "death.png",
        "columns": 9,
        "counts": {
          "south-east": 9,
          "south-west": 9,
          "north-east": 9,
          "north-west": 9
        }
      }
    },
    "effects": [
      "rockProjectile",
      "rockImpact"
    ]
  },
  "quarryReaver": {
    "id": "quarryReaver",
    "name": "Quarry Reaver",
    "frameWidth": 256,
    "frameHeight": 256,
    "directions": [
      "south-east",
      "south-west",
      "north-east",
      "north-west"
    ],
    "scale": 1.55,
    "footY": 0,
    "origins": {
      "south-east": {
        "x": 0.5,
        "y": 0.80078125
      },
      "south-west": {
        "x": 0.5,
        "y": 0.80078125
      },
      "north-east": {
        "x": 0.5,
        "y": 0.8125
      },
      "north-west": {
        "x": 0.5,
        "y": 0.8125
      }
    },
    "states": {
      "facing": {
        "frameMs": 1000,
        "loop": false,
        "file": "facing.png",
        "columns": 1,
        "counts": {
          "south-east": 1,
          "south-west": 1,
          "north-east": 1,
          "north-west": 1
        }
      },
      "idle": {
        "frameMs": 150,
        "loop": true,
        "file": "idle.png",
        "columns": 4,
        "counts": {
          "south-east": 4,
          "south-west": 4,
          "north-east": 4,
          "north-west": 4
        }
      },
      "walk": {
        "frameMs": 85,
        "loop": true,
        "file": "walk.png",
        "columns": 8,
        "counts": {
          "south-east": 8,
          "south-west": 8,
          "north-east": 8,
          "north-west": 8
        }
      },
      "attack": {
        "frameMs": 85,
        "loop": false,
        "file": "attack.png",
        "columns": 9,
        "counts": {
          "south-east": 9,
          "south-west": 9,
          "north-east": 9,
          "north-west": 9
        }
      },
      "cast": {
        "frameMs": 95,
        "loop": false,
        "file": "cast.png",
        "columns": 9,
        "counts": {
          "south-east": 9,
          "south-west": 9,
          "north-east": 9,
          "north-west": 9
        }
      },
      "block": {
        "frameMs": 85,
        "loop": false,
        "file": "block.png",
        "columns": 5,
        "counts": {
          "south-east": 5,
          "south-west": 5,
          "north-east": 5,
          "north-west": 5
        }
      },
      "hit": {
        "frameMs": 65,
        "loop": false,
        "file": "hit.png",
        "columns": 5,
        "counts": {
          "south-east": 5,
          "south-west": 5,
          "north-east": 5,
          "north-west": 5
        }
      },
      "death": {
        "frameMs": 110,
        "loop": false,
        "file": "death.png",
        "columns": 9,
        "counts": {
          "south-east": 9,
          "south-west": 9,
          "north-east": 9,
          "north-west": 9
        }
      }
    },
    "effects": [
      "crystalProjectile",
      "crystalImpact"
    ]
  },
  "depthsSovereign": {
    "id": "depthsSovereign",
    "name": "Depths Sovereign",
    "frameWidth": 256,
    "frameHeight": 256,
    "directions": [
      "south-east",
      "south-west",
      "north-east",
      "north-west"
    ],
    "scale": 2,
    "footY": 0,
    "origins": {
      "south-east": {
        "x": 0.5,
        "y": 0.80078125
      },
      "south-west": {
        "x": 0.5,
        "y": 0.80078125
      },
      "north-east": {
        "x": 0.5,
        "y": 0.8125
      },
      "north-west": {
        "x": 0.5,
        "y": 0.8125
      }
    },
    "states": {
      "facing": {
        "frameMs": 1000,
        "loop": false,
        "file": "facing.png",
        "columns": 1,
        "counts": {
          "south-east": 1,
          "south-west": 1,
          "north-east": 1,
          "north-west": 1
        }
      },
      "idle": {
        "frameMs": 150,
        "loop": true,
        "file": "idle.png",
        "columns": 4,
        "counts": {
          "south-east": 4,
          "south-west": 4,
          "north-east": 4,
          "north-west": 4
        }
      },
      "walk": {
        "frameMs": 85,
        "loop": true,
        "file": "walk.png",
        "columns": 8,
        "counts": {
          "south-east": 8,
          "south-west": 8,
          "north-east": 8,
          "north-west": 8
        }
      },
      "attack": {
        "frameMs": 85,
        "loop": false,
        "file": "attack.png",
        "columns": 9,
        "counts": {
          "south-east": 9,
          "south-west": 9,
          "north-east": 9,
          "north-west": 9
        }
      },
      "cast": {
        "frameMs": 95,
        "loop": false,
        "file": "cast.png",
        "columns": 9,
        "counts": {
          "south-east": 9,
          "south-west": 9,
          "north-east": 9,
          "north-west": 9
        }
      },
      "block": {
        "frameMs": 85,
        "loop": false,
        "file": "block.png",
        "columns": 5,
        "counts": {
          "south-east": 5,
          "south-west": 5,
          "north-east": 5,
          "north-west": 5
        }
      },
      "hit": {
        "frameMs": 65,
        "loop": false,
        "file": "hit.png",
        "columns": 5,
        "counts": {
          "south-east": 5,
          "south-west": 5,
          "north-east": 5,
          "north-west": 5
        }
      },
      "death": {
        "frameMs": 110,
        "loop": false,
        "file": "death.png",
        "columns": 9,
        "counts": {
          "south-east": 9,
          "south-west": 9,
          "north-east": 9,
          "north-west": 9
        }
      }
    },
    "effects": [
      "stoneEruption"
    ]
  }
};

// Eight movement headings share four authored diagonal rows. We choose the
// nearest view without mirroring the creature or its asymmetric equipment.
const rows = { south: 0, 'south-east': 0, east: 0, 'south-west': 1, west: 1,
  north: 2, 'north-east': 2, 'north-west': 3 };

// Build the same texture and clip shape used by the existing combat sprites.
function createSprite(id, urls) {
  const layout = layouts[id];
  const states = Object.keys(layout.states);

  // map visits each sheet URL in state order and returns its Phaser load settings.
  const textures = urls.map((url, index) => ({
    key: `${id}-${states[index]}`, url, frameWidth: layout.frameWidth,
    frameHeight: layout.frameHeight
  }));
  const clips = {};

  // Object.entries gives each state name beside its frame count and timing.
  for (const [state, settings] of Object.entries(layout.states)) {
    clips[state] = {};
    for (const [direction, row] of Object.entries(rows)) {
      const facing = layout.directions[row];
      const origin = layout.origins[facing];
      clips[state][direction] = {
        frameMs: settings.frameMs,

        // Phaser numbers a sheet from left to right, then starts the next row.
        // Use the playable count rather than padded cells at the row end.
        // Array.from creates one entry per cell. _ is an unused value parameter;
        // column is the zero-based index we need to calculate each frame number.
        frames: Array.from({ length: settings.counts[facing] }, (_, column) => ({
          key: `${id}-${state}`, frame: row * settings.columns + column,
          originX: origin.x, originY: origin.y, flipX: false
        }))
      };
    }
  }

  // dead holds the final death pose instead of starting the death clip again.
  clips.dead = Object.fromEntries(Object.entries(clips.death).map(([direction, clip]) => [
    direction, { frameMs: 1000, frames: [clip.frames.at(-1)] }
  ]));
  return { textures, clips, scale: layout.scale, footY: layout.footY };
}

export const QUARRY_SPRITES = Object.fromEntries(
  Object.entries(sheets).map(([id, urls]) => [id, createSprite(id, urls)])
);

// Effects use separate sheets so a projectile can travel independently of its caster.
// The ... in each entry copies its layout fields beside the texture key and URL.
export const QUARRY_EFFECTS = {
  crystalImpact: {
    key: 'quarry-crystalImpact',
    url: new URL('../assets/enemies/old-quarry/effects/crystalImpact.png', import.meta.url).href,
    frameWidth: 256, frameHeight: 256,
    ...{"file": "crystalImpact.png", "columns": 9, "count": 9, "frameMs": 90, "loop": false, "origin": {"x": 0.5, "y": 0.75}, "direction": null}
  },
  crystalProjectile: {
    key: 'quarry-crystalProjectile',
    url: new URL('../assets/enemies/old-quarry/effects/crystalProjectile.png', import.meta.url).href,
    frameWidth: 256, frameHeight: 256,
    ...{"file": "crystalProjectile.png", "columns": 8, "count": 8, "frameMs": 75, "loop": true, "origin": {"x": 0.5, "y": 0.5}, "direction": "east"}
  },
  groundSpike: {
    key: 'quarry-groundSpike',
    url: new URL('../assets/enemies/old-quarry/effects/groundSpike.png', import.meta.url).href,
    frameWidth: 256, frameHeight: 256,
    ...{"file": "groundSpike.png", "columns": 7, "count": 7, "frameMs": 90, "loop": false, "origin": {"x": 0.5, "y": 0.75}, "direction": null}
  },
  rockImpact: {
    key: 'quarry-rockImpact',
    url: new URL('../assets/enemies/old-quarry/effects/rockImpact.png', import.meta.url).href,
    frameWidth: 256, frameHeight: 256,
    ...{"file": "rockImpact.png", "columns": 9, "count": 9, "frameMs": 90, "loop": false, "origin": {"x": 0.5, "y": 0.75}, "direction": null}
  },
  rockProjectile: {
    key: 'quarry-rockProjectile',
    url: new URL('../assets/enemies/old-quarry/effects/rockProjectile.png', import.meta.url).href,
    frameWidth: 256, frameHeight: 256,
    ...{"file": "rockProjectile.png", "columns": 5, "count": 5, "frameMs": 75, "loop": true, "origin": {"x": 0.5, "y": 0.5}, "direction": "east"}
  },
  stoneEruption: {
    key: 'quarry-stoneEruption',
    url: new URL('../assets/enemies/old-quarry/effects/stoneEruption.png', import.meta.url).href,
    frameWidth: 256, frameHeight: 256,
    ...{"file": "stoneEruption.png", "columns": 8, "count": 8, "frameMs": 90, "loop": false, "origin": {"x": 0.5, "y": 0.75}, "direction": null}
  },
};

// Call this from a Phaser preload step when Quarry enemies are added to an encounter.
export function preloadQuarrySprites(scene) {

  // flatMap joins each enemy texture list into one list; effects need loading too.
  const textures = Object.values(QUARRY_SPRITES).flatMap(sprite => sprite.textures);
  textures.push(...Object.values(QUARRY_EFFECTS));
  for (const { key, url, frameWidth, frameHeight } of textures) {
    if (!scene.textures.exists(key)) {
      scene.load.spritesheet(key, url, { frameWidth, frameHeight });
    }
  }
}
