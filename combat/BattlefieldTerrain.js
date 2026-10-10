// Geometry gives us the floor outline; this module checks whether a particular spot is
// legal for a unit's feet. A visual rock or root does not automatically block movement.
// Use the authored walkable polygon and actual blocking zones, then look for a nearby
// legal point when a requested destination falls outside them.

import Phaser from 'phaser';

// Encounter terrain lives in the same logical coordinate space as combat. That means
// obstacles keep working when the visible battlefield trapezoid, device resolution, or
// perspective changes.
export default class BattlefieldTerrain {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods. scene is the Phaser screen that owns
  // the objects, clock and input used here.
  constructor(scene, battlefield, zones = []) {
    this.scene = scene;
    this.battlefield = battlefield;

    // WeakMap stores object references without keeping unused objects alive. That is
    // useful for temporary per-object bookkeeping.
    this.avoidanceStates = new WeakMap();

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place. map builds one output entry for each input entry, in the
    // same order. The callback's return value becomes that output entry.
    this.zones = zones.map((zone, index) => ({
      id: zone.id ?? `terrain-${index}`,
      type: zone.type ?? 'blocked',
      points: (zone.points ?? []).map(point => ({ x: point.x, y: point.y }))
    })).filter(zone => zone.points.length >= 3);
  }

  // Return the authored zones marked as actual movement blockers.
  get blockedZones() {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    return this.zones.filter(zone => zone.type === 'blocked');
  }

  // Test whether the supplied arena point lies inside this zone's polygon.
  containsPoint(zone, x, y) {
    return Phaser.Geom.Polygon.Contains(new Phaser.Geom.Polygon(zone.points), x, y);
  }

  // Reject a point outside the walkable floor, beyond padded bounds or too close to
  // blocking terrain.
  isBlocked(x, y, padding = 0) {
    if (!this.battlefield.containsArenaPoint(x, y, padding)) return true;
    if (x < padding || y < padding
      || x > this.battlefield.logicalWidth - padding
      || y > this.battlefield.logicalHeight - padding) return true;

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    return this.blockedZones.some(zone => {
      if (this.containsPoint(zone, x, y)) return true;
      if (padding <= 0) return false;

      // some stops with true as soon as one entry passes the check; an empty list gives
      // false.
      return zone.points.some((point, index) => {

        // % gives the remainder. With a nonnegative index and positive list length, it
        // wraps the index back to the start of the list.
        const next = zone.points[(index + 1) % zone.points.length];
        const edgeX = next.x - point.x;
        const edgeY = next.y - point.y;
        const lengthSquared = edgeX * edgeX + edgeY * edgeY;

        // The condition before ? chooses the first value when true and the value after :
        // when false. Clamp keeps the first argument between the lower bound (second
        // argument) and upper bound (third argument).
        const t = lengthSquared > 0
          ? Phaser.Math.Clamp(((x - point.x) * edgeX + (y - point.y) * edgeY) / lengthSquared, 0, 1)
          : 0;
        const nearestX = point.x + edgeX * t;
        const nearestY = point.y + edgeY * t;

        // Math.hypot calculates straight-line length from the x/y differences: square
        // each, add them, then take the square root.
        return Math.hypot(x - nearestX, y - nearestY) <= padding;
      });
    });
  }

  // Convert a unit's visual bottom-center into the logical floor point used for terrain
  // collision.
  getUnitFootPoint(unit, arenaX = unit.arenaX, arenaY = unit.arenaY) {
    const center = this.battlefield.arenaToScreen(arenaX, arenaY);
    const scale = this.battlefield.getUnitScale(arenaY);

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const footScreenY = center.y + (unit.spriteVisual?.definition.footY ?? unit.bodyRadius ?? 0) * scale;
    return this.battlefield.screenToArenaUnchecked(center.x, footScreenY);
  }

  // Check terrain against the unit's feet instead of its visual body.
  isUnitBlocked(unit, arenaX = unit.arenaX, arenaY = unit.arenaY, footRadius = 0) {
    const foot = this.getUnitFootPoint(unit, arenaX, arenaY);
    return this.isBlocked(foot.x, foot.y, footRadius);
  }

  // Return a safe center position while testing the unit's feet against terrain.
  nearestSafeUnitPoint(unit, x, y, footRadius = 0) {
    const base = this.battlefield.clampPoint(x, y);
    if (!this.isUnitBlocked(unit, base.x, base.y, footRadius)) return base;

    const step = 24;
    for (let radius = step; radius <= 420; radius += step) {

      // Math.max chooses the largest value; pairing it with Math.min can keep a result
      // inside both a lower and an upper bound. Math.ceil rounds upward to the next
      // integer, including when the value has a fractional part.
      const samples = Math.max(12, Math.ceil(Math.PI * 2 * radius / step));
      for (let i = 0; i < samples; i += 1) {
        const angle = i * Math.PI * 2 / samples;

        // Angles are radians. cos(angle) gives the horizontal part of a circle; sin(angle)
        // gives the vertical part. Multiplying by a radius turns those fractions into
        // offsets.
        const candidate = this.battlefield.clampPoint(
          base.x + Math.cos(angle) * radius,
          base.y + Math.sin(angle) * radius
        );

        if (!this.isUnitBlocked(unit, candidate.x, candidate.y, footRadius)) return candidate;
      }
    }

    return base;
  }

