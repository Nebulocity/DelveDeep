// Keep the inherited encounter rules and saved IDs, but give the Watch its own flooded
// chamber. All floor, foreground and effect coordinates use the approved image's pixels.
import thornbriarHollow from './ThornbriarHollow.js';

export default {
  ...thornbriarHollow,
  id: 'sunken-watch',
  name: 'The Sunken Watch',
  mapLabel: 'The Sunken Watch',
  subtitle: 'Drowned guardians haunt a ruined watchtower beside the river.',
  difficulty: 'Very Tough', recommendedLevel: 16,
  prerequisites: ['march-west-delves'],
  visuals: {
    environment: {
      width: 1672, height: 941, offsetY: -105, pixelArt: false,

      // The rear edge follows exposed stone, away from the deep water and stairs.
      // Continue the lower floor beneath decorative rubble; the renderer clips the HUD.
      walkable: [
        [235, 420], [400, 373], [610, 343], [820, 327],
        [1030, 340], [1225, 378], [1410, 456], [1510, 542],
        [1530, 941], [150, 941], [155, 562]
      ],
      layers: [
        { key: 'sunken-watch-chamber',
          url: new URL('../../assets/environments/sunken-watch-pixel/chamber.png', import.meta.url).href,
          depth: -1000 }
      ],

      // A masked copy keeps the approved corner stones exactly aligned over sprites.
      // These shapes affect drawing only, so the rubble does not block movement.
      foreground: {
        sourceKey: 'sunken-watch-chamber', depth: 4300,
        polygons: [
          [[0, 520], [80, 535], [120, 591], [117, 625], [244, 655],
            [370, 704], [350, 779], [430, 821], [530, 889], [575, 941], [0, 941]],
          [[1672, 611], [1575, 610], [1483, 666], [1436, 696],
            [1345, 739], [1270, 779], [1218, 810], [1125, 815],
            [1077, 857], [1045, 941], [1672, 941]]
        ]
      },
      watchEffects: {

        // These centers sit on the three visible lantern flames, not their brackets.
        lanterns: [
          { x: 208, y: 166, radius: 66 },
          { x: 882, y: 165, radius: 62 },
          { x: 1531, y: 195, radius: 64 }
        ],

        // Each water patch owns a polygon to keep animated ripples off the dry floor.
        waterRegions: [
          [[0, 320], [115, 337], [290, 325], [480, 295], [583, 275],
            [617, 245], [778, 248], [815, 298], [1040, 299], [1100, 322],
            [980, 339], [800, 322], [600, 341], [400, 371], [225, 420], [0, 485]],
          [[1250, 316], [1300, 257], [1413, 236], [1450, 292], [1550, 312],
            [1672, 321], [1672, 530], [1550, 486], [1410, 438], [1340, 375]],
          [[0, 697], [245, 698], [420, 797], [558, 884], [795, 889],
            [1090, 818], [1290, 742], [1420, 688], [1672, 708],
            [1672, 941], [0, 941]]
        ],

        // Ripple centers and radii are original-image pixels, compressed vertically
        // to match the shallow camera angle. Warm patches echo the lantern reflections.
        ripples: [
          { x: 92, y: 386, radius: 32 }, { x: 325, y: 329, radius: 25 },
          { x: 672, y: 280, radius: 29 }, { x: 1050, y: 316, radius: 23 },
          { x: 1400, y: 300, radius: 32 }, { x: 1505, y: 379, radius: 43 },
          { x: 1640, y: 459, radius: 38 }, { x: 415, y: 805, radius: 31 },
          { x: 900, y: 918, radius: 46 }, { x: 1370, y: 806, radius: 40 }
        ],
        reflections: [
          { x: 204, y: 369, width: 42, height: 78 },
          { x: 882, y: 303, width: 36, height: 24 },
          { x: 1540, y: 397, width: 48, height: 100 }
        ]
      }
    }
  }
};
