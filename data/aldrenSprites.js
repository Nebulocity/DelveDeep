// Aldren uses his original knight artwork for every combat state and portrait.
// Each sheet has four authored diagonal rows, so his sword is never mirrored.
const states = {
  idle: [4, 1000 / 6], walk: [8, 100], attack: [9, 100],
  block: [5, 100], hit: [5, 100], death: [9, 100]
};
const facingRows = {
  south: 0, 'south-east': 0, east: 0, 'south-west': 1, west: 1,
  north: 2, 'north-east': 2, 'north-west': 3
};

// Native 128-pixel art is enlarged exactly twice with nearest-neighbor pixels inside
// each 256-pixel cell. These measured boot anchors keep every facing on the floor.
const footOrigins = [232 / 256, 232 / 256, 236 / 256, 236 / 256];

// Keep the texture keys readable by historical battle snapshots. The template path
// lets Vite discover and bundle the finished PNGs without any authoring services.
const textures = Object.keys(states).map(state => ({
  character: 'aldren', key: `aldren-reference-v2-${state}`,
  url: new URL(`../assets/characters/aldren/sheets/Aldren-${state}.png`, import.meta.url).href
}));

// A row starts at row times column count; each following frame advances one cell.
// Frame durations are milliseconds, advanced by the shared paused combat clock.
const clips = Object.fromEntries(Object.entries(states).map(([state, [count, frameMs]]) =>
  [state, Object.fromEntries(Object.entries(facingRows).map(([direction, row]) => [direction, {
    frameMs,
    frames: Array.from({ length: count }, (_, frame) => ({
      key: `aldren-reference-v2-${state}`, frame: row * count + frame,
      originX: 0.5, originY: footOrigins[row], flipX: false
    }))
  }]))]));

// A fallen knight holds the last death drawing instead of returning to his idle pose.
clips.dead = Object.fromEntries(Object.entries(clips.death).map(([direction, clip]) =>
  [direction, { frameMs: 1000, frames: [clip.frames.at(-1)] }]));

// The new drawing is shorter within its cell. This scale keeps his battlefield height
// close to the other adventurers; footY retains the shared 30-unit floor offset.
export const ALDREN_SPRITES = { textures, clips, scale: 0.8, footY: 30 };
