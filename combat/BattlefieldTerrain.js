import Phaser from 'phaser';

// Encounter terrain lives in the same logical coordinate space as combat. That means obstacles keep working when the visible battlefield trapezoid, device resolution, or perspective changes.
export default class BattlefieldTerrain {
  constructor(scene, battlefield, zones = []) {
    this.scene = scene;
    this.battlefield = battlefield;
    this.avoidanceStates = new WeakMap();
    this.zones = zones.map((zone, index) => ({
      id: zone.id ?? `terrain-${index}`,
      type: zone.type ?? 'blocked',
      points: (zone.points ?? []).map(point => ({ x: point.x, y: point.y }))
    })).filter(zone => zone.points.length >= 3);
  }

  get blockedZones() {
    return this.zones.filter(zone => zone.type === 'blocked');
  }

  containsPoint(zone, x, y) {
    return Phaser.Geom.Polygon.Contains(new Phaser.Geom.Polygon(zone.points), x, y);
  }

  isBlocked(x, y, padding = 0) {
    if (!this.battlefield.containsArenaPoint(x, y, padding)) return true;
    if (x < padding || y < padding
      || x > this.battlefield.logicalWidth - padding
      || y > this.battlefield.logicalHeight - padding) return true;

    return this.blockedZones.some(zone => {
      if (this.containsPoint(zone, x, y)) return true;
      if (padding <= 0) return false;
      return zone.points.some((point, index) => {
        const next = zone.points[(index + 1) % zone.points.length];
        const edgeX = next.x - point.x;
        const edgeY = next.y - point.y;
        const lengthSquared = edgeX * edgeX + edgeY * edgeY;
        const t = lengthSquared > 0
          ? Phaser.Math.Clamp(((x - point.x) * edgeX + (y - point.y) * edgeY) / lengthSquared, 0, 1)
          : 0;
        const nearestX = point.x + edgeX * t;
        const nearestY = point.y + edgeY * t;
        return Math.hypot(x - nearestX, y - nearestY) <= padding;
      });
    });
  }

  // Convert a unit's visual bottom-center into the logical floor point used for terrain collision.
  getUnitFootPoint(unit, arenaX = unit.arenaX, arenaY = unit.arenaY) {
    const center = this.battlefield.arenaToScreen(arenaX, arenaY);
    const scale = this.battlefield.getUnitScale(arenaY);
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
      const samples = Math.max(12, Math.ceil(Math.PI * 2 * radius / step));
      for (let i = 0; i < samples; i += 1) {
        const angle = i * Math.PI * 2 / samples;
        const candidate = this.battlefield.clampPoint(
          base.x + Math.cos(angle) * radius,
          base.y + Math.sin(angle) * radius
        );
        if (!this.isUnitBlocked(unit, candidate.x, candidate.y, footRadius)) return candidate;
      }
    }
    return base;
  }

  // Return the closest usable point when a formation or tap lands in terrain. A radial search keeps encounter data simple and also handles irregular polygons without requiring hand-authored escape points.
  nearestSafePoint(x, y, padding = 0) {
    const base = this.battlefield.clampPoint(x, y, padding, padding);
    if (!this.isBlocked(base.x, base.y, padding)) return base;

    const step = 24;
    for (let radius = step; radius <= 420; radius += step) {
      const samples = Math.max(12, Math.ceil(Math.PI * 2 * radius / step));
      for (let i = 0; i < samples; i += 1) {
        const angle = i * Math.PI * 2 / samples;
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

  // Keep movement legal at the unit's feet and hold a stable avoidance side while navigating tight corners.
  resolveStep(unit, targetX, targetY, footRadius = 0) {
    const currentBlocked = this.isUnitBlocked(unit, unit.arenaX, unit.arenaY, footRadius);
    if (currentBlocked) {
      const recovery = this.nearestSafeUnitPoint(unit, unit.arenaX, unit.arenaY, footRadius);
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
      const seed = String(unit.id ?? '').split('').reduce((total, char) => total + char.charCodeAt(0), 0);
      state = { side: seed % 2 === 0 ? 1 : -1, clearFrames: 0, blockedFrames: 0 };
      this.avoidanceStates.set(unit, state);
    }
    state.clearFrames = 0;
    state.blockedFrames += 1;

    const baseAngle = Math.atan2(dy, dx);
    const turns = [18, 35, 55, 75, 95, 120, 150, 180];
    const sides = state.blockedFrames < 24 ? [state.side, -state.side] : [-state.side, state.side];

    for (const side of sides) {
      for (const degrees of turns) {
        const angle = baseAngle + Phaser.Math.DegToRad(degrees * side);
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

  // Optional developer overlay. Call this from BattleScene while tuning an encounter to see the logical obstacle polygons projected over the art.
  drawDebug() {
    const graphics = this.scene.add.graphics().setDepth(34);
    this.blockedZones.forEach(zone => {
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
