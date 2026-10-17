// Garrick uses the original dragon-wing Gladiator artwork. The roster ID links
// his party choices, equipment and character sheets.
import layout from '../assets/characters/garrick/sheets/layout.json' with { type: 'json' };

const states = ['idle', 'walk', 'attack', 'block', 'hit', 'death'];
const facing = {
  south: 'south-east', 'south-east': 'south-east', east: 'south-east',
  'south-west': 'south-west', west: 'south-west', north: 'north-east',
  'north-east': 'north-east', 'north-west': 'north-west'
};

// These URLs point only to finished PNGs. Vite bundles them without PixelLab or any
// authoring tools. Each 256-pixel cell contains one complete transparent drawing.
const textures = states.map(state => ({
  character: 'garrick',
  key: `garrick-${state}`,
  url: new URL(`../assets/characters/garrick/sheets/Garrick-${state}.png`, import.meta.url).href
}));
const clips = {};

// Read counts and timing from the same layout that packed the sheets. Row times column
// count gives the row's first frame; column then selects the drawing within that row.
for (const state of states) {
  const sheet = layout.states[state];
  const authored = Object.fromEntries(layout.directions.map((direction, row) => [direction, {
    frameMs: sheet.frameMs,
    frames: Array.from({ length: sheet.counts[direction] }, (_, column) => ({
      key: `garrick-${state}`,
      frame: row * sheet.columns + column,
      originX: layout.anchors[direction].originX,
      originY: layout.anchors[direction].originY,
      flipX: false
    }))
  }]));

  // Reuse authored diagonal poses for the other movement headings. Never mirror the
  // drawing, because that would switch his sword and shield between hands.
  clips[state] = Object.fromEntries(Object.entries(facing).map(([heading, direction]) =>
    [heading, authored[direction]]));
}

// Death plays once and then holds its last pose. The shared combat clock controls
// playback, so pausing combat also pauses Garrick's animations.
clips.dead = Object.fromEntries(Object.entries(clips.death).map(([heading, clip]) =>
  [heading, { frameMs: 1000, frames: [clip.frames.at(-1)] }]));

// Garrick stands about 185 native pixels tall. A scale of 0.88 keeps his displayed height
// near the former 245-pixel drawing at 0.66, while preserving his broader shoulders.
// footY is the shared 30-unit floor offset; measured origins put his boots on that floor.
// Enlarge fixed-size portraits to roughly match Vaeloria's visible height.
export const GARRICK_SPRITES = { textures, clips, scale: 0.88, portraitScale: 1.2, footY: 30 };
