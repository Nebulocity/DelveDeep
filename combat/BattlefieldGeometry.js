import Phaser from 'phaser';

export default class BattlefieldGeometry {
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
  }

  getDepthRatio(arenaY) {
    return Phaser.Math.Clamp(arenaY / this.logicalHeight, 0, 1);
  }

  getSpanAt(arenaY) {
    const depthRatio = this.getDepthRatio(arenaY);
    const leftX = Phaser.Math.Linear(this.bottomLeftX, this.topLeftX, depthRatio);
    const rightX = Phaser.Math.Linear(this.bottomRightX, this.topRightX, depthRatio);
    const y = Phaser.Math.Linear(this.bottomY, this.topY, depthRatio);

    return {
      leftX,
      rightX,
      y,
      width: rightX - leftX,
      depthRatio
    };
  }

  arenaToScreen(arenaX, arenaY) {
    const clampedX = Phaser.Math.Clamp(arenaX, 0, this.logicalWidth);
    const clampedY = Phaser.Math.Clamp(arenaY, 0, this.logicalHeight);
    const span = this.getSpanAt(clampedY);
    const xRatio = clampedX / this.logicalWidth;

    return {
      x: Phaser.Math.Linear(span.leftX, span.rightX, xRatio),
      y: span.y,
      depthRatio: span.depthRatio,
      widthAtDepth: span.width
    };
  }

  clampPoint(arenaX, arenaY, paddingX = 0, paddingY = 0) {
    return {
      x: Phaser.Math.Clamp(arenaX, paddingX, this.logicalWidth - paddingX),
      y: Phaser.Math.Clamp(arenaY, paddingY, this.logicalHeight - paddingY)
    };
  }

  getUnitScale(arenaY) {
    return Phaser.Math.Linear(this.nearScale, this.farScale, this.getDepthRatio(arenaY));
  }

  getGroundEllipseRadii(radius, arenaY) {
    const span = this.getSpanAt(arenaY);
    const horizontalPixelsPerUnit = span.width / this.logicalWidth;
    const verticalPixelsPerUnit = Math.abs(this.bottomY - this.topY) / this.logicalHeight;

    return {
      width: Math.max(18, radius * horizontalPixelsPerUnit),
      height: Math.max(this.minEllipseHeight, radius * verticalPixelsPerUnit * 0.42)
    };
  }

  drawPerspectiveFloor() {
    const graphics = this.scene.add.graphics();

    const floorPoints = [
      new Phaser.Geom.Point(this.bottomLeftX, this.bottomY),
      new Phaser.Geom.Point(this.bottomRightX, this.bottomY),
      new Phaser.Geom.Point(this.topRightX, this.topY),
      new Phaser.Geom.Point(this.topLeftX, this.topY)
    ];

    graphics.fillStyle(0x2a241d, 1);
    graphics.fillPoints(floorPoints, true);
    graphics.lineStyle(6, 0xeab308, 0.95);
    graphics.strokePoints(floorPoints, true);

    graphics.lineStyle(2, 0x8b6f1c, 0.65);

    for (let row = 1; row < 6; row += 1) {
      const arenaY = (this.logicalHeight / 6) * row;
      const span = this.getSpanAt(arenaY);
      graphics.beginPath();
      graphics.moveTo(span.leftX, span.y);
      graphics.lineTo(span.rightX, span.y);
      graphics.strokePath();
    }

    for (let column = 1; column < 5; column += 1) {
      const arenaX = (this.logicalWidth / 5) * column;
      const nearPoint = this.arenaToScreen(arenaX, 0);
      const farPoint = this.arenaToScreen(arenaX, this.logicalHeight);
      graphics.beginPath();
      graphics.moveTo(nearPoint.x, nearPoint.y);
      graphics.lineTo(farPoint.x, farPoint.y);
      graphics.strokePath();
    }

    return graphics;
  }
}
