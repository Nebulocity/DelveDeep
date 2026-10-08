// This is sprite metadata, connecting stable IDs to textures, frames and animations. Frame
// sizes and origins come from the supplied sheets. An origin marks the anchor inside a
// frame, not a battlefield position. Direction and clip counts keep animation from
// stepping into unused cells at the end of a sheet.
export const MONSTER_VARIANT_SHEETS = {
  caveSlimeTurquoise: [
    new URL('../assets/enemies/slime-cave/caveSlime/variants/turquoise/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/variants/turquoise/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/variants/turquoise/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/variants/turquoise/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/variants/turquoise/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/variants/turquoise/sheets/death.png', import.meta.url).href,
  ],

  caveSlimeAmber: [
    new URL('../assets/enemies/slime-cave/caveSlime/variants/amber/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/variants/amber/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/variants/amber/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/variants/amber/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/variants/amber/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/caveSlime/variants/amber/sheets/death.png', import.meta.url).href,
  ],

  elderSlimeCobalt: [
    new URL('../assets/enemies/slime-cave/elderSlime/variants/cobalt/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/variants/cobalt/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/variants/cobalt/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/variants/cobalt/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/variants/cobalt/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/variants/cobalt/sheets/death.png', import.meta.url).href,
  ],

  elderSlimeCrimson: [
    new URL('../assets/enemies/slime-cave/elderSlime/variants/crimson/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/variants/crimson/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/variants/crimson/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/variants/crimson/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/variants/crimson/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/slime-cave/elderSlime/variants/crimson/sheets/death.png', import.meta.url).href,
  ],

  ruffianTeal: [
    new URL('../assets/enemies/thornbriar-hollow/ruffian/variants/teal/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/ruffian/variants/teal/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/ruffian/variants/teal/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/ruffian/variants/teal/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/ruffian/variants/teal/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/ruffian/variants/teal/sheets/death.png', import.meta.url).href,
  ],

  ruffianViolet: [
    new URL('../assets/enemies/thornbriar-hollow/ruffian/variants/violet/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/ruffian/variants/violet/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/ruffian/variants/violet/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/ruffian/variants/violet/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/ruffian/variants/violet/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/ruffian/variants/violet/sheets/death.png', import.meta.url).href,
  ],

  hedgeMageTeal: [
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/variants/teal/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/variants/teal/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/variants/teal/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/variants/teal/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/variants/teal/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/variants/teal/sheets/death.png', import.meta.url).href,
  ],

  hedgeMageBurgundy: [
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/variants/burgundy/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/variants/burgundy/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/variants/burgundy/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/variants/burgundy/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/variants/burgundy/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/hedgeMage/variants/burgundy/sheets/death.png', import.meta.url).href,
  ],

  lasherNavy: [
    new URL('../assets/enemies/thornbriar-hollow/lasher/variants/navy/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/lasher/variants/navy/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/lasher/variants/navy/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/lasher/variants/navy/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/lasher/variants/navy/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/lasher/variants/navy/sheets/death.png', import.meta.url).href,
  ],

  lasherRust: [
    new URL('../assets/enemies/thornbriar-hollow/lasher/variants/rust/sheets/idle.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/lasher/variants/rust/sheets/walk.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/lasher/variants/rust/sheets/attack.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/lasher/variants/rust/sheets/block.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/lasher/variants/rust/sheets/hit.png', import.meta.url).href,
    new URL('../assets/enemies/thornbriar-hollow/lasher/variants/rust/sheets/death.png', import.meta.url).href,
  ],
};
