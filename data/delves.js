const delves = [
  {
    id: 'slime-cave',
    name: 'The Slime Cave',
    mapLabel: 'The Slime Cave',
    subtitle: 'A wet limestone burrow full of hungry slimes.',
    difficulty: 'Easy',
    recommendedLevel: 1,
    depth: 1,
    rooms: 3,
    type: 'delve',
    possibleDrops: ['Gold', 'Healing Tonic', 'Adventurer XP'],
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
    rooms: 3,
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
    rooms: 3,
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
    rooms: 3,
    type: 'void',
    possibleDrops: ['Void-touched loot', 'Gold', 'Adventurer XP'],
    prerequisites: ['thornbriar-hollow'],
    requiresLocation: 'duskfall',
    requiresVoidKey: true,
    map: { x: 0.885, y: 0.680, radius: 0.075 }
  }
];

export function getDelveById(id) {
  return delves.find((delve) => delve.id === id) ?? null;
}

export default delves;
