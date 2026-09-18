import { createEncounterWaves } from './encounters.js';

// Vite bundles this as an asset URL; Node-based data tests can still load the delve definitions without needing a PNG module loader.
const slimeCaveBackgroundUrl = new URL('../assets/the_slime_cave_bg.png', import.meta.url).href;

const delves = [
  {
    id: 'slime-cave',
    name: 'The Slime Cave',
    mapLabel: 'The Slime Cave',
    subtitle: 'A wet limestone burrow full of hungry slimes.',
    difficulty: 'Easy',
    recommendedLevel: 1,
    depth: 1,
    type: 'delve',
    possibleDrops: ['Gold', 'Healing Tonic', 'Adventurer XP'],
    visuals: {
      battlefieldBackground: {
        key: 'slime-cave-battlefield-background',
        url: slimeCaveBackgroundUrl
      }
    },
    // Terrain uses the battlefield's 1400 x 900 logical coordinates. These points mask the large stalagmite/rock formation in the upper-right of the Slime Cave art. Adjust them freely while tuning the background.
    terrain: [
      {
      "id": "blocked-zone-2",
      "type": "blocked",
      "points": [
        {
          "x": 1228,
          "y": 892
        },
        {
          "x": 1194,
          "y": 842
        },
        {
          "x": 1170,
          "y": 807
        },
        {
          "x": 1148,
          "y": 781
        },
        {
          "x": 1132,
          "y": 743
        },
        {
          "x": 1109,
          "y": 705
        },
        {
          "x": 1090,
          "y": 675
        },
        {
          "x": 1074,
          "y": 658
        },
        {
          "x": 1092,
          "y": 625
        },
        {
          "x": 1128,
          "y": 590
        },
        {
          "x": 1162,
          "y": 581
        },
        {
          "x": 1188,
          "y": 578
        },
        {
          "x": 1224,
          "y": 570
        },
        {
          "x": 1263,
          "y": 558
        },
        {
          "x": 1295,
          "y": 543
        },
        {
          "x": 1322,
          "y": 540
        },
        {
          "x": 1365,
          "y": 540
        },
        {
          "x": 1385,
          "y": 531
        },
        {
          "x": 1397,
          "y": 531
        },
        {
          "x": 1391,
          "y": 889
        }
    ],
    prerequisites: [],
    map: { x: 0.307, y: 0.475, radius: 0.055 }
  },
  {
    id: 'thornbriar-hollow',
    name: 'Thornbriar Hollow',
    mapLabel: 'Thornbriar Hollow',
    subtitle: 'A thorn-choked hollow where the road grows strangely quiet.',
    difficulty: 'Easy',
    recommendedLevel: 1,
    depth: 2,
    type: 'delve',
    possibleDrops: ['Gold', 'Healing Tonic', 'Adventurer XP'],
    prerequisites: ['slime-cave'],
    map: { x: 0.503, y: 0.503, radius: 0.060 }
  },
  {
    id: 'dolmark-den',
    name: 'Dolmark Den',
    mapLabel: 'Dolmark Den',
    subtitle: 'An old den carved into the mountains beyond Duskfall.',
    difficulty: 'Moderate',
    recommendedLevel: 2,
    depth: 3,
    type: 'delve',
    possibleDrops: ['Gold', 'Healing Tonic', 'Adventurer XP'],
    prerequisites: ['thornbriar-hollow'],
    requiresLocation: 'duskfall',
    map: { x: 0.855, y: 0.205, radius: 0.060 }
  },
  {
    id: 'murmuring-abyss',
    name: 'The Murmuring Abyss',
    mapLabel: 'The Murmuring Abyss',
    subtitle: 'A tear in the world. Something on the other side is whispering.',
    difficulty: 'Void',
    recommendedLevel: 2,
    depth: 4,
    type: 'void',
    possibleDrops: ['Void-touched loot', 'Gold', 'Adventurer XP'],
    prerequisites: ['thornbriar-hollow'],
    requiresLocation: 'duskfall',
    requiresVoidKey: true,
    map: { x: 0.885, y: 0.680, radius: 0.075 }
  }
];

// This function looks up a delve definition by its persistent identifier.
export function getDelveById(id) {

  return delves.find((delve) => delve.id === id) ?? null;
}

// Keep overview wave counts aligned with the actual encounter builder.
for (const delve of delves) {
  delve.rooms = createEncounterWaves(delve).length;
}

export default delves;
