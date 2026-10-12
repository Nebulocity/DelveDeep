// This retained background owns its artwork layers and walkable floor outline. The polygon
// points use original artwork pixels. LayeredEnvironment scales and positions them with
// the art, then clips the lower edge above the party HUD. Foreground decoration can cover
// sprites without becoming blocking terrain.
// There is no playable Delve here; keep this art configuration available for future reuse.

export default {
  terrain: [],
  visuals: {
    environment: {
      width: 1536, height: 1024, offsetY: -36, pixelArt: true,

      // Keep the rear floor outline; the lower floor continues beneath foreground scenery.
      walkable: [
        [469, 392], [640, 366], [830, 384], [1000, 408],
        [1125, 447], [1281, 469], [1400, 520], [1400, 1024],
        [165, 1024], [165, 546], [257, 478], [369, 433]
      ],
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
