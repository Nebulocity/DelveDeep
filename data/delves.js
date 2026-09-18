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
        id: 'upper-right-stalagmites',
        type: 'blocked',
        points: [
          { x: 1160, y: 900 },
          { x: 1400, y: 900 },
          { x: 1400, y: 610 },
          { x: 1325, y: 625 },
          { x: 1260, y: 680 },
          { x: 1215, y: 760 }
        ]
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
