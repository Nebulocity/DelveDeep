// This encounter owns its artwork layers, waves and walkable floor outline. The polygon
// points use original artwork pixels. LayeredEnvironment scales and positions them with
// the art, then clips the lower edge above the party HUD. Foreground decoration can cover
// sprites without becoming blocking terrain.

export default {
  id: 'dolmark-den',
  name: 'Dolmark Den',
  mapLabel: 'Dolmark Den',
  subtitle: 'An old den carved into the mountains beyond Duskfall.',
  difficulty: 'Difficult', recommendedLevel: 6, depth: 3, type: 'delve',
  materialEnvironments: ['Caves'],
  prerequisites: ['thornbriar-hollow'],
  requiresLocation: 'duskfall',
  map: { x: 0.855, y: 0.205, radius: 0.060 },
  terrain: [],
  visuals: {
    environment: {
      width: 1672, height: 941, offsetY: -105, pixelArt: true,

      // Keep the rear floor outline; the lower floor continues beneath foreground scenery.
      walkable: [
        [260, 557], [450, 529], [689, 506], [840, 511],
        [1080, 512], [1260, 543], [1394, 567], [1535, 614],
        [1545, 673], [1545, 941], [143, 941], [143, 632],
        [160, 595]
      ],
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
        waterfalls: [
          { x: 208, y: 343, width: 38, height: 89, speed: 37 },
          { x: 335, y: 335, width: 48, height: 82, speed: 43 },
          { x: 397, y: 427, width: 34, height: 55, speed: 35 }
        ],

        waterSurfaces: [
          { x: 208, y: 418, width: 99, height: 33, speed: 10 },
          { x: 308, y: 416, width: 86, height: 46, speed: 13 },
          { x: 382, y: 474, width: 105, height: 32, speed: 9 }
        ],

        lanterns: [
          { x: 170, y: 229, radius: 36 },
          { x: 610, y: 255, radius: 34 },
          { x: 845, y: 370, radius: 27 },
          { x: 1228, y: 463, radius: 28 },

          { x: 1370, y: 246, radius: 35 },
          { x: 1600, y: 151, radius: 36 }
        ],

        candles: [
          { x: 143, y: 320, radius: 19 },
          { x: 327, y: 489, radius: 17 },
          { x: 1127, y: 406, radius: 21 },
          { x: 1295, y: 377, radius: 23 }
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
