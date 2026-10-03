export default {
  id: 'dolmark-den',
  name: 'Dolmark Den',
  mapLabel: 'Dolmark Den',
  subtitle: 'An old den carved into the mountains beyond Duskfall.',
  difficulty: 'Easy', recommendedLevel: 2, depth: 3, type: 'delve',
  possibleDrops: ['Gold', 'Adventurer XP'],
  prerequisites: ['thornbriar-hollow'],
  requiresLocation: 'duskfall',
  map: { x: 0.855, y: 0.205, radius: 0.060 },
  terrain: [],
  visuals: {
    environment: {
      width: 1672, height: 941, offsetY: -105, pixelArt: true,
      floor: { topLeftX: 225, topRightX: 1447, topY: 520,
        bottomLeftX: 323, bottomRightX: 1349, bottomY: 805 },
      layers: [
        { key: 'dolmark-den-pixel-art',
          url: new URL('../../assets/environments/dolmark-den-pixel/den-v2.png', import.meta.url).href,
          depth: -1000 }
      ],
      foreground: {
        sourceKey: 'dolmark-den-pixel-art', depth: 4300,
        polygons: [
          [[0, 437], [65, 467], [92, 519], [111, 550], [100, 600],
            [96, 640], [122, 680], [155, 716], [196, 753], [238, 790],
            [298, 823], [373, 861], [450, 941], [0, 941]],
          [[1672, 450], [1635, 520], [1616, 588], [1603, 639],
            [1570, 678], [1530, 713], [1486, 751], [1440, 768],
            [1390, 784], [1350, 810], [1310, 850], [1240, 903],
            [1200, 941], [1672, 941]]
        ]
      },
      denEffects: {
        lanterns: [
          { x: 170, y: 229, radius: 36 },
          { x: 610, y: 255, radius: 34 },
          { x: 845, y: 370, radius: 27 },
          { x: 1228, y: 463, radius: 28 },
          { x: 1370, y: 246, radius: 35 },
          { x: 1600, y: 151, radius: 36 }
        ],
        fungi: [
          { x: 37, y: 765, radius: 21 },
          { x: 169, y: 763, radius: 15 },
          { x: 1505, y: 782, radius: 19 },
          { x: 1590, y: 818, radius: 17 }
        ]
      }
    }
  }
};
