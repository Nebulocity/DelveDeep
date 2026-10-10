// Finished sheets and exported timing/offsets are all the game needs to play these effects.

export const SUPPLIED_EFFECT_PACKS = [
  {
    "frames": 9,
    "name": "Back Alley Cut",
    "groundWidth": 65,
    "clips": [
      {
        "y": -23,
        "width": 44,
        "start": 1,
        "loop": false,
        "frames": 3,
        "depth": "front",
        "name": "part-cut_slash",
        "x": -17,
        "height": 42
      },
      {
        "y": -24,
        "width": 50,
        "start": 3,
        "loop": false,
        "frames": 3,
        "depth": "front",
        "name": "part-cut_hit",
        "x": -24,
        "height": 46
      },
      {
        "y": -19,
        "width": 41,
        "start": 4,
        "loop": false,
        "frames": 4,
        "depth": "front",
        "name": "part-cut_blood",
        "x": -6,
        "height": 48
      }
    ],
    "id": "back-alley-cut",
    "frameMs": 63
  },
  {
    "frames": 24,
    "name": "Eclipse Field",
    "groundWidth": 144,
    "clips": [
      {
        "y": -28,
        "width": 144,
        "start": 0,
        "loop": true,
        "frames": 24,
        "depth": "behind",
        "name": "part-sigil",
        "x": -72,
        "height": 56
      },
      {
        "y": -62,
        "width": 42,
        "start": 0,
        "loop": true,
        "frames": 24,
        "depth": "both",
        "name": "part-aura",
        "x": -21,
        "height": 73
      }
    ],
    "id": "eclipse-field",
    "frameMs": 33
  },
  {
    "frames": 24,
    "name": "ExplodingArrow_Arrow",
    "groundWidth": 120,
    "clips": [
      {
        "y": -22,
        "width": 88,
        "start": 0,
        "loop": false,
        "frames": 22,
        "depth": "both",
        "name": "whole",
        "x": -53,
        "height": 36
      }
    ],
    "id": "explodingarrow-arrow",
    "frameMs": 33
  },
  {
    "frames": 24,
    "name": "ExplodingArrow_Explosion",
    "groundWidth": 96,
    "clips": [
      {
        "y": -38,
        "width": 76,
        "start": 0,
        "loop": false,
        "frames": 21,
        "depth": "both",
        "name": "whole",
        "x": -38,
        "height": 85
      }
    ],
    "id": "explodingarrow-explosion",
    "frameMs": 33
  },
  {
    "frames": 24,
    "name": "Gloomburst",
    "groundWidth": 110,
    "clips": [
      {
        "y": -52,
        "width": 99,
        "start": 0,
        "loop": false,
        "frames": 19,
        "depth": "behind",
        "name": "part-gloom_burst",
        "x": -47,
        "height": 107
      },
      {
        "y": -52,
        "width": 110,
        "start": 0,
        "loop": false,
        "frames": 24,
        "depth": "front",
        "name": "part-gloom_motes",
        "x": -54,
        "height": 110
      }
    ],
    "id": "gloomburst",
    "frameMs": 56
  },
  {
    "frames": 24,
    "name": "Hunter's Mark",
    "groundWidth": 48,
    "clips": [
      {
        "y": -38,
        "width": 42,
        "start": 0,
        "loop": true,
        "frames": 24,
        "depth": "both",
        "name": "whole",
        "x": -21,
        "height": 48
      }
    ],
    "id": "hunter-s-mark",
    "frameMs": 40
  },
  {
    "frames": 24,
    "name": "Nightbolt",
    "groundWidth": 54,
    "clips": [
      {
        "y": -9,
        "width": 51,
        "start": 0,
        "loop": true,
        "frames": 24,
        "depth": "front",
        "name": "part-magic_orb",
        "x": -41,
        "height": 19
      }
    ],
    "id": "nightbolt",
    "frameMs": 40
  },
  {
    "frames": 24,
    "name": "Sanctity Nova",
    "groundWidth": 160,
    "clips": [
      {
        "y": -31,
        "width": 82,
        "start": 0,
        "loop": false,
        "frames": 24,
        "depth": "both",
        "name": "part-shield_break",
        "x": -42,
        "height": 100
      },
      {
        "y": -34,
        "width": 58,
        "start": 9,
        "loop": false,
        "frames": 8,
        "depth": "front",
        "name": "part-flash_burst",
        "x": -31,
        "height": 64
      },
      {
        "y": -87,
        "width": 160,
        "start": 9,
        "loop": false,
        "frames": 14,
        "depth": "front",
        "name": "part-spark_burst",
        "x": -83,
        "height": 171
      }
    ],
    "id": "sanctity-nova",
    "frameMs": 63
  },
  {
    "frames": 10,
    "name": "Smoke Bomb",
    "groundWidth": 128,
    "clips": [
      {
        "y": -58,
        "width": 122,
        "start": 0,
        "loop": false,
        "frames": 9,
        "depth": "behind",
        "name": "part-smoke_poof",
        "x": -65,
        "height": 94
      }
    ],
    "id": "smoke-bomb",
    "frameMs": 83
  },
  {
    "frames": 24,
    "name": "Sunbrand Strike",
    "groundWidth": 76,
    "clips": [
      {
        "y": -40,
        "width": 70,
        "start": 0,
        "loop": false,
        "frames": 23,
        "depth": "front",
        "name": "part-sword",
        "x": -14,
        "height": 93
      },
      {
        "y": -20,
        "width": 63,
        "start": 5,
        "loop": false,
        "frames": 15,
        "depth": "both",
        "name": "part-strike",
        "x": -7,
        "height": 57
      }
    ],
    "id": "sunbrand-strike",
    "frameMs": 38
  },
  {
    "frames": 10,
    "name": "Surprise Attack",
    "groundWidth": 86,
    "clips": [
      {
        "y": -44,
        "width": 75,
        "start": 0,
        "loop": false,
        "frames": 5,
        "depth": "behind",
        "name": "part-emerge",
        "x": -36,
        "height": 66
      },
      {
        "y": -40,
        "width": 79,
        "start": 3,
        "loop": false,
        "frames": 4,
        "depth": "front",
        "name": "part-strike",
        "x": -37,
        "height": 87
      },
      {
        "y": -14,
        "width": 41,
        "start": 4,
        "loop": false,
        "frames": 5,
        "depth": "front",
        "name": "part-sparks",
        "x": -38,
        "height": 36
      }
    ],
    "id": "surprise-attack",
    "frameMs": 83
  }
];
