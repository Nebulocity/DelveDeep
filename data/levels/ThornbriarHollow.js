// This encounter owns its artwork layers, waves and walkable floor outline. The polygon
// points use original artwork pixels. LayeredEnvironment scales and positions them with
// the art, then clips the lower edge above the party HUD. Foreground decoration can cover
// sprites without becoming blocking terrain.

export default {
  id: 'thornbriar-hollow',
  name: 'Thornbriar Hollow',
  mapLabel: 'Thornbriar Hollow',
  subtitle: 'A thorn-choked hollow where the road grows strangely quiet.',
  difficulty: 'Difficult', recommendedLevel: 3, depth: 2, type: 'delve',
  bossPreparation: { level: 4, gearRarity: 'uncommon', abilityCount: 4, spendSkillPoints: true },
  materialEnvironments: ['Forests', 'Humanoid'],
  prerequisites: ['slime-cave'],
  map: { x: 0.503, y: 0.503, radius: 0.060 },
  terrain: [],
  visuals: {
    environment: {
      width: 1672, height: 941, offsetY: -105, pixelArt: true,

      // Keep the rear floor outline; the lower floor continues beneath foreground scenery.
      walkable: [
        [330, 486], [523, 454], [717, 433], [842, 438],
        [992, 439], [1172, 469], [1325, 498], [1460, 556],
        [1480, 591], [1480, 941], [241, 941], [241, 590],
        [243, 556]
      ],
      layers: [
        { key: 'thornbriar-hollow-pixel-art',
          url: new URL('../../assets/environments/thornbriar-hollow-pixel/camp.png', import.meta.url).href,
          depth: -1000 }
      ],

      foreground: {
        sourceKey: 'thornbriar-hollow-pixel-art', depth: 4300,

        // Follow roots and leaf tips in original artwork pixels, including their gaps.
        // A broad diagonal would copy bare floor over characters standing behind it.
        polygons: [
          [[0, 607], [49, 608], [89, 596], [151, 600], [196, 594],
            [266, 600], [281, 616], [299, 628], [315, 651], [324, 672],
            [328, 732],

            // Retrace this narrow bridge around the open space inside the root arch.
            // The reverse winding cuts out the gap while retaining the arch above it.
            [299, 710], [285, 687], [269, 680], [250, 677], [232, 668],
            [223, 674], [208, 674], [204, 684], [216, 691], [214, 704],
            [232, 713], [246, 720], [255, 733], [273, 738], [285, 755],
            [292, 755], [293, 731], [299, 710], [328, 732],
            [338, 725], [335, 712], [343, 697], [349, 705],
            [351, 731], [366, 741], [381, 719], [388, 704], [405, 697],
            [402, 720], [393, 736], [415, 722], [428, 730], [422, 741],
            [398, 744], [409, 758], [431, 754], [447, 739], [468, 735],
            [472, 714], [480, 713], [493, 729], [508, 732], [521, 718],
            [529, 720], [526, 742], [547, 746], [563, 760], [557, 777],
            [575, 786], [598, 798], [606, 820], [626, 829], [637, 795],
            [649, 790], [640, 815], [633, 837], [646, 850], [652, 878],
            [667, 902], [680, 941], [0, 941]],
          [[1672, 601], [1617, 608], [1585, 608], [1579, 626],
            [1555, 615], [1541, 618], [1532, 642], [1507, 643],
            [1492, 627], [1484, 617], [1449, 632], [1420, 635],
            [1401, 652], [1390, 677], [1374, 701], [1354, 727],
            [1330, 739], [1329, 700], [1320, 695], [1313, 720],
            [1294, 741], [1280, 721], [1261, 705], [1249, 695],
            [1231, 687], [1242, 711], [1256, 729], [1262, 754],
            [1240, 751], [1229, 730], [1212, 727], [1224, 745],
            [1236, 760], [1205, 768], [1200, 783], [1184, 773],
            [1164, 786], [1150, 809], [1123, 819], [1104, 838],
            [1083, 833], [1077, 853], [1097, 862], [1093, 881],
            [1077, 898], [1080, 941], [1672, 941]]
        ]
      },

      forestEffects: {
        fires: [
          { x: 908, y: 380, radius: 76, strength: 1 },
          { x: 227, y: 323, radius: 38, strength: 0.68 },
          { x: 1071, y: 246, radius: 34, strength: 0.55 },
          { x: 1436, y: 262, radius: 38, strength: 0.68 }
        ],

        embers: [
          { x: 908, y: 359, spread: 31, rise: 68, count: 8 },
          { x: 227, y: 314, spread: 13, rise: 36, count: 3 },
          { x: 1436, y: 255, spread: 13, rise: 36, count: 3 }
        ]
      }
    }
  }
};
