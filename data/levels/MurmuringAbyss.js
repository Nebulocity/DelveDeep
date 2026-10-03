export default {
  id: 'murmuring-abyss',
  name: 'The Murmuring Abyss',
  mapLabel: 'The Murmuring Abyss',
  subtitle: 'A tear in the world. Something on the other side is whispering.',
  difficulty: 'Unknown', recommendedLevel: 2, depth: 4, type: 'void',
  possibleDrops: ['Gold', 'Adventurer XP'],
  prerequisites: ['thornbriar-hollow'],
  requiresLocation: 'duskfall',
  map: { x: 0.885, y: 0.680, radius: 0.075 },
  terrain: [],
  visuals: {
    environment: {
      width: 1672, height: 941, offsetY: -40, pixelArt: true,
      floor: { topLeftX: 255, topRightX: 1417, topY: 490,
        bottomLeftX: 286, bottomRightX: 1386, bottomY: 764 },
      layers: [
        { key: 'murmuring-abyss-pixel-art',
          url: new URL('../../assets/environments/murmuring-abyss-pixel/portal.png', import.meta.url).href,
          depth: -1000 }
      ],
      foreground: {
        sourceKey: 'murmuring-abyss-pixel-art', depth: 4300,
        polygons: [
          [[0, 658], [32, 642], [60, 697], [115, 717], [145, 750],
            [210, 772], [286, 836], [350, 858], [414, 941], [0, 941]],
          [[1672, 665], [1628, 624], [1585, 706], [1536, 724],
            [1490, 769], [1434, 792], [1360, 846], [1278, 941], [1672, 941]]
        ]
      },
      voidEffects: {
        portal: { x: 836, y: 231, radiusX: 251, radiusY: 207, particles: 30 },
        clouds: [
          { x: 507, y: 159, width: 164, height: 49, phase: 0 },
          { x: 1160, y: 145, width: 178, height: 53, phase: 1.7 },
          { x: 548, y: 321, width: 116, height: 36, phase: 3.1 },
          { x: 1126, y: 319, width: 126, height: 39, phase: 4.6 }
        ],
        flames: [
          { x: 46, y: 285, size: 38 },
          { x: 1627, y: 281, size: 41 },
          { x: 141, y: 408, size: 26 },
          { x: 1519, y: 412, size: 27 }
        ],
        lightning: [
          { startX: 336, startY: 43, endX: 534, endY: 184 },
          { startX: 1337, startY: 40, endX: 1158, endY: 180 },
          { startX: 627, startY: 41, endX: 697, endY: 149 },
          { startX: 1053, startY: 37, endX: 1004, endY: 144 }
        ]
      }
    }
  }
};
