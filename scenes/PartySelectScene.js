import { preloadCarvedStone, addStonePanel, addStoneButton, stoneText, stoneIcon, STONE } from '../ui/CarvedStone.js';
import { preparationFrame, preparationButton, preparationNotice } from '../ui/DelvePreparation.js';
import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import { bindSelectionDetails, addDetailsHint, showSelectionDetails } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { getEquippedAdventurer } from '../game/Equipment.js';
import HapticsService from '../services/HapticsService.js';
import { happinessLabel } from '../game/AdventurerProgression.js';
import { saveProfile } from '../game/GameStorage.js';

const MAX_PARTY_SIZE = 5;
const ROLE_LIMITS = {
  Tank: 1,
  Healer: 2,
  DPS: 4
};

const ROLE_COLUMNS = [
  { title: 'TANKS', roles: ['Tank'] },
  { title: 'HEALERS', roles: ['Healer'] },
  { title: 'MELEE', roles: ['Melee DPS'] },
  { title: 'RANGED', roles: ['Ranged DPS'] }
];

export default class PartySelectScene extends Phaser.Scene {

  // This function registers PartySelectScene so the game can navigate to this
  // screen.
  constructor() {

    super('PartySelectScene');
    this.selectedIds = new Set();
    this.cards = new Map();
    this.columns = [];
    this.lastTap = new Map();
  }

  // This function restores the party selection whenever this screen opens.
  init() {

    this.selectedIds = this.buildInitialSelection();
  }

  // Load the shared battle surfaces and existing character portraits.
  preload() {
    preloadCarvedStone(this);
    for (const definition of Object.values(CHARACTER_SPRITES)) {
      const frame = definition.clips.idle.south.frames[0];
      const texture = definition.textures.find(entry => entry.key === frame.key);
      if (texture && !this.textures.exists(texture.key)) this.load.spritesheet(texture.key, texture.url, { frameWidth: 256, frameHeight: 256 });
    }
  }

  create() {
    const { width, height } = this.scale;
    this.cards.clear();
    this.columns = [];
    this.lastTap.clear();
    preparationFrame(this, GameState.currentDelve, 'PARTY SELECT', 'DELVE OVERVIEW', () => this.scene.start('DelveSelectScene'));
    this.partyCountText = stoneText(this, width / 2, 171, '', 31, 3, { fontFamily: 'Arial', color: STONE.muted });
    const columnWidth = (width - 130) / 4;
    const gap = 18;
    const startX = 38 + columnWidth / 2;
    ROLE_COLUMNS.forEach((definition, index) => {
      this.createRoleColumn(definition, startX + index * (columnWidth + gap), 258, columnWidth, 458);
    });

    this.lineup = this.add.container(0, 0).setDepth(5);
    const action = preparationButton(this, width - 360, height - 74, 630, 104, 'BATTLE OVERVIEW', () => this.begin(), { primary: true, size: 36 });
    this.beginButton = action.button;
    this.beginButtonText = action.text;
    addDetailsHint(this, height - 73, 'Tap to select. Hold an adventurer for stats. Drag lists to browse.', { x: width * 0.34, width: 1500 });

    // Scroll only the role column under the pointer.
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {

      const column = this.columns.find((entry) => Phaser.Geom.Rectangle.Contains(entry.bounds, pointer.x, pointer.y));
      if (column) this.scrollColumn(column, deltaY > 0 ? 1 : -1);
    });

    let listDrag = null;
    this.input.on('pointerdown', (pointer) => {
      const column = this.columns.find((entry) => Phaser.Geom.Rectangle.Contains(entry.bounds, pointer.x, pointer.y));
      if (column?.maxOffset > 0) listDrag = { id: pointer.id, y: pointer.y, startY: pointer.y, column, moved: false };
    });
    this.input.on('pointermove', (pointer) => {
      if (!listDrag || listDrag.id !== pointer.id || !pointer.isDown) return;
      if (!listDrag.moved && Math.abs(pointer.y - listDrag.startY) > 6) {
        listDrag.moved = true;
        listDrag.column.container.list.forEach(object => { if (object.input) object.emit('pointerout'); });
      }
      if (listDrag.moved) this.setColumnOffset(listDrag.column, listDrag.column.offset + listDrag.y - pointer.y, false);
      listDrag.y = pointer.y;
    });
    this.input.on('pointerup', () => { listDrag = null; });
    this.input.on('gameout', () => { listDrag = null; });

