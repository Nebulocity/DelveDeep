// Accepted void sheets use four authored diagonal rows in 256-pixel cells. Layouts
// record playable counts, milliseconds per frame and the foot or floating-tail anchor.
import voidCrawlerLayout from '../assets/enemies/murmuring-abyss/voidCrawler/sheets/layout.json' with { type: 'json' };
import voidStalkerLayout from '../assets/enemies/murmuring-abyss/voidStalker/sheets/layout.json' with { type: 'json' };
import voidKeeperLayout from '../assets/enemies/murmuring-abyss/voidKeeper/sheets/layout.json' with { type: 'json' };
import abyssalSovereignLayout from '../assets/enemies/murmuring-abyss/abyssalSovereign/sheets/layout.json' with { type: 'json' };
import voidWispLayout from '../assets/enemies/murmuring-abyss/voidWisp/sheets/layout.json' with { type: 'json' };

const sources = {
  voidCrawler: {
    layout: voidCrawlerLayout,
    urls: {
      idle: new URL('../assets/enemies/murmuring-abyss/voidCrawler/sheets/idle.png', import.meta.url).href,
      walk: new URL('../assets/enemies/murmuring-abyss/voidCrawler/sheets/walk.png', import.meta.url).href,
      attack: new URL('../assets/enemies/murmuring-abyss/voidCrawler/sheets/attack.png', import.meta.url).href,
      cast: new URL('../assets/enemies/murmuring-abyss/voidCrawler/sheets/cast.png', import.meta.url).href,
      block: new URL('../assets/enemies/murmuring-abyss/voidCrawler/sheets/block.png', import.meta.url).href,
      hit: new URL('../assets/enemies/murmuring-abyss/voidCrawler/sheets/hit.png', import.meta.url).href,
      death: new URL('../assets/enemies/murmuring-abyss/voidCrawler/sheets/death.png', import.meta.url).href,
    }
  },
  voidStalker: {
    layout: voidStalkerLayout,
    urls: {
      idle: new URL('../assets/enemies/murmuring-abyss/voidStalker/sheets/idle.png', import.meta.url).href,
      walk: new URL('../assets/enemies/murmuring-abyss/voidStalker/sheets/walk.png', import.meta.url).href,
      attack: new URL('../assets/enemies/murmuring-abyss/voidStalker/sheets/attack.png', import.meta.url).href,
      leap: new URL('../assets/enemies/murmuring-abyss/voidStalker/sheets/leap.png', import.meta.url).href,
      block: new URL('../assets/enemies/murmuring-abyss/voidStalker/sheets/block.png', import.meta.url).href,
      hit: new URL('../assets/enemies/murmuring-abyss/voidStalker/sheets/hit.png', import.meta.url).href,
      death: new URL('../assets/enemies/murmuring-abyss/voidStalker/sheets/death.png', import.meta.url).href,
    }
  },
  voidKeeper: {
    layout: voidKeeperLayout,
    urls: {
      idle: new URL('../assets/enemies/murmuring-abyss/voidKeeper/sheets/idle.png', import.meta.url).href,
      walk: new URL('../assets/enemies/murmuring-abyss/voidKeeper/sheets/walk.png', import.meta.url).href,
      attack: new URL('../assets/enemies/murmuring-abyss/voidKeeper/sheets/attack.png', import.meta.url).href,
      cast: new URL('../assets/enemies/murmuring-abyss/voidKeeper/sheets/cast.png', import.meta.url).href,
      area: new URL('../assets/enemies/murmuring-abyss/voidKeeper/sheets/area.png', import.meta.url).href,
      block: new URL('../assets/enemies/murmuring-abyss/voidKeeper/sheets/block.png', import.meta.url).href,
      hit: new URL('../assets/enemies/murmuring-abyss/voidKeeper/sheets/hit.png', import.meta.url).href,
      death: new URL('../assets/enemies/murmuring-abyss/voidKeeper/sheets/death.png', import.meta.url).href,
    }
  },
  abyssalSovereign: {
    layout: abyssalSovereignLayout,
    urls: {
      idle: new URL('../assets/enemies/murmuring-abyss/abyssalSovereign/sheets/idle.png', import.meta.url).href,
      walk: new URL('../assets/enemies/murmuring-abyss/abyssalSovereign/sheets/walk.png', import.meta.url).href,
      attack: new URL('../assets/enemies/murmuring-abyss/abyssalSovereign/sheets/attack.png', import.meta.url).href,
      cast: new URL('../assets/enemies/murmuring-abyss/abyssalSovereign/sheets/cast.png', import.meta.url).href,
      area: new URL('../assets/enemies/murmuring-abyss/abyssalSovereign/sheets/area.png', import.meta.url).href,
      block: new URL('../assets/enemies/murmuring-abyss/abyssalSovereign/sheets/block.png', import.meta.url).href,
      hit: new URL('../assets/enemies/murmuring-abyss/abyssalSovereign/sheets/hit.png', import.meta.url).href,
      death: new URL('../assets/enemies/murmuring-abyss/abyssalSovereign/sheets/death.png', import.meta.url).href,
    }
  },
  voidWisp: {
    layout: voidWispLayout,
    urls: {
      idle: new URL('../assets/enemies/murmuring-abyss/voidWisp/sheets/idle.png', import.meta.url).href,
      walk: new URL('../assets/enemies/murmuring-abyss/voidWisp/sheets/walk.png', import.meta.url).href,
      attack: new URL('../assets/enemies/murmuring-abyss/voidWisp/sheets/attack.png', import.meta.url).href,
      cast: new URL('../assets/enemies/murmuring-abyss/voidWisp/sheets/cast.png', import.meta.url).href,
      block: new URL('../assets/enemies/murmuring-abyss/voidWisp/sheets/block.png', import.meta.url).href,
      hit: new URL('../assets/enemies/murmuring-abyss/voidWisp/sheets/hit.png', import.meta.url).href,
      death: new URL('../assets/enemies/murmuring-abyss/voidWisp/sheets/death.png', import.meta.url).href,
    }
  },
};

