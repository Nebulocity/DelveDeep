// Camera-space pixels from the chibi pixel cave concept.
// Keeping the world ID preserves progression and existing saved unlocks.
export default {
  id: 'slime-cave',
  name: 'The Slime Cave',
  mapLabel: 'The Slime Cave',
  subtitle: 'A damp, abandoned cave consumed by living slime.',
  difficulty: 'Easy', recommendedLevel: 1, depth: 1, type: 'delve',
  possibleDrops: ['Gold', 'Adventurer XP'],
  prerequisites: [],
  map: { x: 0.307, y: 0.475, radius: 0.055 },
  // The grid stays on the open floor; image details do not block combat movement.
  terrain: [],
  visuals: {
    environment: {
      width: 1672, height: 941, offsetY: -105, pixelArt: true,
      floor: { topLeftX: 310, topRightX: 1362, topY: 570,
        bottomLeftX: 265, bottomRightX: 1407, bottomY: 825 },
      layers: [
        { key: 'slime-cave-pixel-art',
          url: new URL('../../assets/environments/slime-cave-pixel/cave.png', import.meta.url).href,
          depth: -1000 }
      ],
      foreground: {
        sourceKey: 'slime-cave-pixel-art', depth: 4300,
        polygons: [
          [[0, 689], [62, 690], [110, 712], [170, 748], [244, 762], [290, 777],
            [345, 789], [390, 771], [420, 791], [483, 779], [520, 796], [585, 761],
            [629, 770], [666, 822], [704, 903], [731, 941], [0, 941]],
          [[697, 941], [754, 866], [797, 811], [832, 831], [883, 774], [911, 761],
            [936, 807], [956, 854], [1030, 888], [1081, 941]],
          [[1672, 639], [1607, 655], [1560, 665], [1521, 702], [1476, 706],
            [1433, 731], [1391, 791], [1336, 781], [1277, 786], [1210, 814],
            [1159, 849], [1081, 941], [1672, 941]]
        ]
      },
      pixelEffects: {
        crystals: [
          { x: 209, y: 274, color: 0xc878f5, size: 2 },
          { x: 284, y: 390, color: 0xdb81ff, size: 2, speed: 1.1 },
          { x: 1380, y: 299, color: 0xd778f9, size: 2, speed: 1.7 },
          { x: 1490, y: 379, color: 0xee9dff, size: 2, speed: 1.2 },
          { x: 1417, y: 595, color: 0xd87aff, size: 2, speed: 1.6 },
          { x: 394, y: 410, color: 0xe38aff, size: 2, speed: 1.25 },
          { x: 1296, y: 248, color: 0xd579f6, size: 2, speed: 1.55 }
        ],
        pools: [
          { x: 304, y: 553, width: 132, color: 0xbaff4a, bubbles: 4 },
          { x: 601, y: 533, width: 170, color: 0xadff43, bubbles: 5 },
          { x: 1068, y: 533, width: 180, color: 0xbaff4a, bubbles: 5 },
          { x: 1434, y: 607, width: 68, color: 0xadff43, bubbles: 4 }
        ],
        rockSlime: [
          { x: 139, y: 701, width: 25, height: 17, color: 0x719c38, depth: 4310 },
          { x: 565, y: 783, width: 31, height: 21, color: 0x719c38, depth: 4310, speed: 0.95 },
          { x: 1446, y: 745, width: 27, height: 20, color: 0x719c38, depth: 4310, speed: 1.4 },
          { x: 1197, y: 518, width: 19, height: 12, color: 0x81b940, speed: 1.65 }
        ],
        mushrooms: [
          { x: 384, y: 464, width: 52, period: 6.8 },
          { x: 420, y: 491, width: 32, period: 8.1 },
          { x: 1318, y: 424, width: 62, period: 7.5 },
          { x: 1340, y: 480, width: 35, period: 9.2 }
        ]
      }
    }
  }
};
