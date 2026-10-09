// This is the translation between the flat gameplay arena and the visible floor. Logical
// coordinates let distance and reach stay consistent. Screen coordinates follow the
// artwork's perspective: the visible span can narrow toward the back. The authored polygon
// is the actual walkable outline, so the bounding rectangle alone is not enough to
// validate feet.

import Phaser from 'phaser';

export default class BattlefieldGeometry {

  // This helper defines the arena dimensions and perspective used by combat.
  constructor(scene, config) {

    this.scene = scene;
    this.bottomLeftX = config.bottomLeftX;
    this.bottomRightX = config.bottomRightX;
    this.topLeftX = config.topLeftX;
    this.topRightX = config.topRightX;
    this.bottomY = config.bottomY;
    this.topY = config.topY;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    this.logicalWidth = config.logicalWidth ?? 1000;
    this.logicalHeight = config.logicalHeight ?? 1000;
    this.nearScale = config.nearScale ?? 1;
    this.farScale = config.farScale ?? 0.72;
    this.minEllipseHeight = config.minEllipseHeight ?? 14;
    this.boundary = config.boundary ?? [
      { x: this.bottomLeftX, y: this.bottomY }, { x: this.bottomRightX, y: this.bottomY },
      { x: this.topRightX, y: this.topY }, { x: this.topLeftX, y: this.topY }
    ];

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    this.logicalBoundary = this.boundary.map(p => this.screenToArenaUnchecked(p.x, p.y));
  }

  // This helper measures arena depth so perspective stays consistent.
  getDepthRatio(arenaY) {

    // Clamp keeps the first argument between the lower bound (second argument) and upper
    // bound (third argument).
    return Phaser.Math.Clamp(arenaY / this.logicalHeight, 0, 1);
  }

  // This helper finds the visible floor width and height at this depth.
  getSpanAt(arenaY) {

    const depthRatio = this.getDepthRatio(arenaY);

    // Linear blends from the first value to the second using the third argument: 0 gives
    // the start, 1 gives the end, and 0.5 gives halfway.
    const leftX = Phaser.Math.Linear(this.bottomLeftX, this.topLeftX, depthRatio);
    const rightX = Phaser.Math.Linear(this.bottomRightX, this.topRightX, depthRatio);
    const y = Phaser.Math.Linear(this.bottomY, this.topY, depthRatio);

    return { leftX, rightX, y, width: rightX - leftX, depthRatio };
  }

  // This helper converts a logical arena position into a display position on the
  // trapezoid-shaped battlefield. The horizontal span narrows with depth, while the
  // returned depth and width can also be used by visual effects.
  arenaToScreen(arenaX, arenaY) {

    // Clamp arena coordinates first so the projection stays inside the battlefield.
    const clampedX = Phaser.Math.Clamp(arenaX, 0, this.logicalWidth);

    // Clamp keeps the first argument between the lower bound (second argument) and upper
    // bound (third argument).
    const clampedY = Phaser.Math.Clamp(arenaY, 0, this.logicalHeight);
    const span = this.getSpanAt(clampedY);

    // Linear blends from the first value to the second using the third argument: 0 gives
    // the start, 1 gives the end, and 0.5 gives halfway.
    return {
      x: Phaser.Math.Linear(span.leftX, span.rightX, clampedX / this.logicalWidth),
      y: span.y,
      depthRatio: span.depthRatio,
      widthAtDepth: span.width
    };
  }

  // This helper converts a screen position back into logical arena coordinates.
  screenToArena(screenX, screenY) {

    // topY - bottomY is signed because the back of the floor is higher on screen. Dividing
    // by that same signed span gives 0 at the front and 1 at the back. A near-zero span
    // would divide by zero, so we reject it before calculating.
    const screenHeight = this.topY - this.bottomY;
    if (Math.abs(screenHeight) < 0.001) return null;
    const depthRatio = (screenY - this.bottomY) / screenHeight;

    if (depthRatio < 0 || depthRatio > 1) return null;
    const arenaY = depthRatio * this.logicalHeight;
    const span = this.getSpanAt(arenaY);

    if (screenX < span.leftX || screenX > span.rightX || span.width <= 0) return null;

    // Subtract the visible left edge to make x local to this depth's floor span. Divide by
    // the span width to get a fraction, then multiply by logicalWidth to return to
    // gameplay distance units.
    const arenaX = ((screenX - span.leftX) / span.width) * this.logicalWidth;
    return { x: arenaX, y: arenaY };
  }

  // This helper keeps destinations inside the arena with room at the edges.
  clampPoint(arenaX, arenaY, paddingX = 0, paddingY = 0) {

    // Clamp keeps the first argument between the lower bound (second argument) and upper
    // bound (third argument).
    return {
      x: Phaser.Math.Clamp(arenaX, paddingX, this.logicalWidth - paddingX),
      y: Phaser.Math.Clamp(arenaY, paddingY, this.logicalHeight - paddingY)
    };
  }

