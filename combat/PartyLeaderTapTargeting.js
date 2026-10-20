import { PARTY_LEADER_TAP as tuning } from '../config/partyLeaderTap.js';

const frameBounds = new WeakMap();

// Measure alpha once per displayed frame. Transparent sheet padding must not create
// enormous touch targets or make distant monsters appear to form a crowd.
function artworkBounds(image) {
  const frame = image.frame;
  if (frameBounds.has(frame)) return frameBounds.get(frame);
  let bounds = null;
  const canvas = document.createElement('canvas');
  try {
    const w = frame.cutWidth, h = frame.cutHeight;
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(frame.source.image, frame.cutX, frame.cutY, w, h, 0, 0, w, h);
    const pixels = context.getImageData(0, 0, w, h).data;
    let left = w, top = h, right = 0, bottom = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (pixels[(y * w + x) * 4 + 3] < 16) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    }
    if (right > left) bounds = { left: left + frame.x, top: top + frame.y,
      right: right + frame.x, bottom: bottom + frame.y };
  } catch {

    // A browser that denies canvas reads can still use the existing sprite bounds.
  }
  canvas.width = canvas.height = 0;
  frameBounds.set(frame, bounds);
  return bounds;
}

export function tapScreenScale(scene) {
  const rect = scene.game.canvas.getBoundingClientRect();
  return { x: scene.scale.width / Math.max(1, rect.width), y: scene.scale.height / Math.max(1, rect.height) };
}

function distance(point, bounds, scale) {
  return Math.hypot(Math.max(bounds.left - point.x, 0, point.x - bounds.right) / scale.x,
    Math.max(bounds.top - point.y, 0, point.y - bounds.bottom) / scale.y);
}

export function validTapEnemy(scene, enemy) {
  return scene.enemies.includes(enemy) && enemy.isEnemy && enemy.alive && enemy.hp > 0
    && !enemy.landing && !enemy.landingWaiting && !enemy.untargetable && enemy.targetable !== false
    && enemy.container?.active && enemy.container.visible;
}

export default class PartyLeaderTapTargeting {
  constructor(scene) { this.scene = scene; }

  regions() {
    const scene = this.scene;
    const camera = scene.cameras.main;
    const scale = tapScreenScale(scene);
    const project = (x, y) => {
      const point = camera.matrix.transformPoint(x - camera.scrollX, y - camera.scrollY);
      return { x: point.x, y: point.y };
    };
    return scene.enemies.filter(enemy => validTapEnemy(scene, enemy)).map(enemy => {
      const image = enemy.spriteVisual?.image ?? enemy.body;
      const alpha = enemy.spriteVisual ? artworkBounds(image) : null;
      const bounds = alpha ?? { left: 0, top: 0, right: image.width, bottom: image.height };
      const transform = image.getWorldTransformMatrix();
      const corners = [[bounds.left, bounds.top], [bounds.right, bounds.top],
        [bounds.left, bounds.bottom], [bounds.right, bounds.bottom]].map(([x, y]) => {
        if (image.flipX) x = image.width - x;
        if (image.flipY) y = image.height - y;
        const world = transform.transformPoint(x - image.displayOriginX, y - image.displayOriginY);
        return project(world.x, world.y);
      });
      const core = { left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
        top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)) };
      return { enemy, core, drawOrder: scene.children.getIndex(enemy.container),
        touch: { left: core.left - tuning.touchPaddingPx * scale.x,
        right: core.right + tuning.touchPaddingPx * scale.x, top: core.top - tuning.touchPaddingPx * scale.y,
        bottom: core.bottom + tuning.touchPaddingPx * scale.y } };
    });
  }

  resolve(point) {
    const scale = tapScreenScale(this.scene);
    const regions = this.regions();
    const direct = regions.filter(region => distance(point, region.touch, scale) === 0);
    const core = direct.filter(region => distance(point, region.core, scale) === 0);

    // Match the monster the player sees in front. Neither HP nor a remembered rear
    // target may redirect a tap through its overlapping visible footprint.
    if (core.length) return { enemy: this.prioritize(core, point, scale)[0].enemy, assisted: false };
    if (direct.length) return { enemy: this.prioritize(direct, point, scale)[0].enemy, assisted: false };
    const nearby = regions.filter(region => distance(point, region.touch, scale) <= tuning.assistanceRadiusPx);
    if (!nearby.length) return null;
    const seed = this.nearest(nearby, point, scale);
    const group = new Set([seed]);
    const pending = [seed];
    while (pending.length) {
      const a = pending.pop().touch;
      for (const region of regions) {
        if (group.has(region)) continue;
        const b = region.touch;
        const gap = Math.hypot(Math.max(a.left - b.right, b.left - a.right, 0) / scale.x,
          Math.max(a.top - b.bottom, b.top - a.bottom, 0) / scale.y);
        if (gap <= tuning.crowdGapPx) { group.add(region); pending.push(region); }
      }
    }
    const eligible = nearby.filter(region => group.has(region));
    if (group.size < tuning.crowdThreshold) return null;
    if (eligible.length < 2) return null;
    this.prioritize(eligible, point, scale);
    const first = eligible[0];
    return first ? { enemy: first.enemy, assisted: true } : null;
  }

  prioritize(regions, point, scale) {
    const value = (region, priority) => priority === 'frontDepth' ? -region.enemy.container.depth
      : priority === 'drawOrder' ? -region.drawOrder : priority === 'currentHp' ? region.enemy.hp
      : priority === 'tapDistance' ? this.centerDistance(region, point, scale) : region.enemy.id;
    return regions.sort((a, b) => {
      for (const priority of tuning.priorities) {
        const av = value(a, priority), bv = value(b, priority);
        if (av < bv) return -1;
        if (av > bv) return 1;
      }
      return 0;
    });
  }

  centerDistance(region, point, scale) {
    return Math.hypot((point.x - (region.core.left + region.core.right) / 2) / scale.x,
      (point.y - (region.core.top + region.core.bottom) / 2) / scale.y);
  }

  nearest(regions, point, scale) {
    return regions.slice().sort((a, b) => this.centerDistance(a, point, scale) - this.centerDistance(b, point, scale)
      || (String(a.enemy.id) < String(b.enemy.id) ? -1 : String(a.enemy.id) > String(b.enemy.id) ? 1 : 0))[0];
  }
}
