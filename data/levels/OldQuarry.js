// Reuse Dolmark's material pool with the Quarry's own difficulty and underground art.
// The world map keeps its older ID so checkpoints and saved travel remain compatible.
import dolmarkDen from './DolmarkDen.js';

export default {
  ...dolmarkDen,
  id: 'old-quarry',
  name: 'The Old Quarry',
  mapLabel: 'The Old Quarry',
  subtitle: 'An abandoned excavation haunted by creatures of stone and crystal.',
  difficulty: 'Very Tough', recommendedLevel: 15,
  bossPreparation: { level: 20, gearRarity: 'common', abilityCount: 3, abilityRank: 3 },
  prerequisites: ['dolmark-den'],
  visuals: {
    environment: {

      // A smaller upward offset keeps the lantern flames below the top banner.
      width: 1672, height: 941, offsetY: -25, pixelArt: false,

      // Coordinates are pixels in chamber.png. Trace the rough floor in front of the
      // equipment, then extend it under decorative near rocks until the HUD clips it.
      walkable: [
        [115, 375], [300, 336], [490, 310], [690, 302], [850, 305],
        [1030, 322], [1240, 339], [1440, 374], [1570, 418],
        [1585, 941], [90, 941], [90, 430]
      ],
      layers: [
        { key: 'old-quarry-chamber',
          url: new URL('../../assets/environments/old-quarry-pixel/chamber.png', import.meta.url).href,
          depth: -1000 }
      ],

      // Reuse exactly aligned pieces of the approved image above character sprites.
      // These corner rocks hide feet without blocking the continuous floor below them.
      foreground: {
        sourceKey: 'old-quarry-chamber', depth: 4300,
        polygons: [
          [[0, 518], [82, 531], [100, 581], [148, 595], [193, 643],
            [222, 683], [283, 716], [310, 760], [380, 785], [419, 830],
            [503, 862], [548, 914], [575, 941], [0, 941]],
          [[1672, 552], [1640, 556], [1625, 631], [1530, 651],
            [1462, 688], [1440, 745], [1371, 766], [1330, 816],
            [1257, 839], [1200, 886], [1140, 922], [1090, 941], [1672, 941]]
        ]
      },
      quarryEffects: {

        // Each center sits inside one painted lantern, with radius in artwork pixels.
        lanterns: [
          { x: 200, y: 130, radius: 62 }, { x: 615, y: 164, radius: 58 },
          { x: 1075, y: 179, radius: 61 }, { x: 1495, y: 144, radius: 63 }
        ],

        // Small polygons follow the visible teal mineral faces, rather than washing
        // an entire wall with light. Nearby halos pulse with each matching cluster.
        crystals: [
          { x: 381, y: 158, radius: 40,
            faces: [[[378, 142], [386, 151], [383, 174], [376, 165]]] },
          { x: 449, y: 204, radius: 47,
            faces: [[[444, 181], [454, 193], [450, 218], [443, 209]],
              [[470, 229], [477, 238], [471, 251], [465, 245]]] },
          { x: 1032, y: 103, radius: 49,
            faces: [[[1024, 84], [1033, 96], [1034, 123], [1027, 136], [1024, 117]]] },
          { x: 1258, y: 82, radius: 52,
            faces: [[[1248, 61], [1260, 69], [1267, 94], [1256, 105], [1249, 86]]] },
          { x: 1357, y: 119, radius: 45,
            faces: [[[1350, 102], [1359, 112], [1364, 135], [1357, 140], [1351, 124]]] },
          { x: 1269, y: 219, radius: 61,
            faces: [[[1261, 197], [1274, 208], [1278, 232], [1265, 243], [1258, 223]],
              [[1306, 206], [1315, 214], [1311, 238], [1303, 230]]] },
          { x: 788, y: 232, radius: 23,
            faces: [[[784, 224], [790, 229], [791, 240], [785, 239]]] }
        ]
      }
    }
  }
};