  // This helper makes distant units smaller to match the floor perspective.
  getUnitScale(arenaY) {

    // Linear blends from the first value to the second using the third argument: 0 gives
    // the start, 1 gives the end, and 0.5 gives halfway.
    return Phaser.Math.Linear(this.nearScale, this.farScale, this.getDepthRatio(arenaY));
  }

  // This helper sizes ground warnings to match their depth in the arena.
  getGroundEllipseRadii(radius, arenaY) {

    const span = this.getSpanAt(arenaY);

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    return {
      width: Math.max(18, radius * (span.width / this.logicalWidth)),
      height: Math.max(this.minEllipseHeight, radius * (Math.abs(this.bottomY - this.topY) / this.logicalHeight) * 0.42)
    };
  }

  // Draw only the walkable perimeter, above foreground scenery for development review.
  drawArenaBorder(visible = true) {

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const graphics = this.scene.add.graphics().setDepth(4400);
    if (!visible) return graphics;
    graphics.lineStyle(4, 0xfacc15, 0.95);
    graphics.strokePoints(this.boundary, true);

    return graphics;
  }

  // Unclipped inversion lets terrain reject feet outside the authored perimeter.
  screenToArenaUnchecked(screenX, screenY) {

    // This reverses the projection without rejecting points outside the floor. That is
    // intentional: terrain checks need the actual out-of-bounds point in order to reject
    // it, rather than a point already clamped onto the edge.
    const y = (screenY - this.bottomY) / (this.topY - this.bottomY) * this.logicalHeight;
    const span = this.getSpanAt(y);
    return { x: (screenX - span.leftX) / span.width * this.logicalWidth, y };
  }

  // We test the authored floor polygon by casting an imaginary horizontal ray from the
  // point. Each crossing flips inside; an odd count means we are inside. For padding,
  // project the point onto each edge and measure the distance to it. This also rejects a
  // foot position too close to the edge, even if its center is inside.
  containsArenaPoint(x, y, padding = 0) {

    // A 64-unit square safely inside the floor can answer repeated foot queries without
    // walking every polygon edge. The enclosing circle reaches every corner, so checking
    // its center with that extra clearance proves the entire square is legal. Positions
    // near an edge still use the exact original test below, with no coordinate rounding.
    if (padding >= 0 && padding <= 64 && x >= 0 && y >= 0
      && x < this.logicalWidth && y < this.logicalHeight) {
      if (this.floorQueryPolygon !== this.logicalBoundary) {
        this.floorQueryPolygon = this.logicalBoundary;
        this.floorQueryCache = new Map();
      }
      let cells = this.floorQueryCache.get(padding);
      if (!cells) {

        // Bound memory even if a future ability asks for many different clearances.
        if (this.floorQueryCache.size >= 8) this.floorQueryCache.clear();
        cells = new Map();
        this.floorQueryCache.set(padding, cells);
      }
      const column = Math.floor(x / 64);
      const row = Math.floor(y / 64);
      const key = row * Math.ceil(this.logicalWidth / 64) + column;
      let safe = cells.get(key);
      if (safe === undefined) {
        safe = this.containsArenaPointExact(column * 64 + 32, row * 64 + 32,
          padding + Math.SQRT2 * 32 + 0.000001);
        cells.set(key, safe);
      }
      if (safe) return true;
    }

    return this.containsArenaPointExact(x, y, padding);
  }

  // Keep the full polygon test for edge squares and unusually large clearance queries.
  containsArenaPointExact(x, y, padding = 0) {
    const polygon = this.logicalBoundary;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {

      // i is the current vertex and j is the previous one. Starting j at the last vertex
      // also tests the closing edge from the last point back to the first.
      const a = polygon[i], b = polygon[j];

      // Only edges that straddle this y can cross our horizontal ray. The fraction (y -
      // a.y) / (b.y - a.y) finds the crossing point along the edge. If that crossing is to
      // the right of x, flip the inside/outside result.
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;

      // An unpadded query only needs the ray crossing. Navigation makes many of these
      // checks, so skip the distance calculation when it cannot affect the answer.
      if (padding <= 0) continue;

      // dx/dy are the edge's direction. The dot product in t measures how far along that
      // edge the point projects. Divide by squared edge length, then clamp t to 0..1 so
      // the nearest point stays on the segment rather than its infinite line.
      const dx = b.x - a.x, dy = b.y - a.y;

      // Math.max chooses the largest value; pairing it with Math.min can keep a result
      // inside both a lower and an upper bound.
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));

      // a + t * direction is the nearest point on this edge. If our position is closer
      // than padding, the feet would crowd the boundary, so reject it.
      const edgeDistanceX = x - a.x - t * dx;
      const edgeDistanceY = y - a.y - t * dy;

      // Compare squared distances in arena units. This avoids a square root for every
      // edge while keeping the same strict clearance rule.
      if (edgeDistanceX * edgeDistanceX + edgeDistanceY * edgeDistanceY < padding * padding) return false;
    }

    return inside;
  }
}
