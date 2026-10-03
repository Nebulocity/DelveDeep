export default {
  id: 'thornbriar-hollow',
  name: 'Thornbriar Hollow',
  mapLabel: 'Thornbriar Hollow',
  subtitle: 'A thorn-choked hollow where the road grows strangely quiet.',
  difficulty: 'Easy', recommendedLevel: 1, depth: 2, type: 'delve',
  possibleDrops: ['Gold', 'Adventurer XP'],
  prerequisites: ['slime-cave'],
  map: { x: 0.503, y: 0.503, radius: 0.060 },
  terrain: [],
  visuals: {
    environment: {
      width: 1672, height: 941, offsetY: -105, pixelArt: true,
      floor: { topLeftX: 290, topRightX: 1382, topY: 515,
        bottomLeftX: 345, bottomRightX: 1327, bottomY: 815 },
      layers: [
        { key: 'thornbriar-hollow-pixel-art',
          url: new URL('../../assets/environments/thornbriar-hollow-pixel/camp.png', import.meta.url).href,
          depth: -1000 }
      ],
      foreground: {
        sourceKey: 'thornbriar-hollow-pixel-art', depth: 4300,
        polygons: [
          [[0, 583], [92, 574], [165, 597], [244, 610], [322, 652],
            [376, 711], [430, 727], [490, 760], [564, 815], [620, 866],
            [667, 941], [0, 941]],
          [[1672, 594], [1605, 607], [1515, 626], [1451, 662], [1390, 690],
            [1330, 741], [1260, 790], [1185, 820], [1118, 882], [1060, 941],
            [1672, 941]]
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
