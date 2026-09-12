import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { happinessLabel } from '../game/AdventurerProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

const ROLE_COLUMNS = [
  { title: 'TANKS', roles: ['Tank'] },
  { title: 'HEALERS', roles: ['Healer'] },
  { title: 'MELEE', roles: ['Melee DPS'] },
  { title: 'RANGED', roles: ['Ranged DPS'] }
];

export default class PartySelectScene extends Phaser.Scene {
  constructor() {
    super('PartySelectScene');
    this.selectedIds = new Set();
    this.cards = new Map();
    this.columns = [];
    this.lastTap = new Map();
  }

  init() {
    const existingParty = GameState.activeParty.length > 0 ? GameState.activeParty : GameState.roster.slice(0, 5);
    this.selectedIds = new Set(existingParty.map((adventurer) => adventurer.id).slice(0, 5));
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#111827');
    this.createBackButton();

    this.add.text(width / 2, UI_SAFE_TOP + 14, 'PARTY SELECT', { fontFamily: 'Arial', fontSize: '68px', fontStyle: 'bold', color: '#f8fafc' }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 67, GameState.currentDelve?.name ?? 'Unknown Delve', { fontFamily: 'Arial', fontSize: '34px', color: '#cbd5e1' }).setOrigin(0.5);
    this.partyCountText = this.add.text(width / 2, UI_SAFE_TOP + 106, '', { fontFamily: 'Arial', fontSize: '30px', color: '#94a3b8' }).setOrigin(0.5);

    const columnWidth = width * 0.225;
    const gap = width * 0.012;
    const totalWidth = columnWidth * 4 + gap * 3;
    const startX = (width - totalWidth) / 2 + columnWidth / 2;
    const viewTop = height * 0.30;
    const viewHeight = height * 0.48;

    ROLE_COLUMNS.forEach((definition, index) => {
      const x = startX + index * (columnWidth + gap);
      this.createRoleColumn(definition, x, viewTop, columnWidth, viewHeight);
    });

    this.beginButton = this.add.rectangle(width / 2, height * 0.90, 720, 96, 0x334155).setInteractive({ useHandCursor: true });
    this.beginButtonText = this.add.text(width / 2, height * 0.90, 'BATTLE OVERVIEW', { fontFamily: 'Arial', fontSize: '40px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.beginButton.on('pointerdown', () => this.begin());

    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const column = this.columns.find((entry) => Phaser.Geom.Rectangle.Contains(entry.bounds, pointer.x, pointer.y));
      if (column) this.scrollColumn(column, deltaY > 0 ? 1 : -1);
    });

    this.refreshSelectionUi();
  }

