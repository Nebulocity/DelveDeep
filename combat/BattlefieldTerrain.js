import Phaser from 'phaser';

// Encounter terrain lives in the same logical coordinate space as combat. That means obstacles keep working when the visible battlefield trapezoid, device resolution, or perspective changes.
export default class BattlefieldTerrain {
  constructor(scene, battlefield, zones = []) {
    this.scene = scene;
    this.battlefield = battlefield;
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

  // Keep a continuous movement step out of blocked terrain. If the direct step is blocked, try progressively wider left/right steering angles. This gives units lightweight obstacle avoidance while preserving their existing continuous movement and personal-space behavior.
  resolveStep(unit, targetX, targetY, padding = 0) {
    if (!this.isBlocked(targetX, targetY, padding)) return { x: targetX, y: targetY };

    const dx = targetX - unit.arenaX;
    const dy = targetY - unit.arenaY;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.001) return { x: unit.arenaX, y: unit.arenaY };

    const baseAngle = Math.atan2(dy, dx);
    const turns = [18, -18, 35, -35, 55, -55, 75, -75, 95, -95, 120, -120, 150, -150, 180];
    for (const degrees of turns) {
      const angle = baseAngle + Phaser.Math.DegToRad(degrees);
      const candidate = {
        x: unit.arenaX + Math.cos(angle) * distance,
        y: unit.arenaY + Math.sin(angle) * distance
      };
      if (!this.isBlocked(candidate.x, candidate.y, padding)) return candidate;
    }
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
