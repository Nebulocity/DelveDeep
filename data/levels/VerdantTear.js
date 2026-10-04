export default {
  id: 'verdant-tear',
  name: 'The Verdant Tear',
  mapLabel: 'The Verdant Tear',
  subtitle: 'A fresh wound in reality hangs over a grassy knoll. Small, unstable, and no less deadly.',
  difficulty: 'Unknown', recommendedLevel: 2, depth: 4, type: 'void',
  possibleDrops: ['Gold', 'Adventurer XP'],
  conceptArt: 'delve-concept-verdant-tear',
  prerequisites: ['slime-cave', 'thornbriar-hollow', 'dolmark-den'],
  requiresLocation: 'duskfall',
  map: { x: 0.40, y: 0.72, radius: 0.064 },
  terrain: [],
  visuals: {
    environment: {
      width: 1536, height: 1024, offsetY: -36, pixelArt: true,
      layers: [
        { key: 'verdant-tear-pixel-art',
          url: new URL('../../assets/environments/verdant-tear-pixel/knoll.png', import.meta.url).href,
          depth: -1000 }
      ],
      voidEffects: {
        portal: { x: 755, y: 159, radiusX: 128, radiusY: 108, particles: 18 },
        clouds: [
          { x: 539, y: 177, width: 96, height: 30, phase: 0 },
          { x: 969, y: 173, width: 102, height: 32, phase: 2.4 }
        ],
        flames: [],
        lightning: [
          { startX: 638, startY: 55, endX: 676, endY: 105 },
          { startX: 875, startY: 62, endX: 843, endY: 111 }
        ]
      }
    }
  }
};
