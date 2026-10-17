
// Yasmin's approved Crimson Fox design wears broad leather shoes and carries two daggers.
// The layout records each painted clip, its timing and the measured shoe anchors.
import layout from '../assets/characters/yasmin/sheets/layout.json' with { type: 'json' };

const states = ['idle', 'walk', 'attack', 'block', 'hit', 'death'];
const facings = {
  south: 'south-east', 'south-east': 'south-east', east: 'south-east',
  'south-west': 'south-west', west: 'south-west', north: 'north-east',
  'north-east': 'north-east', 'north-west': 'north-west'
};

// Finished PNGs are the only runtime dependency. The template path lets Vite discover
// and bundle all six sheets. Existing texture keys remain readable in saved battles.
const textures = states.map(state => ({
  character: 'yasmin',
  key: `yasmin-reference-v2-${state}`,
  url: new URL(`../assets/characters/yasmin/sheets/Yasmin-${state}.png`, import.meta.url).href
}));
const clips = {};

for (const state of states) {
  const sheet = layout.states[state];

  // Each row is one authored diagonal. Multiplying row by column count finds the
  // first cell, then column selects one drawing without stepping into empty padding.
  const authored = Object.fromEntries(layout.directions.map((direction, row) => [direction, {
    frameMs: sheet.frameMs,
    frames: Array.from({ length: sheet.counts[direction] }, (_, column) => ({
      key: `yasmin-reference-v2-${state}`,
      frame: row * sheet.columns + column,
      originX: layout.anchors[direction].originX,
      originY: layout.anchors[direction].originY,
      flipX: false
    }))
  }]));

  // The other movement headings reuse the nearest diagonal. Keeping the drawings
  // unmirrored preserves Yasmin's satchel, clothing and dagger grip on each side.
  clips[state] = Object.fromEntries(Object.entries(facings).map(([heading, direction]) =>
    [heading, authored[direction]]));
}

// Defeat plays once and holds the last fallen drawing. The existing combat clock
// drives every clip, so Pause freezes her breathing, movement and reactions together.
clips.dead = Object.fromEntries(Object.entries(clips.death).map(([heading, clip]) =>
  [heading, { frameMs: 1000, frames: [clip.frames.at(-1)] }]));

// Scale uses painted height rather than empty cell size, keeping Yasmin shorter than
// the human party members. Portrait correction shares the original 0.66 convention.
// footY retains the shared 30-unit offset used to place adventurers on the floor.
const scale = layout.scale;
export const YASMIN_SPRITES = { textures, clips, scale, portraitScale: scale / 0.66, footY: 30 };