const rows = {
  south: 0, 'south-east': 0, east: 0, 'south-west': 1,
  west: 1, north: 2, 'north-east': 2, 'north-west': 3
};
const scales = { voidCrawler: 0.85, voidStalker: 0.95, voidKeeper: 1.1, abyssalSovereign: 1.6, voidWisp: 0.8 };
const projectileUrl = new URL('../assets/enemies/murmuring-abyss/voidWisp/sheets/projectile.png', import.meta.url).href;

// Match each playable clip to its accepted row, keeping equipment and limbs unmirrored.
function createVoidSprite(id, source) {
  const { layout, urls } = source;
  const textures = Object.entries(urls).map(([state, url]) => ({
    key: `${id}-${state}`, url, frameWidth: layout.frameWidth, frameHeight: layout.frameHeight
  }));
  const clips = {};
  for (const state of Object.keys(urls)) {
    clips[state] = {};
    const spec = layout.states[state];
    for (const [direction, row] of Object.entries(rows)) {
      const authoredDirection = layout.directions[row];
      const origin = layout.origins[authoredDirection];

      // Columns may include empty padding. Use the row's playable count so animation
      // never steps into that padding, and keep the same anchor through the whole clip.
      clips[state][direction] = {
        frameMs: spec.frameMs,
        frames: Array.from({ length: spec.counts[authoredDirection] }, (_, column) => ({
          key: `${id}-${state}`, frame: row * spec.columns + column,
          originX: origin.x, originY: origin.y, flipX: false
        }))
      };
    }
  }
  clips.dead = Object.fromEntries(Object.entries(clips.death).map(([direction, clip]) => [
    direction, { frameMs: 1000, frames: [clip.frames.at(-1)] }
  ]));

  // All void ranged spells reuse the Wisp's accepted bolt, rotated during flight.
  const effect = voidWispLayout.effects.projectile;
  const projectile = { key: 'void-bolt', columns: effect.columns, frameMs: effect.frameMs };
  textures.push({ key: projectile.key, url: projectileUrl, frameWidth: 256, frameHeight: 256 });
  return { textures, clips, scale: scales[id], footY: 0,
    topFrameY: layout.topFrameY ?? 32, projectile };
}

export const VOID_SPRITES = Object.fromEntries(
  Object.entries(sources).map(([id, source]) => [id, createVoidSprite(id, source)])
);

// Older saved battles and the retained Verdant Tear still refer to these archetypes.
// Keep those IDs resolving to accepted artwork without migrating or discarding saves.
VOID_SPRITES.voidWarden = VOID_SPRITES.voidKeeper;
VOID_SPRITES.abyssalMaw = VOID_SPRITES.voidKeeper;
VOID_SPRITES.riftSentinel = VOID_SPRITES.voidStalker;
VOID_SPRITES.voidKeeperGuardian = VOID_SPRITES.voidKeeper;

// Queue each unique texture once, including the shared projectile and legacy aliases.
export function preloadVoidSprites(scene) {
  const queued = new Set();
  for (const sprite of Object.values(VOID_SPRITES)) {
    for (const { key, url, frameWidth, frameHeight } of sprite.textures) {
      if (queued.has(key)) continue;
      queued.add(key);
      if (!scene.textures.exists(key)) scene.load.spritesheet(key, url, { frameWidth, frameHeight });
    }
  }
}
