// Sylva's approved woodland-cleric artwork supplies every combat pose and portrait.
// The layout records the painted frames, their timing and the measured boot positions.
import layout from '../assets/characters/sylva/sheets/layout.json' with { type: 'json' };

const states = ['idle', 'walk', 'attack', 'block', 'hit', 'death'];
const facings = {
  south: 'south-east', 'south-east': 'south-east', east: 'south-east',
  'south-west': 'south-west', west: 'south-west', north: 'north-east',
  'north-east': 'north-east', 'north-west': 'north-west'
};

// Each URL points to a finished sheet. The template path lets Vite bundle the PNGs
// for web and Android without needing PixelLab, source frames or an API key.
const textures = states.map(state => ({
  character: 'sylva',
  key: `sylva-${state}`,
  url: new URL(`../assets/characters/sylva/sheets/Sylva-${state}.png`, import.meta.url).href
}));
const clips = {};

// A row contains one authored diagonal facing. Row times column count finds its
// first cell, and column advances through the painted frames in that animation.
for (const state of states) {
  const sheet = layout.states[state];
  const authored = Object.fromEntries(layout.directions.map((direction, row) => [direction, {
    frameMs: sheet.frameMs,
    frames: Array.from({ length: sheet.counts[direction] }, (_, column) => ({
      key: `sylva-${state}`,
      frame: row * sheet.columns + column,
      originX: layout.anchors[direction].originX,
      originY: layout.anchors[direction].originY,
      flipX: false
    }))
  }]));

  // The other four movement headings reuse the closest diagonal drawing. Mirroring
  // would switch her mace between hands, so every frame keeps its authored facing.
  clips[state] = Object.fromEntries(Object.entries(facings).map(([heading, direction]) =>
    [heading, authored[direction]]));
}

// The death reaction plays once, then holds its final fallen pose. Shared playback
// uses combat milliseconds, so all of Sylva's animations freeze when combat pauses.
clips.dead = Object.fromEntries(Object.entries(clips.death).map(([heading, clip]) =>
  [heading, { frameMs: 1000, frames: [clip.frames.at(-1)] }]));

// The measured scale matches the party's visible height rather than the empty cell.
// Portraits use the same correction against the original 0.66 display convention.
// footY retains the shared 30-unit offset used to place adventurers on the floor.
const scale = layout.scale;

// Idle cells leave about 70 source pixels above her hair. Keep the name and bars
// just above the painted character rather than above that transparent padding.
export const SYLVA_SPRITES = { textures, clips, scale, portraitScale: scale / 0.66, footY: 30, topFrameY: 68 };