  createBackButton() {
    const y = UI_SAFE_TOP + 18;
    const button = this.add.rectangle(180, y, 300, 64, 0x334155).setInteractive({ useHandCursor: true });
    this.add.text(180, y, '< OVERVIEW', { fontFamily: 'Arial', fontSize: '33px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    button.on('pointerdown', () => { HapticsService.tap(); this.scene.start('DelveSelectScene'); });
  }

  createRoleColumn(definition, x, top, width, height) {
    this.add.rectangle(x, top + height / 2, width, height + 82, 0x172033).setStrokeStyle(3, 0x334155);
    this.add.text(x, top - 24, definition.title, { fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#f8fafc' }).setOrigin(0.5);

    const roster = GameState.roster.filter((adventurer) => definition.roles.includes(adventurer.role));
    const itemHeight = 150;
    const content = this.add.container(0, 0);
    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff).fillRect(x - width / 2 + 10, top, width - 20, height);
    const mask = maskShape.createGeometryMask();
    content.setMask(mask);

    roster.forEach((adventurer, index) => {
      const cardY = top + 70 + index * itemHeight;
      const card = this.add.rectangle(x, cardY, width - 34, 126, 0x1f2937).setStrokeStyle(3, 0x475569).setInteractive({ useHandCursor: true });
      const portrait = this.add.circle(x - width * 0.34, cardY, 36, adventurer.color).setStrokeStyle(3, 0xffffff, 0.18);
      const name = this.add.text(x - width * 0.24, cardY - 42, adventurer.name, { fontFamily: 'Arial', fontSize: '31px', fontStyle: 'bold', color: '#ffffff' });
      const cls = this.add.text(x - width * 0.24, cardY - 5, adventurer.className, { fontFamily: 'Arial', fontSize: '25px', color: '#cbd5e1' });
      const level = this.add.text(x - width * 0.24, cardY + 28, `Lv ${adventurer.level} • ${adventurer.happiness ?? 70}%`, { fontFamily: 'Arial', fontSize: '22px', color: '#94a3b8' });
      content.add([card, portrait, name, cls, level]);
      this.cards.set(adventurer.id, { card, portrait, name, cls, level });
      this.bindCardInput(card, adventurer);
    });

    if (roster.length === 0) {
      const empty = this.add.text(x, top + height / 2, 'No adventurers yet', { fontFamily: 'Arial', fontSize: '26px', color: '#64748b' }).setOrigin(0.5);
      content.add(empty);
    }

    const column = {
      bounds: new Phaser.Geom.Rectangle(x - width / 2, top, width, height),
      container: content,
      offset: 0,
      maxOffset: Math.max(0, roster.length * itemHeight - height + 40),
      dragging: false,
      dragStartY: 0,
      offsetStart: 0
    };
    this.columns.push(column);

    const inputZone = this.add.zone(x, top + height / 2, width, height).setInteractive().setDepth(5);
    inputZone.on('pointerdown', (pointer) => { column.dragging = true; column.dragStartY = pointer.y; column.offsetStart = column.offset; });
    inputZone.on('pointermove', (pointer) => {
      if (!column.dragging || !pointer.isDown) return;
      column.offset = Phaser.Math.Clamp(column.offsetStart + (column.dragStartY - pointer.y), 0, column.maxOffset);
      column.container.y = -column.offset;
    });
    inputZone.on('pointerup', () => { column.dragging = false; });
    inputZone.on('pointerout', () => { if (!this.input.activePointer.isDown) column.dragging = false; });
    inputZone.setDepth(-1);
  }

  bindCardInput(card, adventurer) {
    let downAt = 0;
    let longPressTimer = null;
    let longPressed = false;

    card.on('pointerdown', (pointer, localX, localY, event) => {
      event?.stopPropagation?.();
      downAt = this.time.now;
      longPressed = false;
      longPressTimer = this.time.delayedCall(550, () => {
        longPressed = true;
        this.showAdventurerDetails(adventurer);
      });
    });

    card.on('pointerup', (pointer, localX, localY, event) => {
      event?.stopPropagation?.();
      longPressTimer?.remove(false);
      if (longPressed || this.time.now - downAt >= 520) return;

      const previous = this.lastTap.get(adventurer.id) ?? -Infinity;
      this.lastTap.set(adventurer.id, this.time.now);
      if (this.time.now - previous < 320) {
        this.showAdventurerDetails(adventurer);
        return;
      }
      this.toggleAdventurer(adventurer.id);
    });
  }

  scrollColumn(column, direction) {
    column.offset = Phaser.Math.Clamp(column.offset + direction * 130, 0, column.maxOffset);
    this.tweens.add({ targets: column.container, y: -column.offset, duration: 140, ease: 'Quad.Out' });
  }

  toggleAdventurer(id) {
    HapticsService.tap();
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else if (this.selectedIds.size < 5) this.selectedIds.add(id);
    else this.showToast('Party is limited to five adventurers.');
    this.refreshSelectionUi();
  }

  refreshSelectionUi() {
    this.partyCountText.setText(`${this.selectedIds.size} / 5 selected`);
    this.cards.forEach((objects, id) => {
      const selected = this.selectedIds.has(id);
      objects.card.setFillStyle(selected ? 0x29415f : 0x1f2937).setStrokeStyle(4, selected ? 0x93c5fd : 0x374151).setAlpha(selected ? 1 : 0.48);
      objects.portrait.setAlpha(selected ? 1 : 0.45);
      objects.name.setAlpha(selected ? 1 : 0.55);
      objects.cls.setAlpha(selected ? 1 : 0.50);
      objects.level.setAlpha(selected ? 1 : 0.50);
    });
    const ready = this.selectedIds.size === 5;
    this.beginButton.setFillStyle(ready ? 0x475569 : 0x1f2937);
    this.beginButtonText.setColor(ready ? '#ffffff' : '#64748b');
  }

  begin() {
    if (this.selectedIds.size !== 5) {
      this.showToast('Choose five adventurers before continuing.');
      return;
    }
    HapticsService.confirm();
    GameState.activeParty = GameState.roster.filter((adventurer) => this.selectedIds.has(adventurer.id)).map((adventurer) => ({ ...adventurer }));
    this.scene.start('DungeonScene');
  }

  showAdventurerDetails(adventurer) {
    HapticsService.tap();
    const { width, height } = this.scale;
    const blocker = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55).setDepth(5000).setInteractive();
    const panel = this.add.rectangle(width / 2, height / 2, 900, 570, 0x111827, 0.98).setStrokeStyle(5, 0x64748b).setDepth(5001);
    this.add.text(width / 2, height * 0.31, adventurer.name, { fontFamily: 'Arial', fontSize: '58px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(5002);
    this.add.text(width / 2, height * 0.38, `${adventurer.className} • ${adventurer.role}`, { fontFamily: 'Arial', fontSize: '34px', color: '#cbd5e1' }).setOrigin(0.5).setDepth(5002);
    const stats = [
      `Level: ${adventurer.level}`,
      `HP: ${adventurer.maxHp}`,
      `Attack: ${adventurer.attackPower}`,
      `Move Speed: ${adventurer.moveSpeed}`,
      `Crit: ${Math.round((adventurer.critChance ?? 0) * 100)}%`,
      `Happiness: ${adventurer.happiness ?? 70}% (${happinessLabel(adventurer.happiness ?? 70)})`
    ];
    this.add.text(width / 2, height * 0.49, stats.join('\n'), { fontFamily: 'Arial', fontSize: '31px', color: '#e2e8f0', align: 'center', lineSpacing: 14 }).setOrigin(0.5).setDepth(5002);
    const close = this.add.rectangle(width / 2, height * 0.70, 300, 72, 0x334155).setInteractive({ useHandCursor: true }).setDepth(5002);
    const closeText = this.add.text(width / 2, height * 0.70, 'CLOSE', { fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(5003);
    close.on('pointerdown', () => {
      GameState.activeParty = GameState.roster.filter((entry) => this.selectedIds.has(entry.id)).map((entry) => ({ ...entry }));
      blocker.destroy(); panel.destroy(); close.destroy(); closeText.destroy();
      this.scene.restart();
    });
  }

  showToast(message) {
    const { width, height } = this.scale;
    const label = this.add.text(width / 2, height * 0.18, message, { fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#fca5a5', stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5).setDepth(6000);
    this.tweens.add({ targets: label, alpha: 0, delay: 900, duration: 350, onComplete: () => label.destroy() });
  }
}