  // Return the closest usable point when a formation or tap lands in terrain. A radial
  // search keeps encounter data simple and also handles irregular polygons without
  // requiring hand-authored escape points.
  nearestSafePoint(x, y, padding = 0) {
    const base = this.battlefield.clampPoint(x, y, padding, padding);
    if (!this.isBlocked(base.x, base.y, padding)) return base;

    const step = 24;
    for (let radius = step; radius <= 420; radius += step) {

      // Math.max chooses the largest value; pairing it with Math.min can keep a result
      // inside both a lower and an upper bound. Math.ceil rounds upward to the next
      // integer, including when the value has a fractional part.
      const samples = Math.max(12, Math.ceil(Math.PI * 2 * radius / step));
      for (let i = 0; i < samples; i += 1) {
        const angle = i * Math.PI * 2 / samples;

        // Angles are radians. cos(angle) gives the horizontal part of a circle; sin(angle)
        // gives the vertical part. Multiplying by a radius turns those fractions into
        // offsets.
        const candidate = this.battlefield.clampPoint(
          base.x + Math.cos(angle) * radius,
          base.y + Math.sin(angle) * radius,
          padding, padding
        );

        if (!this.isBlocked(candidate.x, candidate.y, padding)) return candidate;
      }
    }

    return base;
  }

  // Keep movement legal at the unit's feet and hold a stable avoidance side while
  // navigating tight corners.
  resolveStep(unit, targetX, targetY, footRadius = 0) {
    const currentBlocked = this.isUnitBlocked(unit, unit.arenaX, unit.arenaY, footRadius);
    if (currentBlocked) {
      const recovery = this.nearestSafeUnitPoint(unit, unit.arenaX, unit.arenaY, footRadius);

      // Math.hypot calculates straight-line length from the x/y differences: square each,
      // add them, then take the square root.
      if (Math.hypot(recovery.x - unit.arenaX, recovery.y - unit.arenaY) > 0.001) return recovery;
    }

    const directSafe = !this.isUnitBlocked(unit, targetX, targetY, footRadius);
    let state = this.avoidanceStates.get(unit);
    if (directSafe) {
      if (state) {
        state.clearFrames += 1;
        if (state.clearFrames >= 4) this.avoidanceStates.delete(unit);
      }

      return { x: targetX, y: targetY };
    }

    const dx = targetX - unit.arenaX;
    const dy = targetY - unit.arenaY;
    const distance = Math.hypot(dx, dy);

    if (distance < 0.001) return { x: unit.arenaX, y: unit.arenaY };

    if (!state) {

      // reduce carries an accumulated result from one entry to the next. The callback
      // returns the accumulator for the next step; the final argument supplies its
      // starting value. ?? uses the fallback only for null or undefined. A real zero or
      // false stays intact.
      const seed = String(unit.id ?? '').split('').reduce((total, char) => total + char.charCodeAt(0), 0);

      // The condition before ? chooses the first value when true and the value after :
      // when false. % gives the remainder. With a nonnegative index and positive list
      // length, it wraps the index back to the start of the list.
      state = { side: seed % 2 === 0 ? 1 : -1, clearFrames: 0, blockedFrames: 0 };
      this.avoidanceStates.set(unit, state);
    }

    state.clearFrames = 0;
    state.blockedFrames += 1;

    // atan2 takes the y difference first and x difference second, returning a direction
    // angle in radians with the correct quadrant.
    const baseAngle = Math.atan2(dy, dx);
    const turns = [18, 35, 55, 75, 95, 120, 150, 180];
    const sides = state.blockedFrames < 24 ? [state.side, -state.side] : [-state.side, state.side];

    for (const side of sides) {
      for (const degrees of turns) {
        const angle = baseAngle + Phaser.Math.DegToRad(degrees * side);

        // Angles are radians. cos(angle) gives the horizontal part of a circle; sin(angle)
        // gives the vertical part. Multiplying by a radius turns those fractions into
        // offsets.
        const candidate = {
          x: unit.arenaX + Math.cos(angle) * distance,
          y: unit.arenaY + Math.sin(angle) * distance
        };

        if (!this.isUnitBlocked(unit, candidate.x, candidate.y, footRadius)) {
          state.side = side;
          if (state.blockedFrames >= 24) state.blockedFrames = 0;
          return candidate;
        }
      }
    }

    const recovery = this.nearestSafeUnitPoint(unit, unit.arenaX, unit.arenaY, footRadius);
    if (Math.hypot(recovery.x - unit.arenaX, recovery.y - unit.arenaY) > 0.001) return recovery;
    return { x: unit.arenaX, y: unit.arenaY };
  }

  // Optional developer overlay. Call this from BattleScene while tuning an encounter to
  // see the logical obstacle polygons projected over the art.
  drawDebug() {

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const graphics = this.scene.add.graphics().setDepth(34);
    this.blockedZones.forEach(zone => {

      // map builds one output entry for each input entry, in the same order. The
      // callback's return value becomes that output entry.
      const points = zone.points.map(point => {
        const screen = this.battlefield.arenaToScreen(point.x, point.y);
        return new Phaser.Geom.Point(screen.x, screen.y);
      });
      graphics.fillStyle(0xef4444, 0.18);
      graphics.fillPoints(points, true);
      graphics.lineStyle(3, 0xef4444, 0.9);

      graphics.strokePoints(points, true);
    });

    return graphics;
  }
}
