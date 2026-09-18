import Phaser from 'phaser';

export default class BattlefieldTerrainEditor {
  constructor(scene, battlefield, terrain) {
    this.scene = scene;
    this.battlefield = battlefield;
    this.terrain = terrain;
    this.active = false;
    this.activeZoneIndex = 0;
    this.zones = [];
    this.ui = [];
    this.pointLabels = [];
    this.overlay = null;
    this.tapHandler = null;
    this.inputBlocker = null;
  }

  toggle() {
    if (this.active) this.close();
    else this.open();
  }

  open() {
    if (this.active) return;
    this.active = true;
    this.wasPaused = this.scene.combatPaused;
    this.scene.combatPaused = true;
    this.zones = this.terrain.zones.map((zone) => ({
      id: zone.id,
      type: zone.type,
      points: zone.points.map((point) => ({ ...point }))
    }));
    if (this.zones.length === 0) this.addZone();
    this.activeZoneIndex = Math.min(this.activeZoneIndex, this.zones.length - 1);
    this.createUi();
    this.redraw();
    const { width, height } = this.scene.scale;
    this.inputBlocker = this.scene.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 0.001)
      .setInteractive().setDepth(11980);
    this.inputBlocker.on('pointerdown', (pointer) => this.handleTap(pointer));
  }

  close() {
    if (!this.active) return;
    this.active = false;
    this.scene.combatPaused = this.wasPaused;
    this.inputBlocker?.destroy();
    this.inputBlocker = null;
    this.overlay?.destroy();
    this.overlay = null;
    this.pointLabels.forEach((label) => label.destroy());
    this.pointLabels = [];
    this.ui.forEach((item) => item.destroy());
    this.ui = [];
    this.scene.terrainEditorButton?.setVisible(true);
    this.scene.terrainEditorButtonLabel?.setVisible(true);
  }

  createUi() {
    const { width, height } = this.scene.scale;
    this.scene.terrainEditorButton?.setVisible(false);
    this.scene.terrainEditorButtonLabel?.setVisible(false);
    const panel = this.scene.add.rectangle(width / 2, 54, width, 108, 0x09090b, 0.94).setDepth(12000);
    this.ui.push(panel);

    const title = this.scene.add.text(24, 14, 'TERRAIN EDITOR', {
      fontFamily: 'Arial', fontSize: '26px', fontStyle: 'bold', color: '#facc15'
    }).setDepth(12001);
    this.ui.push(title);

    const help = this.scene.add.text(24, 48, 'Tap the battlefield to add polygon points. Existing red areas are blocked.', {
      fontFamily: 'Arial', fontSize: '20px', color: '#e5e7eb'
    }).setDepth(12001);
    this.ui.push(help);

    const buttons = [
      ['UNDO', () => this.undoPoint()],
      ['CLEAR ZONE', () => this.clearZone()],
      ['NEW ZONE', () => this.addZone()],
      ['NEXT ZONE', () => this.nextZone()],
      ['COPY DATA', () => this.copyData()],
      ['EXIT', () => this.close()]
    ];
    const buttonWidth = 145;
    const gap = 12;
    const totalWidth = buttons.length * buttonWidth + (buttons.length - 1) * gap;
    let x = width - totalWidth - 24 + buttonWidth / 2;
    buttons.forEach(([label, callback]) => {
      const box = this.scene.add.rectangle(x, 54, buttonWidth, 58, 0x27272a)
        .setStrokeStyle(2, 0x71717a).setInteractive({ useHandCursor: true }).setDepth(12002);
      const text = this.scene.add.text(x, 54, label, {
        fontFamily: 'Arial', fontSize: '18px', fontStyle: 'bold', color: '#f4f4f5'
      }).setOrigin(0.5).setDepth(12003);
      box.on('pointerdown', (pointer, localX, localY, event) => {
        event?.stopPropagation?.();
        callback();
      });
      this.ui.push(box, text);
      x += buttonWidth + gap;
    });

    this.zoneLabel = this.scene.add.text(width / 2, 94, '', {
      fontFamily: 'Arial', fontSize: '18px', color: '#93c5fd'
    }).setOrigin(0.5).setDepth(12003);
    this.ui.push(this.zoneLabel);
  }

  handleTap(pointer) {
    if (!this.active || pointer.y <= 108) return;
    const arena = this.battlefield.screenToArena(pointer.x, pointer.y);
    if (!arena) return;
    const zone = this.zones[this.activeZoneIndex];
    if (!zone) return;
    zone.points.push({ x: Math.round(arena.x), y: Math.round(arena.y) });
    this.redraw();
  }

  addZone() {
    this.zones.push({
      id: `blocked-zone-${this.zones.length + 1}`,
      type: 'blocked',
      points: []
    });
    this.activeZoneIndex = this.zones.length - 1;
    this.redraw();
  }

  nextZone() {
    if (this.zones.length === 0) return;
    this.activeZoneIndex = (this.activeZoneIndex + 1) % this.zones.length;
    this.redraw();
  }

  undoPoint() {
    this.zones[this.activeZoneIndex]?.points.pop();
    this.redraw();
  }

  clearZone() {
    const zone = this.zones[this.activeZoneIndex];
    if (!zone) return;
    zone.points = [];
    this.redraw();
  }

  redraw() {
    if (!this.active) return;
    this.overlay?.destroy();
    this.pointLabels.forEach((label) => label.destroy());
    this.pointLabels = [];
    this.overlay = this.scene.add.graphics().setDepth(11990);

    this.zones.forEach((zone, zoneIndex) => {
      const screenPoints = zone.points.map((point) => {
        const screen = this.battlefield.arenaToScreen(point.x, point.y);
        return new Phaser.Geom.Point(screen.x, screen.y);
      });
      if (screenPoints.length >= 3) {
        this.overlay.fillStyle(zoneIndex === this.activeZoneIndex ? 0xf97316 : 0xef4444, 0.28);
        this.overlay.fillPoints(screenPoints, true);
      }
      if (screenPoints.length >= 2) {
        this.overlay.lineStyle(4, zoneIndex === this.activeZoneIndex ? 0xfacc15 : 0xef4444, 1);
        this.overlay.strokePoints(screenPoints, screenPoints.length >= 3);
      }
      screenPoints.forEach((screen, pointIndex) => {
        this.overlay.fillStyle(zoneIndex === this.activeZoneIndex ? 0xfacc15 : 0xffffff, 1);
        this.overlay.fillCircle(screen.x, screen.y, 8);
        const point = zone.points[pointIndex];
        const label = this.scene.add.text(screen.x + 10, screen.y - 10, `${pointIndex + 1}: ${point.x},${point.y}`, {
          fontFamily: 'Arial', fontSize: '16px', color: '#ffffff', backgroundColor: '#000000'
        }).setDepth(11991);
        this.pointLabels.push(label);
      });
    });

    const zone = this.zones[this.activeZoneIndex];
    this.zoneLabel?.setText(`Editing ${zone?.id ?? 'none'} | Zone ${this.activeZoneIndex + 1}/${this.zones.length} | ${zone?.points.length ?? 0} points`);
  }

  async copyData() {
    const validZones = this.zones.filter((zone) => zone.points.length >= 3);
    const data = `terrain: ${JSON.stringify(validZones, null, 2)},`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(data);
      copied = true;
    } catch (error) {
      copied = false;
    }
    this.showData(data, copied);
  }

  showData(data, copied) {
    const { width, height } = this.scene.scale;
    const backdrop = this.scene.add.rectangle(width / 2, height / 2, width * 0.92, height * 0.72, 0x09090b, 0.98)
      .setStrokeStyle(3, 0xfacc15).setDepth(13000).setInteractive();
    const title = this.scene.add.text(width / 2, height * 0.18, copied ? 'COPIED TERRAIN DATA' : 'TERRAIN DATA', {
      fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#facc15'
    }).setOrigin(0.5).setDepth(13001);
    const body = this.scene.add.text(width * 0.08, height * 0.24, data, {
      fontFamily: 'monospace', fontSize: '17px', color: '#e5e7eb', wordWrap: { width: width * 0.84 }
    }).setDepth(13001);
    const close = this.scene.add.text(width / 2, height * 0.82, 'TAP HERE TO CLOSE', {
      fontFamily: 'Arial', fontSize: '24px', fontStyle: 'bold', color: '#93c5fd'
    }).setOrigin(0.5).setDepth(13001).setInteractive({ useHandCursor: true });
    const destroy = () => {
      backdrop.destroy();
      title.destroy();
      body.destroy();
      close.destroy();
    };
    backdrop.on('pointerdown', (pointer, localX, localY, event) => event?.stopPropagation?.());
    close.on('pointerdown', (pointer, localX, localY, event) => {
      event?.stopPropagation?.();
      destroy();
    });
  }
}
