import Phaser from 'phaser';

export default class BattlefieldGeometry {
  // I define the arena dimensions and perspective used by combat.
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
    this.columns = config.columns ?? 8;
    this.rows = config.rows ?? 6;
  }

  // I measure arena depth so perspective stays consistent.
  getDepthRatio(arenaY) {

    return Phaser.Math.Clamp(arenaY / this.logicalHeight, 0, 1);
  }

  // I find the visible floor width and height at this depth.
  getSpanAt(arenaY) {

    const depthRatio = this.getDepthRatio(arenaY);
    const leftX = Phaser.Math.Linear(this.bottomLeftX, this.topLeftX, depthRatio);
    const rightX = Phaser.Math.Linear(this.bottomRightX, this.topRightX, depthRatio);
    const y = Phaser.Math.Linear(this.bottomY, this.topY, depthRatio);
    return { leftX, rightX, y, width: rightX - leftX, depthRatio };
  }

  // I project combat positions onto the perspective floor.
  arenaToScreen(arenaX, arenaY) {

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

  // I keep destinations inside the arena with room at the edges.
  clampPoint(arenaX, arenaY, paddingX = 0, paddingY = 0) {

    return {
      x: Phaser.Math.Clamp(arenaX, paddingX, this.logicalWidth - paddingX),
      y: Phaser.Math.Clamp(arenaY, paddingY, this.logicalHeight - paddingY)
    };
  }

  // I make distant units smaller to match the floor perspective.
  getUnitScale(arenaY) {

    return Phaser.Math.Linear(this.nearScale, this.farScale, this.getDepthRatio(arenaY));
  }

  // I size ground warnings to match their depth in the arena.
  getGroundEllipseRadii(radius, arenaY) {

    const span = this.getSpanAt(arenaY);
    return {
      width: Math.max(18, radius * (span.width / this.logicalWidth)),
      height: Math.max(this.minEllipseHeight, radius * (Math.abs(this.bottomY - this.topY) / this.logicalHeight) * 0.42)
    };
  }

  // I find the arena bounds of a tactical destination tile.
  getCellBounds(column, row) {

    const cellWidth = this.logicalWidth / this.columns;
    const cellHeight = this.logicalHeight / this.rows;
    return {
      left: column * cellWidth,
      right: (column + 1) * cellWidth,
      bottom: row * cellHeight,
      top: (row + 1) * cellHeight
    };
  }

  // I use the tile center as the anchor for movement orders.
  getCellCenter(column, row) {

    const b = this.getCellBounds(column, row);
    return { x: (b.left + b.right) / 2, y: (b.bottom + b.top) / 2 };
  }

  // I match each touch target to its visible floor tile.
  getCellPolygon(column, row) {

    const b = this.getCellBounds(column, row);
    return [
      this.arenaToScreen(b.left, b.bottom),
      this.arenaToScreen(b.right, b.bottom),
      this.arenaToScreen(b.right, b.top),
      this.arenaToScreen(b.left, b.top)
    ].map((p) => new Phaser.Geom.Point(p.x, p.y));
  }

  // I locate the tile containing a unit or destination.
  arenaPointToCell(arenaX, arenaY) {

    return {
      column: Phaser.Math.Clamp(Math.floor(arenaX / (this.logicalWidth / this.columns)), 0, this.columns - 1),
      row: Phaser.Math.Clamp(Math.floor(arenaY / (this.logicalHeight / this.rows)), 0, this.rows - 1)
    };
  }

  // I draw the arena grid that players use to issue orders.
  drawPerspectiveFloor() {

    const graphics = this.scene.add.graphics();
    const floor = [
      new Phaser.Geom.Point(this.bottomLeftX, this.bottomY),
      new Phaser.Geom.Point(this.bottomRightX, this.bottomY),
      new Phaser.Geom.Point(this.topRightX, this.topY),
      new Phaser.Geom.Point(this.topLeftX, this.topY)
    ];
    graphics.fillStyle(0x111111, 0.36);
    graphics.fillPoints(floor, true);
    graphics.lineStyle(5, 0xd4a514, 0.95);
    graphics.strokePoints(floor, true);
    graphics.lineStyle(2, 0x8b6f1c, 0.72);

    for (let row = 1; row < this.rows; row += 1) {
      const span = this.getSpanAt((this.logicalHeight / this.rows) * row);
      graphics.beginPath(); graphics.moveTo(span.leftX, span.y); graphics.lineTo(span.rightX, span.y); graphics.strokePath();
    }
    for (let col = 1; col < this.columns; col += 1) {
      const x = (this.logicalWidth / this.columns) * col;
      const near = this.arenaToScreen(x, 0); const far = this.arenaToScreen(x, this.logicalHeight);
      graphics.beginPath(); graphics.moveTo(near.x, near.y); graphics.lineTo(far.x, far.y); graphics.strokePath();
    }
    return graphics;
  }
}
