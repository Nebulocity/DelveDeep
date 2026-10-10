// This is the retained terrain authoring tool. It edits the outline used to decide where
// units can stand. It is separate from ordinary combat controls. Points belong to the
// environment artwork before projection, so changing the display size should not change
// the authored floor.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import Phaser from 'phaser';

export default class BattlefieldTerrainEditor {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods. scene is the Phaser screen that owns
  // the objects, clock and input used here.
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
    this.inputBlocker = null;
  }

  // Switch the retained terrain editor between its open and closed states.
  toggle() {
    if (this.active) this.close();
    else this.open();
  }

  // Open the terrain authoring controls and connect editing input.
  open() {
    if (this.active) return;
    this.active = true;
    this.wasPaused = this.scene.combatPaused;
    this.scene.combatPaused = true;

    // Edit a copy so closing the tool cannot change the active collision zones.
    this.zones = this.terrain.zones.map((zone) => ({
      id: zone.id,
      type: zone.type,
      points: zone.points.map((point) => ({ ...point }))
    }));

    if (this.zones.length === 0) this.addZone();

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    this.activeZoneIndex = Math.min(this.activeZoneIndex, this.zones.length - 1);
    this.createUi();
    this.redraw();

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scene.scale;

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. This gives the display object an input hit area. Visible
    // artwork alone does not make an object respond to a tap.
    this.inputBlocker = this.scene.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 0.001)
      .setInteractive().setDepth(11980);

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    this.inputBlocker.on('pointerdown', (pointer) => this.handleTap(pointer));
  }

  // Remove the terrain authoring controls and restore ordinary scene input.
  close() {
    if (!this.active) return;
    this.active = false;
    this.scene.combatPaused = this.wasPaused;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
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

  // Build the terrain editor's zone selection, point editing and export controls.
  createUi() {

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scene.scale;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.scene.terrainEditorButton?.setVisible(false);
    this.scene.terrainEditorButtonLabel?.setVisible(false);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const panel = this.scene.add.rectangle(width / 2, 54, width, 108, 0x09090b, 0.94).setDepth(12000);
    this.ui.push(panel);

    const title = this.scene.add.text(24, 14, 'TERRAIN EDITOR', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('support28'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#facc15'
    }).setDepth(12001);
    this.ui.push(title);

    const help = this.scene.add.text(24, 48, 'Tap the battlefield to add polygon points. Existing red areas are blocked.', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('compact22'), color: '#e5e7eb'
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

      // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
      // lower-depth objects. This gives the display object an input hit area. Visible
      // artwork alone does not make an object respond to a tap.
      const box = this.scene.add.rectangle(x, 54, buttonWidth, 58, 0x27272a)
        .setStrokeStyle(2, 0x71717a).setInteractive({ useHandCursor: true }).setDepth(12002);

      // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
      // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the
      // object's corner.
      const text = this.scene.add.text(x, 54, label, {
        fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('compact20'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f4f4f5'
      }).setOrigin(0.5).setDepth(12003);

      // on registers a callback for later events; it does not call that callback now.
      // Long-lived emitters need matching listener cleanup.
      box.on('pointerdown', (pointer, localX, localY, event) => {

        // ?. only follows this link when the value exists; a missing optional value gives
        // undefined.
        event?.stopPropagation?.();
        callback();
      });

      this.ui.push(box, text);

      x += buttonWidth + gap;
    });

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    this.zoneLabel = this.scene.add.text(width / 2, 94, '', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('compact20'), color: '#93c5fd'
    }).setOrigin(0.5).setDepth(12003);
    this.ui.push(this.zoneLabel);
  }

  // Convert the authoring tap into a point in the environment's floor coordinate space.
  handleTap(pointer) {
    if (!this.active || pointer.y <= 108) return;
    const arena = this.battlefield.screenToArena(pointer.x, pointer.y);
    if (!arena) return;
    const zone = this.zones[this.activeZoneIndex];

    if (!zone) return;
    zone.points.push({ x: Math.round(arena.x), y: Math.round(arena.y) });
    this.redraw();
  }

  // Create a new authored terrain zone and select it for editing.
  addZone() {
    this.zones.push({
      id: `blocked-zone-${this.zones.length + 1}`,
      type: 'blocked',
      points: []
    });
    this.activeZoneIndex = this.zones.length - 1;
    this.redraw();
  }

  // Move the editor selection to the next available terrain zone.
  nextZone() {
    if (this.zones.length === 0) return;

    // % gives the remainder. With a nonnegative index and positive list length, it wraps
    // the index back to the start of the list.
    this.activeZoneIndex = (this.activeZoneIndex + 1) % this.zones.length;
    this.redraw();
  }

  // Remove the most recently added point from the selected authored zone.
  undoPoint() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.zones[this.activeZoneIndex]?.points.pop();
    this.redraw();
  }

  // Clear the selected zone's authored vertices while keeping the editor state coherent.
  clearZone() {
    const zone = this.zones[this.activeZoneIndex];
    if (!zone) return;
    zone.points = [];
    this.redraw();
  }

  // Redraw the editor outlines and selected points from current authoring data.
  redraw() {
    if (!this.active) return;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.overlay?.destroy();
    this.pointLabels.forEach((label) => label.destroy());
    this.pointLabels = [];

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    this.overlay = this.scene.add.graphics().setDepth(11990);

    this.zones.forEach((zone, zoneIndex) => {

      // map builds one output entry for each input entry, in the same order. The
      // callback's return value becomes that output entry.
      const screenPoints = zone.points.map((point) => {
        const screen = this.battlefield.arenaToScreen(point.x, point.y);
        return new Phaser.Geom.Point(screen.x, screen.y);
      });

      if (screenPoints.length >= 3) {

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        this.overlay.fillStyle(zoneIndex === this.activeZoneIndex ? 0xf97316 : 0xef4444, 0.28);
        this.overlay.fillPoints(screenPoints, true);
      }

      if (screenPoints.length >= 2) {
        this.overlay.lineStyle(4, zoneIndex === this.activeZoneIndex ? 0xfacc15 : 0xef4444, 1);
        this.overlay.strokePoints(screenPoints, screenPoints.length >= 3);
      }
      screenPoints.forEach((screen, pointIndex) => {

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        this.overlay.fillStyle(zoneIndex === this.activeZoneIndex ? 0xfacc15 : 0xffffff, 1);
        this.overlay.fillCircle(screen.x, screen.y, 8);
        const point = zone.points[pointIndex];

        // Depth is drawing order, not distance or size. Higher-depth objects draw on top
        // of lower-depth objects.
        const label = this.scene.add.text(screen.x + 10, screen.y - 10, `${pointIndex + 1}: ${point.x},${point.y}`, {
          fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('compact18'), color: '#ffffff', backgroundColor: '#000000'
        }).setDepth(11991);
        this.pointLabels.push(label);
      });
    });

    const zone = this.zones[this.activeZoneIndex];

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    this.zoneLabel?.setText(`Editing ${zone?.id ?? 'none'} | Zone ${this.activeZoneIndex + 1}/${this.zones.length} | ${zone?.points.length ?? 0} points`);
  }

  // Serialize the authored zone data for copying, with the existing fallback if clipboard
  // access fails.
  async copyData() {

    // Only complete polygons can be pasted back into a level definition.
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

  // Show the authored terrain data in the editor's export display.
  showData(data, copied) {

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scene.scale;

    // This gives the display object an input hit area. Visible artwork alone does not make
    // an object respond to a tap. Depth is drawing order, not distance or size.
    // Higher-depth objects draw on top of lower-depth objects.
    const backdrop = this.scene.add.rectangle(width / 2, height / 2, width * 0.92, height * 0.72, 0x09090b, 0.98)
      .setStrokeStyle(3, 0xfacc15).setDepth(13000).setInteractive();

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner. The condition before ? chooses the first value when true and the value after
    // : when false.
    const title = this.scene.add.text(width / 2, height * 0.18, copied ? 'COPIED TERRAIN DATA' : 'TERRAIN DATA', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#facc15'
    }).setOrigin(0.5).setDepth(13001);
    const body = this.scene.add.text(width * 0.08, height * 0.24, data, {
      fontFamily: UI_FONT_FAMILIES.data, fontSize: fontPx('compact19'), color: '#e5e7eb', wordWrap: { width: width * 0.84 }
    }).setDepth(13001);
    const close = this.scene.add.text(width / 2, height * 0.82, 'TAP HERE TO CLOSE', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('compact26'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#93c5fd'
    }).setOrigin(0.5).setDepth(13001).setInteractive({ useHandCursor: true });

    const destroy = () => {
      backdrop.destroy();
      title.destroy();
      body.destroy();
      close.destroy();
    };

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    backdrop.on('pointerdown', (pointer, localX, localY, event) => event?.stopPropagation?.());
    close.on('pointerdown', (pointer, localX, localY, event) => {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      event?.stopPropagation?.();
      destroy();
    });
  }
}
