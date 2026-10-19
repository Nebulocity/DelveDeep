import layout from '../assets/characters/vaeloria/sheets/layout.json' with { type: 'json' };

const states = ['idle', 'walk', 'attack', 'block', 'hit', 'death'];
const directions = layout.directions;
const facing = {
  south: 'south-east',
  'south-east': 'south-east',
  east: 'south-east',
  'south-west': 'south-west',
  west: 'south-west',
  north: 'north-east',
  'north-east': 'north-east',
  'north-west': 'north-west'
};
const textures = states.map(state => ({
  character: 'elyra',
  key: `elyra-reference-v2-${state}`,
  url: new URL(`../assets/characters/vaeloria/sheets/${state}.png`, import.meta.url).href
}));
const clips = {};

// Build each direction's frames from the authored layout so counts and foot anchors stay in sync.
for (const state of states) {
  const sheet = layout.states[state];
  const authored = Object.fromEntries(directions.map((direction, row) => [direction, {
    frameMs: sheet.frameMsByDirection?.[direction] ?? sheet.frameMs,
    frames: Array.from({ length: sheet.counts[direction] }, (_, column) => ({
      key: `elyra-reference-v2-${state}`,
      frame: row * sheet.columns + column,
      originX: layout.anchors[direction].originX,
      originY: layout.anchors[direction].originY,
      flipX: false
    }))
  }]));

  // The eight gameplay headings reuse the four authored diagonal poses without mirroring gear.
  clips[state] = Object.fromEntries(Object.entries(facing).map(([heading, direction]) => [heading, authored[direction]]));
}

// Keep the final death pose on screen after its one-shot animation ends.
clips.dead = Object.fromEntries(Object.entries(clips.death).map(([heading, clip]) => [heading, {
  frameMs: 1000,
  frames: [clip.frames.at(-1)]
}]));

// Her artwork fills less of each frame, so enlarge it to match the party's visible height.
const scale = 1.16;

// Portraits start at a fixed size, so apply the same increase over the original 0.66 scale.
export const VAELORIA_SPRITES = { textures, clips, scale, portraitScale: scale / 0.66, footY: 30 };
