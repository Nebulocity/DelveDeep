// This defines the map's textured green surfaces, bronze trim and shared text. Canvas
// drawing makes reusable textures. Draw order and touch areas are separate, so a
// decorative layer should not block a real control.

import { UI_FONT_SIZES, UI_FONT_FAMILIES } from '../config/uiTypography.js';
const PALETTES = {
  normal: ['#354c40', '#172c25', '#0d1d19', '#967c4e'],
  selected: ['#52634b', '#2b4431', '#142b23', '#dbc58a'],
  danger: ['#654740', '#382725', '#211b1b', '#c99a78']
};

// Choose a message area centered in either the map viewport or the full game canvas. scene
// is the Phaser screen that owns the objects, clock and input used here.
export function regionMessageBounds(scene, scope = 'ui') {

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const camera = scope === 'map' && scene.mapUiCamera ? scene.cameras.main : null;
  if (camera) {

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    const left = Math.max(0, camera.x);
    const right = Math.min(scene.scale.width, camera.x + camera.width);
    return { centerX: left + (right - left) / 2, width: right - left };
  }

  return { centerX: scene.scale.width / 2, width: scene.scale.width };
}

// Create or reuse the map panel's generated texture at its requested dimensions. scene is
// the Phaser screen that owns the objects, clock and input used here. width is the
// available width in this coordinate space.
function surfaceTexture(scene, width, height, state) {
  const key = `region-surface-${Math.round(width)}-${Math.round(height)}-${state}`;
  if (scene.textures.exists(key)) return key;

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound.
  const scale = Math.min(1, 1536 / width, 1024 / height);

  // Math.ceil rounds upward to the next integer, including when the value has a fractional
  // part.
  const w = Math.ceil(width * scale), h = Math.ceil(height * scale);
  const canvas = scene.textures.createCanvas(key, w, h);
  const ctx = canvas.context;
  ctx.scale(scale, scale);

  // The brackets unpack entries by position; their order matters. ?? uses the fallback
  // only for null or undefined. A real zero or false stays intact.
  const [light, face, dark, edge] = PALETTES[state] ?? PALETTES.normal;
  const gradient = ctx.createLinearGradient(0, 0, width * 0.35, height);
  gradient.addColorStop(0, light);
  gradient.addColorStop(0.4, face);
  gradient.addColorStop(1, dark);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  let seed = 417;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < Math.min(10000, width * height / 55); i++) {

    // The condition before ? chooses the first value when true and the value after : when
    // false. % gives the remainder. With a nonnegative index and positive list length, it
    // wraps the index back to the start of the list.
    ctx.fillStyle = i % 2 ? 'rgba(225,239,213,0.035)' : 'rgba(0,0,0,0.10)';
    ctx.fillRect(random() * width, random() * height, 1 + random() * 3, 1 + random() * 2);
  }

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(166,191,160,0.09)';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(width * 0.84, height * 0.7, width * (0.12 + i * 0.045), height * (0.18 + i * 0.065), -0.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.lineWidth = 3;
  ctx.strokeStyle = edge;
  ctx.strokeRect(3, 3, width - 6, height - 6);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(222,204,156,0.4)';
  const inset = height < 90 ? 6 : 9;
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);

  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.strokeRect(inset + 2, inset + 2, width - (inset + 2) * 2, height - (inset + 2) * 2);
  ctx.fillStyle = edge;

  for (const x of [17, width - 17]) for (const y of [17, height - 17]) {
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x + 4, y);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x - 4, y);
    ctx.closePath();
    ctx.fill();
  }
  canvas.refresh();

  return key;
}

// Place a themed map surface and border at the supplied bounds and draw order. scene is
// the Phaser screen that owns the objects, clock and input used here. width is the
// available width in this coordinate space.
export function addRegionPanel(scene, x, y, width, height, depth = 1000, state = 'normal', fixed = true) {

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects. Scroll factor controls how much the object follows the camera.
  // Zero keeps it fixed while the world scrolls. The condition before ? chooses the first
  // value when true and the value after : when false.
  const art = scene.add.image(x, y, surfaceTexture(scene, width, height, state))
    .setDisplaySize(width, height).setScrollFactor(fixed ? 0 : 1).setDepth(depth - 0.01)
    .setName(fixed ? 'region-map-surface' : 'region-map-world-surface');
  const hit = scene.add.rectangle(x, y, width, height, 0x000000, 0)
    .setScrollFactor(fixed ? 0 : 1).setDepth(depth).setName('region-map-panel');
  hit.regionMapArt = art;
  hit.regionMapState = state;

  hit.pressVisuals = [art];

  // once registers a callback that removes itself after the first matching event.
  hit.once('destroy', () => art.destroy());
  return hit;
}

// Update the map surface's selected, disabled or ordinary visual state. scene is the
// Phaser screen that owns the objects, clock and input used here. state is the game data
// to read or change; a default can point at shared GameState.
export function setRegionPanelState(scene, panel, state = 'normal', alpha = 1) {
  if (panel.regionMapState !== state) {
    panel.regionMapArt.setTexture(surfaceTexture(scene, panel.width, panel.height, state))
      .setDisplaySize(panel.width, panel.height);
    panel.regionMapState = state;
  }
  panel.regionMapArt.setAlpha(alpha);
}

// Display a wrapped map message inside its themed panel. scene is the Phaser screen that
// owns the objects, clock and input used here.
export function addRegionNotice(scene, x, y, message, { width = 1100, fontSize = UI_FONT_SIZES.body32, depth = 5200 } = {}) {

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects. Scroll factor controls how much the object follows the camera.
  // Zero keeps it fixed while the world scrolls. Origin is the anchor within the object: 0
  // is the left/top edge, 0.5 is the center and 1 is the right/bottom edge. x/y place that
  // anchor, not necessarily the object's corner.
  const text = scene.add.text(x, y, message, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: `${fontSize}px`, color: '#f4ead2', align: 'center',
    wordWrap: { width: width - 90 }, stroke: '#102019', strokeThickness: 2
  }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound.
  const panel = addRegionPanel(scene, x, y, Math.min(width, text.width + 90), Math.max(76, text.height + 44), depth);

  // once registers a callback that removes itself after the first matching event.
  text.once('destroy', () => panel.destroy());
  return { panel, text };
}
