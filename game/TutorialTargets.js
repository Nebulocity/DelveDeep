// Bounds are canvas coordinates, before CSS scaling. Camera matrices include viewport,
// zoom and rotation; getBounds includes the object's container transforms.
export function intersect(a, b) {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const width = Math.min(a.x + a.width, b.x + b.width) - x;
  const height = Math.min(a.y + a.height, b.y + b.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

export function contains(bounds, point) {
  return !!bounds && !!point && point.x >= bounds.x && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

const GEOMETRY_KEYS = ['x', 'y', 'width', 'height', 'sx', 'sy', 'left', 'top', 'right', 'bottom',
  'a', 'b', 'c', 'd', 'e', 'f'];

export default class TutorialTargets {
  constructor() { this.entries = new Set(); this.generation = 0; }

  register(scene, id, options) {
    const entry = { scene, id, generation: ++this.generation, ...options };
    this.entries.add(entry);
    const remove = () => {
      this.entries.delete(entry);
      scene.events.off('shutdown', remove);
      entry.object?.off('destroy', remove);
    };
    scene.events.once('shutdown', remove);
    entry.object?.once('destroy', remove);
    return remove;
  }

  resolve(id, scene) {
    // Newest registration wins after a list rebuild. Old objects cannot regain grants.
    let result = null;
    for (const entry of this.entries) {
      if (entry.scene !== scene || (typeof entry.id === 'function' ? entry.id() : entry.id) !== id) continue;
      const live = this.live(entry);
      if (live) result = live;
    }
    return result;
  }

  live(entry) {
    const { scene, object } = entry;
    if (scene.sys.isActive() === false || entry.available?.() === false) return null;
    if (object && (!object.active || (!entry.visualOnly && !object.input?.enabled) || object.tutorialEnabled === false)) return null;
    const camera = entry.camera?.() ?? scene.cameras.main;
    if (!camera?.visible || camera.alpha === 0) return null;
    let factorX = 1, factorY = 1;
    let left = camera.x, top = camera.y, right = camera.x + camera.width, bottom = camera.y + camera.height;
    const clipTo = clip => {
      if (!clip) { right = left; return; }
      left = Math.max(left, clip.x); top = Math.max(top, clip.y);
      right = Math.min(right, clip.x + clip.width); bottom = Math.min(bottom, clip.y + clip.height);
    };
    for (let node = object; node; node = node.parentContainer) {
      if (!node.visible || node.alpha === 0 || node.cameraFilter & camera.id) return null;
      // Unknown masks fail closed. A producer must supply its actual clipping rectangle.
      if (node.mask && !node.tutorialClipBounds && !entry.clip) return null;
      factorX *= node.scrollFactorX ?? 1; factorY *= node.scrollFactorY ?? 1;
      if (node.tutorialClipBounds) clipTo(node.tutorialClipBounds);
    }
    if (entry.clip) clipTo(entry.clip());
    const supplied = entry.bounds?.(camera);
    const world = supplied ?? object?.getBounds?.(entry.worldBounds);
    if (!supplied && world) entry.worldBounds = world;
    if (!world || right <= left || bottom <= top) return null;
    const measurement = entry.measurement ??= {};
    measurement.x = world.x; measurement.y = world.y;
    measurement.width = world.width; measurement.height = world.height;
    measurement.sx = supplied ? 0 : camera.scrollX * factorX;
    measurement.sy = supplied ? 0 : camera.scrollY * factorY;
    measurement.left = left; measurement.top = top; measurement.right = right; measurement.bottom = bottom;
    measurement.a = camera.matrix.a; measurement.b = camera.matrix.b; measurement.c = camera.matrix.c;
    measurement.d = camera.matrix.d; measurement.e = camera.matrix.e; measurement.f = camera.matrix.f;
    if (entry.cached && GEOMETRY_KEYS.every(key => entry.stamp[key] === measurement[key])) return entry.cached;
    if (![world.x, world.y, world.width, world.height].every(Number.isFinite)) return null;
    let bounds = supplied;
    if (!bounds) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const point = entry.point ??= {};
      for (let corner = 0; corner < 4; corner++) {
        camera.matrix.transformPoint(world.x + (corner & 1 ? world.width : 0) - measurement.sx,
          world.y + (corner & 2 ? world.height : 0) - measurement.sy, point);
        minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
      }
      bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    bounds = intersect(bounds, { x: left, y: top, width: right - left, height: bottom - top });
    if (!bounds) return null;
    entry.stamp = { ...measurement };
    const { cached, stamp, measurement: measured, point, worldBounds, ...descriptor } = entry;
    entry.cached = { ...descriptor, bounds, camera };
    return entry.cached;
  }

}
