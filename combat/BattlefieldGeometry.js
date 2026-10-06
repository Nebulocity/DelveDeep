import Phaser from 'phaser';

export default class BattlefieldGeometry {

  // This function defines the arena dimensions and perspective used by
  // combat.
  constructor(scene, config) {

    this.scene = scene;
    this.bottomLeftX = config.bottomLeftX;
    this.bottomRightX = config.bottomRightX;
    this.topLeftX = config.topLeftX;
    this.topRightX = config.topRightX;
    this.bottomY = config.bottomY;
    this.topY = config.topY;
    this.logicalWidth = config.logicalWidth ?? 1000;
    this.logicalHeight = config.logicalHeight ?? 1000;
    this.nearScale = config.nearScale ?? 1;
    this.farScale = config.farScale ?? 0.72;
    this.minEllipseHeight = config.minEllipseHeight ?? 14;
    this.boundary = config.boundary ?? [
      { x: this.bottomLeftX, y: this.bottomY }, { x: this.bottomRightX, y: this.bottomY },
      { x: this.topRightX, y: this.topY }, { x: this.topLeftX, y: this.topY }
    ];
    this.logicalBoundary = this.boundary.map(p => this.screenToArenaUnchecked(p.x, p.y));
  }

  // This function measures arena depth so perspective stays consistent.
  getDepthRatio(arenaY) {

    return Phaser.Math.Clamp(arenaY / this.logicalHeight, 0, 1);
  }

  // This function finds the visible floor width and height at this depth.
  getSpanAt(arenaY) {

    const depthRatio = this.getDepthRatio(arenaY);
    const leftX = Phaser.Math.Linear(this.bottomLeftX, this.topLeftX, depthRatio);
    const rightX = Phaser.Math.Linear(this.bottomRightX, this.topRightX, depthRatio);
    const y = Phaser.Math.Linear(this.bottomY, this.topY, depthRatio);
    return { leftX, rightX, y, width: rightX - leftX, depthRatio };
  }

  // This function converts a logical arena position into a display position
  // on the trapezoid-shaped battlefield. The horizontal span narrows with
  // depth, while the returned depth and width can also be used by visual
  // effects.
  arenaToScreen(arenaX, arenaY) {

    // Clamp arena coordinates first so the projection stays inside the
    // battlefield.
    const clampedX = Phaser.Math.Clamp(arenaX, 0, this.logicalWidth);
    const clampedY = Phaser.Math.Clamp(arenaY, 0, this.logicalHeight);
    const span = this.getSpanAt(clampedY);
    return {
      x: Phaser.Math.Linear(span.leftX, span.rightX, clampedX / this.logicalWidth),
      y: span.y,
      depthRatio: span.depthRatio,
      widthAtDepth: span.width
    };
  }

  // This function converts a screen position back into logical arena coordinates.
  screenToArena(screenX, screenY) {

    const screenHeight = this.topY - this.bottomY;
    if (Math.abs(screenHeight) < 0.001) return null;
    const depthRatio = (screenY - this.bottomY) / screenHeight;
    if (depthRatio < 0 || depthRatio > 1) return null;
    const arenaY = depthRatio * this.logicalHeight;
    const span = this.getSpanAt(arenaY);
    if (screenX < span.leftX || screenX > span.rightX || span.width <= 0) return null;
    const arenaX = ((screenX - span.leftX) / span.width) * this.logicalWidth;
    return { x: arenaX, y: arenaY };
  }

  // This function keeps destinations inside the arena with room at the edges.
  clampPoint(arenaX, arenaY, paddingX = 0, paddingY = 0) {

    return {
      x: Phaser.Math.Clamp(arenaX, paddingX, this.logicalWidth - paddingX),
      y: Phaser.Math.Clamp(arenaY, paddingY, this.logicalHeight - paddingY)
    };
  }

  // This function makes distant units smaller to match the floor perspective.
  getUnitScale(arenaY) {

    return Phaser.Math.Linear(this.nearScale, this.farScale, this.getDepthRatio(arenaY));
  }

  // This function sizes ground warnings to match their depth in the arena.
  getGroundEllipseRadii(radius, arenaY) {

    const span = this.getSpanAt(arenaY);
    return {
      width: Math.max(18, radius * (span.width / this.logicalWidth)),
      height: Math.max(this.minEllipseHeight, radius * (Math.abs(this.bottomY - this.topY) / this.logicalHeight) * 0.42)
    };
  }

  // Draw only the walkable perimeter, above foreground scenery for development review.
  drawArenaBorder(visible = true) {
    const graphics = this.scene.add.graphics().setDepth(4400);
    if (!visible) return graphics;
    graphics.lineStyle(4, 0xfacc15, 0.95);
    graphics.strokePoints(this.boundary, true);
    return graphics;
  }

  // Unclipped inversion lets terrain reject feet outside the authored perimeter.
  screenToArenaUnchecked(screenX, screenY) {
    const y = (screenY - this.bottomY) / (this.topY - this.bottomY) * this.logicalHeight;
    const span = this.getSpanAt(y);
    return { x: (screenX - span.leftX) / span.width * this.logicalWidth, y };
  }

  containsArenaPoint(x, y, padding = 0) {
    const polygon = this.logicalBoundary;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
      if (padding > 0 && Math.hypot(x - a.x - t * dx, y - a.y - t * dy) < padding) return false;
    }
    return inside;
  }
}
