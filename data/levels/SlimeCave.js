// This encounter owns its artwork layers, waves and walkable floor outline. The polygon
// points use original artwork pixels. LayeredEnvironment scales and positions them with
// the art, then clips the lower edge above the party HUD. Foreground decoration can cover
// sprites without becoming blocking terrain. Camera-space pixels from the chibi pixel cave
// concept. Keeping the world ID preserves progression and existing saved unlocks.
export default {
  id: 'slime-cave',
  name: 'The Slime Cave',
  mapLabel: 'The Slime Cave',
  subtitle: 'A damp, abandoned cave consumed by living slime.',
  difficulty: 'Easy', recommendedLevel: 1, depth: 1, type: 'delve',
  bossPreparation: { level: 5, gearRarity: 'common', abilityCount: 2, abilityRank: 2 },
  materialEnvironments: ['Caves'],
  prerequisites: [],
  map: { x: 0.307, y: 0.475, radius: 0.055 },

  // Foreground rocks occlude sprites without blocking the lower arena.
  terrain: [],
  visuals: {
    environment: {
      width: 1672, height: 941, offsetY: -105, pixelArt: true,

      // Keep the rear floor outline; the lower floor continues beneath foreground scenery.
      walkable: [
        [460, 562], [570, 552], [714, 559], [839, 551],
        [1017, 559], [1232, 565], [1382, 602], [1388, 664],
        [1388, 941], [267, 941], [267, 677], [269, 606],
        [339, 578]
      ],
      layers: [
        { key: 'slime-cave-pixel-art',
          url: new URL('../../assets/environments/slime-cave-pixel/cave.png', import.meta.url).href,
          depth: -1000 }
      ],

      foreground: {
        sourceKey: 'slime-cave-pixel-art', depth: 4300,

        // These short edges follow the visible rock silhouettes in artwork pixels.
        // Long diagonals across the gaps would redraw open floor over a unit's legs.
        // The walkable polygon above stays independent so these rocks do not block feet.
        polygons: [
          [
            [0, 689], [62, 690], [110, 712], [170, 748], [244, 762],
            [267, 690], [280, 705], [290, 705], [300, 714], [307, 720],
            [309, 745], [314, 746], [315, 759], [318, 759], [320, 763],
            [324, 763], [325, 759], [332, 759], [333, 773], [338, 772],
            [339, 759], [345, 759], [346, 762], [350, 763], [351, 773],
            [354, 773], [355, 786], [358, 787], [361, 812], [365, 812],
            [366, 821], [373, 822], [377, 820], [379, 812], [384, 812],
            [385, 809], [388, 809], [389, 800], [396, 800], [398, 792],
            [407, 792], [408, 787], [432, 787], [433, 792], [438, 792],
            [442, 812], [445, 812], [446, 825], [449, 825], [450, 837],
            [453, 840], [457, 840], [460, 834], [465, 831], [466, 825],
            [472, 825], [473, 820], [478, 820], [480, 812], [491, 812],
            [494, 799], [505, 799], [506, 792], [518, 793], [519, 786],
            [530, 786], [533, 778], [540, 778], [541, 772], [559, 771],
            [560, 766], [572, 766], [575, 759], [625, 759], [627, 765],
            [638, 765], [639, 772], [645, 773], [646, 780], [649, 781],
            [650, 786], [655, 787], [656, 800], [659, 800], [660, 805],
            [666, 806], [669, 837], [677, 838], [681, 865], [685, 865],
            [686, 875], [696, 871], [697, 866], [721, 866], [723, 873],
            [729, 873], [730, 876], [733, 876], [734, 882], [737, 883],
            [738, 888], [742, 888], [743, 895], [747, 895], [748, 901],
            [753, 901], [755, 914], [760, 914], [780, 941], [0, 941]
          ],
          [
            [760, 941], [760, 914], [763, 914], [764, 907], [770, 901],
            [775, 900], [776, 888], [780, 887], [782, 865], [788, 865],
            [789, 851], [795, 850], [796, 843], [800, 843], [801, 838],
            [804, 838], [805, 834], [827, 834], [828, 841], [834, 841],
            [835, 838], [844, 838], [845, 840], [854, 838], [855, 827],
            [864, 825], [866, 801], [868, 800], [869, 793], [877, 792],
            [879, 787], [884, 787], [885, 773], [888, 773], [889, 765],
            [894, 765], [895, 773], [900, 773], [901, 759], [928, 759],
            [929, 765], [935, 765], [936, 769], [946, 773], [949, 800],
            [954, 800], [958, 803], [962, 824], [967, 825], [968, 837],
            [974, 838], [975, 851], [979, 851], [980, 866], [983, 866],
            [984, 887], [988, 887], [989, 900], [995, 901], [998, 894],
            [1002, 894], [1003, 888], [1006, 888], [1007, 883], [1011, 882],
            [1012, 878], [1027, 878], [1028, 882], [1032, 883], [1033, 888],
            [1038, 888], [1039, 914], [1045, 914], [1046, 941], [1055, 941]
          ],
          [
            [1672, 639], [1607, 655], [1560, 665], [1521, 702], [1476, 706],
            [1433, 731], [1391, 791], [1330, 742], [1326, 749], [1325, 759],
            [1322, 759], [1321, 773], [1316, 773], [1315, 800], [1307, 800],
            [1306, 795], [1302, 795], [1301, 792], [1294, 792], [1293, 787],
            [1255, 787], [1251, 798], [1233, 799], [1229, 808], [1215, 813],
            [1214, 825], [1204, 825], [1203, 830], [1192, 834], [1191, 838],
            [1189, 838], [1188, 847], [1184, 847], [1182, 851], [1179, 851],
            [1178, 866], [1173, 866], [1172, 887], [1169, 887], [1167, 890],
            [1166, 900], [1162, 901], [1161, 914], [1157, 917], [1151, 917],
            [1149, 914], [1132, 914], [1131, 941], [1125, 941],
            [1672, 941]
          ]
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
