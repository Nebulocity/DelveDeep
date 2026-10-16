import { worldMapAmbience as art } from '../data/worldMapAmbience.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../data/illustratedWorldMap.js';

// Draw small cosmetic overlays over the still illustration. One shared Graphics object
// keeps the object count low and sits below labels, the party and all touch targets.
export function createWorldMapAmbience(scene) {
  const graphic = scene.add.graphics().setDepth(1);
  graphic.name = 'world-map-ambience';
  graphic.setScale(WORLD_WIDTH / art.width, WORLD_HEIGHT / art.height);
  let elapsed = 0;
  let lastFrame = -1;

  // Independent sine waves make each light flutter without consuming gameplay random
  // numbers. Seconds and source index determine its brightness, rather than saved state.
  const flicker = index => 0.73 + Math.sin(elapsed * 8.3 + index * 2.4) * 0.17
    + Math.sin(elapsed * 13.7 + index) * 0.09;

  // Anchor the flame at its fuel source and stretch only its tip. Layered tapered shapes
  // add visible motion while preserving the warm or green-blue light painted underneath.
  function flame(x, y, size, index, magical = false) {
    const brightness = flicker(index);
    const height = size * (1.8 + brightness * 0.8);
    const lean = Math.sin(elapsed * 5 + index) * size * 0.35;
    graphic.fillStyle(magical ? 0x48efc7 : 0xffa532, brightness * 0.09);
    graphic.fillEllipse(x, y - size, size * 5, size * 6);
    graphic.fillStyle(magical ? 0x32e7d4 : 0xff8423, brightness * 0.8);
    graphic.fillTriangle(x - size * 0.55, y, x + lean, y - height, x + size * 0.55, y);
    graphic.fillStyle(magical ? 0xc7fff0 : 0xffed9c, brightness * 0.85);
    graphic.fillTriangle(x - size * 0.22, y, x + lean * 0.4, y - height * 0.65, x + size * 0.25, y);
  }

  // Progress wraps from zero to one. Following each short polyline makes the highlights
  // drift downstream instead of sliding one texture across rocks, trees and bridges.
  function waterHighlight(points, progress, index) {
    const distance = progress * (points.length - 1);
    const segment = Math.min(points.length - 2, Math.floor(distance));
    const fraction = distance - segment;
    const start = points[segment];
    const end = points[segment + 1];
    const x = start[0] + (end[0] - start[0]) * fraction + Math.sin(index * 3.7) * 4;
    const y = start[1] + (end[1] - start[1]) * fraction;
    graphic.lineStyle(1, 0xc8f5ff, Math.sin(progress * Math.PI) * 0.38);
    graphic.lineBetween(x - 3, y, x + 3, y - 1);
  }

  function update(_time, delta) {

    // Phaser supplies milliseconds. Cap resumed frames to avoid a sudden jump after
    // backgrounding, and redraw at 24 FPS while the rest of the map runs normally.
    elapsed += Math.min(delta, 100) / 1000;
    const frame = Math.floor(elapsed * 24);
    if (frame === lastFrame) return;
    lastFrame = frame;
    graphic.clear();

    art.smoke.forEach(([x, y], source) => {
      for (let puff = 0; puff < 6; puff += 1) {
        const progress = (elapsed * 0.13 + puff / 6 + source * 0.21) % 1;
        const drift = progress * 14 + Math.sin(elapsed * 0.6 + puff) * progress * 5;
        const size = 3 + progress * 9;
        graphic.fillStyle(0xbac1bc, Math.sin(progress * Math.PI) * 0.15);
        graphic.fillEllipse(x + drift, y - progress * 55, size * 1.4, size);
      }
    });

    art.fires.forEach(([x, y, size], index) => {
      flame(x, y, size, index);
      const rise = (elapsed * 0.45 + index * 0.31) % 1;
      graphic.fillStyle(0xffce76, Math.sin(rise * Math.PI) * 0.65);
      graphic.fillRect(x + Math.sin(index + elapsed) * 3, y - 7 - rise * 24, 1, 2);
    });

    art.eyes.forEach(([x, y, size], index) => {
      const glow = 0.22 + Math.sin(elapsed * 1.4 + index * 0.3) * 0.12;
      graphic.fillStyle(0xff9a23, glow);
      graphic.fillEllipse(x, y, size * 2, size * 1.4);
      graphic.fillStyle(0xffdc67, glow * 1.5);
      graphic.fillEllipse(x, y, size * 0.55, size * 0.8);
    });

    art.slime.forEach(([x, y], index) => {
      const progress = (elapsed * 0.38 + index * 0.27) % 1;
      const size = Math.sin(progress * Math.PI) * 3;
      graphic.lineStyle(1, 0xd8ff65, Math.sin(progress * Math.PI) * 0.65);
      graphic.strokeEllipse(x, y - progress * 3, size * 2, size);
    });
    art.drips.forEach(([x, y], index) => {
      const progress = (elapsed * 0.25 + index * 0.32) % 1;
      graphic.fillStyle(0xa8ed26, Math.sin(progress * Math.PI) * 0.75);
      graphic.fillEllipse(x, y + progress * 36, 2, 4);
    });

    art.witchfire.forEach(([x, y, size], index) => flame(x, y, size, index + 20, true));
    art.runes.forEach(([x, y], index) => {
      const glow = (Math.sin(elapsed * 1.2 - index * 0.8) + 1) * 0.13;
      graphic.fillStyle(0x62ffe1, glow);
      graphic.fillEllipse(x, y, 12, 20);
    });

    const portal = art.portal;

    // Elliptical spirals follow the upright portal opening. Broken strokes retain the
    // painted vortex, while angular floating stones echo the debris inside the delve.
    for (let index = 0; index < 12; index += 1) {
      const angle = elapsed * 0.9 + index * Math.PI / 6;
      const radius = 0.3 + index % 3 * 0.24;
      graphic.lineStyle(1.4, index % 2 ? 0xe1bbff : 0x9d55ff, 0.5);
      graphic.lineBetween(portal.x + Math.cos(angle) * portal.width * radius,
        portal.y + Math.sin(angle) * portal.height * radius,
        portal.x + Math.cos(angle + 0.26) * portal.width * radius,
        portal.y + Math.sin(angle + 0.26) * portal.height * radius);
    }
    for (let index = 0; index < 7; index += 1) {
      const side = index % 2 ? -1 : 1;
      const x = portal.x + side * (43 + index % 3 * 9);
      const y = portal.y - 43 + index * 14 + Math.sin(elapsed * 1.1 + index * 1.8) * 5;
      graphic.fillStyle(0x251e3e, 0.95);
      graphic.fillPoints([{ x: x - 4, y }, { x: x - 2, y: y - 7 },
        { x: x + 3, y: y - 5 }, { x: x + 5, y: y + 2 }], true);
      graphic.lineStyle(1, 0xb678ee, 0.75);
      graphic.lineBetween(x - 2, y - 7, x + 3, y - 5);
      graphic.fillStyle(0xc58aff, 0.4 + Math.sin(elapsed * 2 + index) * 0.2);
      graphic.fillRect(x + Math.sin(elapsed + index) * 6, y - 12, 1, 2);
    }

    art.water.forEach((points, source) => {
      for (let index = 0; index < 9; index += 1) {
        waterHighlight(points, (elapsed * 0.12 + index / 9 + source * 0.17) % 1, index);
      }
    });
  }

  update(0, 0);
  scene.events.on('update', update);

  // Scene-owned artwork disappears on shutdown. Remove the update listener as well so
  // visiting town and returning never leaves duplicate animation work running.
  scene.events.once('shutdown', () => {
    scene.events.off('update', update);
    graphic.destroy();
  });
  return graphic;
}