    // Convert scrollbar thumb movement into a bounded content offset.
    this.input.on('drag', (pointer, gameObject, dragX, dragY) => {

      const column = this.columns.find((entry) => entry.thumb === gameObject);
      if (!column || column.maxOffset <= 0) return;

      const minY = column.trackTop + column.thumbHeight / 2;
      const maxY = column.trackTop + column.trackHeight - column.thumbHeight / 2;
      const clampedY = Phaser.Math.Clamp(dragY, minY, maxY);
      const usableHeight = Math.max(1, column.trackHeight - column.thumbHeight);
      const ratio = (clampedY - minY) / usableHeight;
      this.setColumnOffset(column, ratio * column.maxOffset, false);
    });

    this.refreshSelectionUi();
  }

  // This function restores a valid previous party while leaving first-time
  // selection empty.
  buildInitialSelection() {

    const initialIds = new Set();

    // Prefer the active party, falling back to saved IDs. An empty history
    // leaves the initial selection empty.
    const preferredIds = GameState.activeParty.length > 0
      ? GameState.activeParty.map((adventurer) => adventurer.id)
      : (GameState.lastPartyIds ?? []);

    preferredIds.forEach((id) => {

      if (initialIds.size >= MAX_PARTY_SIZE) return;
      const adventurer = GameState.roster.find((entry) => entry.id === id);
      if (adventurer && this.canAddToSelection(adventurer, initialIds)) initialIds.add(id);
    });

    return initialIds;
  }

  // This function builds one role column, including its adventurer cards,
  // clipped viewing area, and scrolling controls. The saved column state lets
  // dragging, arrow buttons, and track taps share the same scrolling logic.
  createRoleColumn(definition, x, top, width, height) {
    addStonePanel(this, x, top + height / 2 - 24, width, height + 76, 0);
    stoneIcon(this, x - width / 2 + 54, top - 28, definition.title, 40, 2, this.stoneTheme.accent);
    const roster = GameState.roster.filter(adventurer => definition.roles.includes(adventurer.role));
    stoneText(this, x + 10, top - 28, `${definition.title} · ${roster.length}`, 34, 2);
    const itemHeight = 140;
    const scrollTop = top + 16;
    const scrollHeight = height - 36;
    const content = this.add.container(0, 0).setDepth(3);
    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff).fillRect(x - width / 2 + 16, scrollTop, width - 82, scrollHeight);
    content.setMask(maskShape.createGeometryMask());
    this.events.once('shutdown', () => maskShape.destroy());
    const contentCenterX = x - 25;
    const cardWidth = width - 94;
    roster.forEach((adventurer, index) => {
      const cardY = scrollTop + 64 + index * itemHeight;
      const card = addStoneButton(this, contentCenterX, cardY, cardWidth, 126, 0);
      const frame = CHARACTER_SPRITES[adventurer.id]?.clips.idle.south.frames[0];
      const portraitX = contentCenterX - cardWidth / 2 + 62;
      const portrait = frame && this.textures.exists(frame.key)
        ? this.add.image(portraitX, cardY, frame.key, frame.frame).setDisplaySize(116, 116).setFlipX(frame.flipX === true)
        : stoneIcon(this, portraitX, cardY, definition.title, 56, 0, adventurer.color);
      const textX = contentCenterX - cardWidth / 2 + 120;
      const textWidth = cardWidth - 135;
      const name = stoneText(this, textX, cardY - 37, adventurer.name, 32, 0).setOrigin(0, 0.5);
      const cls = stoneText(this, textX, cardY + 2, adventurer.shortName ?? adventurer.className, 27, 0, { fontFamily: 'Arial', fontStyle: 'normal', color: STONE.muted }).setOrigin(0, 0.5);
      const level = stoneText(this, textX, cardY + 37, `Lv ${adventurer.level} · ${adventurer.happiness ?? 70}%`, 25, 0, { fontFamily: 'Arial', fontStyle: 'normal', color: STONE.muted }).setOrigin(0, 0.5);
      [name, cls].forEach(label => { if (label.width > textWidth) label.setScale(textWidth / label.width); });
      content.add([...card.pressVisuals, portrait, name, cls, level, card]);
      this.cards.set(adventurer.id, { card, portrait, name, cls, level, adventurer });
      this.bindCardInput(card, adventurer);

      // Geometry masks only clip rendering; reject input outside the visible list too.
      const hitTest = card.input.hitAreaCallback;
      card.input.hitAreaCallback = (area, localX, localY, object) => {
        const worldY = card.y + content.y + localY - card.height / 2;
        return worldY >= scrollTop && worldY <= scrollTop + scrollHeight && hitTest(area, localX, localY, object);
      };
    });
    if (!roster.length) content.add(stoneText(this, x, scrollTop + scrollHeight / 2, 'No adventurers yet', 28, 0));
    const trackX = x + width / 2 - 36;
    const trackTop = scrollTop + 62;
    const trackHeight = scrollHeight - 124;
    const up = preparationButton(this, trackX, scrollTop + 27, 54, 54, '^', () => this.scrollColumn(column, -1), { size: 24, depth: 3 });
    const down = preparationButton(this, trackX, scrollTop + scrollHeight - 27, 54, 54, 'v', () => this.scrollColumn(column, 1), { size: 24, depth: 3 });
    const track = this.add.rectangle(trackX, trackTop + trackHeight / 2, 44, trackHeight, 0x111925).setStrokeStyle(2, STONE.edge).setDepth(3).setInteractive();
    const contentHeight = roster.length ? 128 + (roster.length - 1) * itemHeight : scrollHeight;
    const maxOffset = Math.max(0, contentHeight - scrollHeight);
    const thumbHeight = Math.max(52, trackHeight * Math.min(1, scrollHeight / contentHeight));
    const thumb = this.add.rectangle(trackX, trackTop + thumbHeight / 2, 44, thumbHeight, 0x526277)
      .setStrokeStyle(2, this.stoneTheme.accent).setDepth(4).setInteractive({ draggable: true, useHandCursor: true });
    this.input.setDraggable(thumb);
    const column = {
      bounds: new Phaser.Geom.Rectangle(x - width / 2 + 16, scrollTop, width - 82, scrollHeight),
      container: content, offset: 0, maxOffset, thumbHeight, thumb, track, trackTop, trackHeight,
      upButton: up.button, downButton: down.button, upIcon: up.text, downIcon: down.text
    };
    this.columns.push(column);
    track.on('pointerdown', pointer => this.setColumnOffsetFromPointer(column, pointer.y));
    if (maxOffset === 0) [track, thumb, up.button, down.button].forEach(control => control.disableInteractive());
    this.updateColumnScrollUi(column);
  }

  // This function connects an adventurer card to selection and detail
  // viewing. A short tap toggles selection, while a long press or closely
  // repeated tap opens the stat panel.
  bindCardInput(card, adventurer) {

    bindSelectionDetails(this, card, null, () => {
      const previous = this.lastTap.get(adventurer.id) ?? -Infinity;
      this.lastTap.set(adventurer.id, this.time.now);
      if (this.time.now - previous < 320) this.showAdventurerDetails(adventurer);
      else this.toggleAdventurer(adventurer.id);
    }, () => this.showAdventurerDetails(adventurer), { allowSceneInput: true });
  }

  // This function counts the party by the role limits used during selection.
  getSelectionCounts(selectedIds = this.selectedIds) {

    const counts = { Tank: 0, Healer: 0, DPS: 0, total: 0 };
    GameState.roster.forEach((adventurer) => {

      if (!selectedIds.has(adventurer.id)) return;
      const group = this.getRoleGroup(adventurer.role);
      counts[group] += 1;
      counts.total += 1;
    });
    return counts;
  }

  // This function combines melee and ranged damage dealers under the shared
  // DPS limit.
  getRoleGroup(role) {

    if (role === 'Tank') return 'Tank';
    if (role === 'Healer') return 'Healer';
    return 'DPS';
  }

  // This function enforces both party size and role limits before adding an
  // adventurer.
  canAddToSelection(adventurer, selectedIds = this.selectedIds) {

    const counts = this.getSelectionCounts(selectedIds);
    const roleGroup = this.getRoleGroup(adventurer.role);
    if (counts.total >= MAX_PARTY_SIZE) return false;
    return counts[roleGroup] < ROLE_LIMITS[roleGroup];
  }

  // This function explains which party limit prevents this selection.
  getSelectionBlockReason(adventurer) {

    const counts = this.getSelectionCounts();
    const roleGroup = this.getRoleGroup(adventurer.role);

    if (counts.total >= MAX_PARTY_SIZE) return 'Party is limited to five adventurers.';
    if (roleGroup === 'Tank' && counts.Tank >= ROLE_LIMITS.Tank) return 'Only one tank can be selected.';
    if (roleGroup === 'Healer' && counts.Healer >= ROLE_LIMITS.Healer) return 'Only two healers can be selected.';
    if (roleGroup === 'DPS' && counts.DPS >= ROLE_LIMITS.DPS) return 'Only four DPS can be selected.';
    return '';
  }

  // This function adds or removes an adventurer and explains any selection
  // limit.
  toggleAdventurer(id) {

    HapticsService.tap();
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
      this.refreshSelectionUi();
      return;
    }

    const adventurer = GameState.roster.find((entry) => entry.id === id);
    if (!adventurer) return;

    const reason = this.getSelectionBlockReason(adventurer);
    if (reason) {
      this.showToast(reason);
      return;
    }

    this.selectedIds.add(id);
    this.refreshSelectionUi();
  }

  // This function moves the role list by one comfortable browsing step.
  scrollColumn(column, direction) {

    this.setColumnOffset(column, column.offset + direction * 130, true);
  }

  // This function keeps list scrolling within bounds and updates its
  // controls.
  setColumnOffset(column, offset, animate = false) {

    this.tweens.killTweensOf(column.container);
    column.offset = Phaser.Math.Clamp(offset, 0, column.maxOffset);
    if (animate) {
      this.tweens.add({ targets: column.container, y: -column.offset, duration: 140, ease: 'Quad.Out' });
    } else {
      column.container.y = -column.offset;
    }
    this.updateColumnScrollUi(column);
  }

  // This function translates a scrollbar tap into a position in the roster
  // list.
  setColumnOffsetFromPointer(column, pointerY) {

    const minY = column.trackTop + column.thumbHeight / 2;
    const maxY = column.trackTop + column.trackHeight - column.thumbHeight / 2;
    const clampedY = Phaser.Math.Clamp(pointerY, minY, maxY);
    const usableHeight = Math.max(1, column.trackHeight - column.thumbHeight);
    const ratio = (clampedY - minY) / usableHeight;
    this.setColumnOffset(column, ratio * column.maxOffset, false);
  }

  // This function shows the list position and dims scrolling controls when
  // unnecessary.
  updateColumnScrollUi(column) {

    const scrollable = column.maxOffset > 0;
    const alpha = scrollable ? 1 : 0.28;
    column.track.setAlpha(alpha);
    column.thumb.setAlpha(alpha);
    column.upButton.setAlpha(alpha);
    column.downButton.setAlpha(alpha);
    column.upIcon.setAlpha(alpha);
    column.downIcon.setAlpha(alpha);

    if (!scrollable) {
      column.thumb.y = column.trackTop + column.trackHeight / 2;
      return;
    }

    const ratio = column.offset / column.maxOffset;
    const minY = column.trackTop + column.thumbHeight / 2;
    const maxY = column.trackTop + column.trackHeight - column.thumbHeight / 2;
    column.thumb.y = Phaser.Math.Linear(minY, maxY, ratio);
  }

  // This function shows selected and unavailable adventurers alongside party
  // readiness.
  refreshSelectionUi() {

    const counts = this.getSelectionCounts();
    this.partyCountText.setText(
      `${counts.total} / ${MAX_PARTY_SIZE} selected  |  Tanks ${counts.Tank}/${ROLE_LIMITS.Tank}  |  Healers ${counts.Healer}/${ROLE_LIMITS.Healer}  |  DPS ${counts.DPS}/${ROLE_LIMITS.DPS}`
    );

    this.cards.forEach((objects, id) => {
      const selected = this.selectedIds.has(id);
      const disabled = !selected && !this.canAddToSelection(objects.adventurer);
      objects.card.setFillStyle(selected ? 0x3b321d : 0x1f2937).setStrokeStyle(selected ? 4 : 2, selected ? STONE.gold : STONE.edge);
      [...objects.card.pressVisuals, objects.portrait, objects.name, objects.cls, objects.level].forEach(object => object.setAlpha(disabled ? 0.45 : 1));
    });
    const ready = counts.total === MAX_PARTY_SIZE;
    this.beginButton.setStrokeStyle(ready ? 3 : 2, ready ? STONE.gold : STONE.edge);
    this.beginButtonText.setColor(ready ? STONE.text : STONE.muted);
    this.refreshLineup();
  }

  refreshLineup() {
    this.lineup.removeAll(true);
    const { width } = this.scale;
    const heroes = GameState.roster.filter(hero => this.selectedIds.has(hero.id));
    const slotWidth = (width - 100) / 5;
    for (let index = 0; index < MAX_PARTY_SIZE; index++) {
      const x = 50 + slotWidth * (index + 0.5);
      const hero = heroes[index];
      const panel = addStonePanel(this, x, 839, slotWidth - 16, 150, 0);
      this.lineup.add(panel);
      if (hero) {
        const icon = stoneIcon(this, x - slotWidth / 2 + 58, 838, ROLE_COLUMNS.find(role => role.roles.includes(hero.role)).title, 46, 0, this.stoneTheme.accent);
        const name = stoneText(this, x + 25, 813, hero.name, 32, 0);
        const cls = stoneText(this, x + 25, 859, hero.shortName ?? hero.className, 27, 0, { fontFamily: 'Arial', color: STONE.muted });
        [name, cls].forEach(label => { if (label.width > slotWidth - 135) label.setScale((slotWidth - 135) / label.width); });
        const hit = this.add.rectangle(x, 839, slotWidth - 16, 150, 0, 0);
        bindSelectionDetails(this, hit, null, () => this.toggleAdventurer(hero.id), () => this.showAdventurerDetails(hero));
        this.lineup.add([icon, name, cls, hit]);
      } else {
        this.lineup.add(stoneText(this, x, 816, `SLOT ${index + 1}`, 30, 0, { color: STONE.muted }));
        this.lineup.add(stoneText(this, x, 861, 'Choose an adventurer', 26, 0, { fontFamily: 'Arial', color: STONE.muted }));
      }
    }
  }

  // This function saves a complete party and advances to the battle overview.
  begin() {

    if (this.selectedIds.size !== MAX_PARTY_SIZE) {
      this.showToast('Choose five adventurers before continuing.');
      return;
    }

    HapticsService.confirm();
    GameState.activeParty = GameState.roster
      .filter((adventurer) => this.selectedIds.has(adventurer.id))
      .map((adventurer) => ({ ...adventurer }));
    GameState.lastPartyIds = GameState.activeParty.map((adventurer) => adventurer.id);
    saveProfile();
    this.scene.start('DungeonScene');
  }

  // Use the shared themed modal for equipment-adjusted stats and class details.
  showAdventurerDetails(adventurer) {
    adventurer = getEquippedAdventurer(adventurer);
    const stats = [
      `Level ${adventurer.level} · ${adventurer.role}`,
      `HP ${adventurer.maxHp} · Attack ${adventurer.attackPower}`,
      adventurer.healPower > 0 ? `Healing ${adventurer.healPower}` : '',
      adventurer.maxMana > 0 ? `Mana ${adventurer.maxMana}` : '',
      `Move Speed ${adventurer.moveSpeed} · Crit ${Math.round((adventurer.critChance ?? 0) * 100)}%`,
      `Happiness ${adventurer.happiness ?? 70}% (${happinessLabel(adventurer.happiness ?? 70)})`
    ].filter(Boolean).join('\n');
    showSelectionDetails(this, { title: adventurer.name, description: `${adventurer.className}\n\n${stats}\n\n${adventurer.description ?? ''}` });
  }

  showToast(message) {
    this.toast?.forEach(object => object.destroy());
    const notice = preparationNotice(this, this.scale.width / 2, this.scale.height / 2, message, { depth: 6000, width: 1200, fontSize: 34 });
    this.toast = [notice.panel, notice.text];
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1800, duration: 350, onComplete: () => { notice.panel.destroy(); notice.text.destroy(); } });
  }
}
