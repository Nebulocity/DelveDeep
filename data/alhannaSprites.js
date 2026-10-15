// Four authored PixelLab facings are packed in rows. Cardinal headings alias the
// nearest real facing without mirroring her sword. Each cell is 256 pixels square.
const states = { idle: [4,150], walk: [6,100], attack: [9,70], block: [9,70], hit: [6,110], death: [7,110] };
const facing = { south: 0, 'south-east': 0, east: 0, 'south-west': 1, west: 1,
  north: 2, 'north-east': 2, 'north-west': 3 };
const textures = Object.keys(states).map(state => ({ character: 'alhanna', key: 'alhanna-' + state,
  url: new URL('../assets/characters/alhanna/sheets/' + state + '.png', import.meta.url).href }));
const clips = Object.fromEntries(Object.entries(states).map(([state, [count, frameMs]]) =>
  [state, Object.fromEntries(Object.entries(facing).map(([direction, row]) => [direction,
    { frameMs, frames: Array.from({ length: count }, (_, frame) => ({ key: 'alhanna-' + state,
      frame: row * count + frame, originX: 0.5, originY: 0.890625, flipX: false })) }]))]));

// Hold the actual final death frame so a fallen dancer does not return to standing.
clips.dead = Object.fromEntries(Object.entries(clips.death).map(([direction, clip]) =>
  [direction, { frameMs: 1000, frames: [clip.frames.at(-1)] }]));
export const ALHANNA_SPRITES = { textures, clips, scale: 0.66, footY: 30 };
