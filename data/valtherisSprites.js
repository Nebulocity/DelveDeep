// These sheets replace Valtheris's old character art while keeping his saved roster ID.
const directions = ['south-east', 'south-west', 'north-east', 'north-west'];
const headingRows = {
  south: 'south-east',
  'south-east': 'south-east',
  east: 'south-east',
  'south-west': 'south-west',
  west: 'south-west',
  north: 'north-east',
  'north-east': 'north-east',
  'north-west': 'north-west'
};
const stateLayout = {
  idle: { columns: 6, counts: [6, 6, 6, 6], fps: 8 },
  walk: { columns: 8, counts: [8, 8, 8, 8], fps: 12 },
  attack: { columns: 13, counts: [13, 9, 9, 12], fps: 12 },
  block: { columns: 9, counts: [9, 9, 9, 9], fps: 10 },
  hit: { columns: 5, counts: [5, 5, 5, 5], fps: 10 },
  death: { columns: 17, counts: [17, 17, 13, 12], fps: 12 },
  cast: { columns: 13, counts: [13, 11, 9, 12], fps: 12 }
};

const textures = Object.keys(stateLayout).map(state => ({
  character: 'valtheris',
  key: `valtheris-reference-v2-${state}`,
  url: new URL(`../assets/characters/valtheris/sheets/${state}.png`, import.meta.url).href
}));

// Each row of the atlas is one diagonal facing, and each column is one animation frame.
const clips = Object.fromEntries(Object.entries(stateLayout).map(([state, sheet]) => {
  const stateIndex = Object.keys(stateLayout).indexOf(state);
  const key = textures[stateIndex].key;
  const clipByDirection = {};

  for (const [heading, rowDirection] of Object.entries(headingRows)) {
    const row = directions.indexOf(rowDirection);
    const count = sheet.counts[row];
    const firstFrame = row * sheet.columns;
    const frames = Array.from({ length: count }, (_, index) => ({
      key,
      frame: firstFrame + index,
      originX: 0.5,
      originY: 0.9296875,
      flipX: false
    }));

    // The idle sheet holds its first pose so the small breathing motion stays subtle.
    if (state === 'idle') frames.unshift(...Array(10).fill(frames[0]));

    clipByDirection[heading] = { frameMs: 1000 / sheet.fps, frames };
  }

  return [state, clipByDirection];
}));

// The fallen pose is the final frame of the collapse and stays still afterward.
clips.dead = Object.fromEntries(Object.entries(clips.death).map(([heading, clip]) => [heading, {
  frameMs: 1000,
  frames: [clip.frames.at(-1)]
}]));

export const VALTHERIS_SPRITES = {
  textures,
  clips,

  // His 245-pixel painted height becomes about 157 game pixels. This trims the
  // oversized hood slightly while the unchanged foot anchor keeps him grounded.
  scale: 0.64,
  portraitScale: 0.64 / 0.66,
  footY: 30
};
