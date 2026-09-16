import { bindSelectionDetails, addDetailsHint } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { happinessLabel } from '../game/AdventurerProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';
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

  // This function builds the party selection screen with separate scrolling
  // columns for each role. It connects wheel and scrollbar input, adds the
  // battle overview button, and displays the current selection against the
  // party limits.
  create() {

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#111827');
    this.cards.clear();
    this.columns = [];

    this.createBackButton();
    addDetailsHint(this, height * 0.82, 'Long-press or hold-click an adventurer for stats.');

    this.add.text(width / 2, UI_SAFE_TOP + 14, 'PARTY SELECT', { fontFamily: 'Arial', fontSize: '68px', fontStyle: 'bold', color: '#f8fafc' }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 67, GameState.currentDelve?.name ?? 'Unknown Delve', { fontFamily: 'Arial', fontSize: '34px', color: '#cbd5e1' }).setOrigin(0.5);
    this.partyCountText = this.add.text(width / 2, UI_SAFE_TOP + 106, '', { fontFamily: 'Arial', fontSize: '30px', color: '#94a3b8' }).setOrigin(0.5);

    // Divide the available width into four role columns with a shared viewing
    // height.
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

    // Create the overview button. The begin handler still checks that exactly
    // five adventurers are selected.
    this.beginButton = this.add.rectangle(width / 2, height * 0.90, 720, 96, 0x334155).setInteractive({ useHandCursor: true });
    this.beginButtonText = this.add.text(width / 2, height * 0.90, 'BATTLE OVERVIEW', { fontFamily: 'Arial', fontSize: '40px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.beginButton.on('pointerdown', () => this.begin());

    // Scroll only the role column under the pointer.
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {

      const column = this.columns.find((entry) => Phaser.Geom.Rectangle.Contains(entry.bounds, pointer.x, pointer.y));
      if (column) this.scrollColumn(column, deltaY > 0 ? 1 : -1);
    });

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

  // This function lets the player return to the delve overview with touch
  // feedback.
  createBackButton() {

    const y = UI_SAFE_TOP + 18;
    const button = this.add.rectangle(180, y, 300, 64, 0x334155).setInteractive({ useHandCursor: true });
    this.add.text(180, y, '< OVERVIEW', { fontFamily: 'Arial', fontSize: '33px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    button.on('pointerdown', () => {

      HapticsService.tap();
      this.scene.start('DelveSelectScene');
    });
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

    this.add.rectangle(x, top + height / 2, width, height + 82, 0x172033).setStrokeStyle(3, 0x334155);
    this.add.text(x, top - 24, definition.title, { fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#f8fafc' }).setOrigin(0.5);

    // Choose the adventurers belonging to this column and clip the scrolling
    // content to its visible area.
    const roster = GameState.roster.filter((adventurer) => definition.roles.includes(adventurer.role));
    const itemHeight = 150;
    const scrollTop = top + 18;
    const scrollHeight = height - 36;
    const content = this.add.container(0, 0);
    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff).fillRect(x - width / 2 + 10, scrollTop, width - 40, scrollHeight);
    const mask = maskShape.createGeometryMask();
    content.setMask(mask);

    // Create an interactive card for every matching adventurer and retain its
    // display objects for selection updates.
    const contentCenterX = x - 8;
    const cardWidth = width - 58;
    roster.forEach((adventurer, index) => {

      const cardY = scrollTop + 64 + index * itemHeight;
      const card = this.add.rectangle(contentCenterX, cardY, cardWidth, 126, 0x1f2937)
        .setStrokeStyle(3, 0x475569)
        .setInteractive({ useHandCursor: true });
      const portrait = this.add.circle(contentCenterX - width * 0.31, cardY, 36, adventurer.color).setStrokeStyle(3, 0xffffff, 0.18);
      const name = this.add.text(contentCenterX - width * 0.22, cardY - 42, adventurer.name, { fontFamily: 'Arial', fontSize: '31px', fontStyle: 'bold', color: '#ffffff' });
      const cls = this.add.text(contentCenterX - width * 0.22, cardY - 5, adventurer.className, { fontFamily: 'Arial', fontSize: '25px', color: '#cbd5e1' });
      const level = this.add.text(contentCenterX - width * 0.22, cardY + 28, `Lv ${adventurer.level} • ${adventurer.happiness ?? 70}%`, { fontFamily: 'Arial', fontSize: '22px', color: '#94a3b8' });
      content.add([card, portrait, name, cls, level]);
      this.cards.set(adventurer.id, { card, portrait, name, cls, level, adventurer });
      this.bindCardInput(card, adventurer);
    });

    if (roster.length === 0) {
      const empty = this.add.text(x, scrollTop + scrollHeight / 2, 'No adventurers yet', { fontFamily: 'Arial', fontSize: '26px', color: '#64748b' }).setOrigin(0.5);
      content.add(empty);
    }

    // Build the arrow buttons and scroll track beside the card list.
    const trackHeight = scrollHeight;
    const trackTop = scrollTop;
    const trackX = x + width / 2 - 18;
    const upButton = this.add.rectangle(trackX, scrollTop + 20, 24, 24, 0x334155).setInteractive({ useHandCursor: true });
    const upIcon = this.add.text(trackX, scrollTop + 20, '^', { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    const downButton = this.add.rectangle(trackX, scrollTop + scrollHeight - 20, 24, 24, 0x334155).setInteractive({ useHandCursor: true });
    const downIcon = this.add.text(trackX, scrollTop + scrollHeight - 20, 'v', { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    const track = this.add.rectangle(trackX, trackTop + trackHeight / 2, 10, trackHeight - 56, 0x0f172a, 0.95).setStrokeStyle(2, 0x475569);

    // Calculate how far the list can scroll and size the thumb to the visible
    // fraction of the content.
    const contentHeight = roster.length > 0 ? (128 + (roster.length - 1) * itemHeight) : scrollHeight;
    const maxOffset = Math.max(0, contentHeight - scrollHeight);
    const visibleRatio = Phaser.Math.Clamp(scrollHeight / Math.max(contentHeight, scrollHeight), 0.15, 1);
    const thumbHeight = Math.max(48, (trackHeight - 56) * visibleRatio);
    const thumb = this.add.rectangle(trackX, trackTop + thumbHeight / 2, 18, thumbHeight, 0x64748b)
      .setStrokeStyle(2, 0x93c5fd)
      .setInteractive({ draggable: true, useHandCursor: true });
    this.input.setDraggable(thumb);

    const column = {
      bounds: new Phaser.Geom.Rectangle(x - width / 2, top, width, height),
      container: content,
      offset: 0,
      maxOffset,
      thumbHeight,
      thumb,
      track,
      trackTop: trackTop + 28,
      trackHeight: trackHeight - 56,
      upButton,
      downButton,
      upIcon,
      downIcon
    };
    this.columns.push(column);

    upButton.on('pointerdown', () => this.scrollColumn(column, -1));
    downButton.on('pointerdown', () => this.scrollColumn(column, 1));
    track.setInteractive({ useHandCursor: true });
    track.on('pointerdown', (pointer) => {

      if (column.maxOffset <= 0) return;
      this.setColumnOffsetFromPointer(column, pointer.y);
    });

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
    }, () => this.showAdventurerDetails(adventurer));
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

      if (selected) {
        objects.card.setFillStyle(0x29415f).setStrokeStyle(4, 0x93c5fd).setAlpha(1);
        objects.portrait.setAlpha(1);
        objects.name.setAlpha(1);
        objects.cls.setAlpha(1);
        objects.level.setAlpha(1);
      } else if (disabled) {
        objects.card.setFillStyle(0x1f2937).setStrokeStyle(3, 0x293241).setAlpha(0.30);
        objects.portrait.setAlpha(0.30);
        objects.name.setAlpha(0.34);
        objects.cls.setAlpha(0.30);
        objects.level.setAlpha(0.28);
      } else {
        objects.card.setFillStyle(0x1f2937).setStrokeStyle(3, 0x374151).setAlpha(0.75);
        objects.portrait.setAlpha(0.78);
        objects.name.setAlpha(0.82);
        objects.cls.setAlpha(0.72);
        objects.level.setAlpha(0.68);
      }
    });

    // Use the overview button appearance to indicate whether the party is
    // complete.
    const ready = counts.total === MAX_PARTY_SIZE;
    this.beginButton.setFillStyle(ready ? 0x475569 : 0x1f2937);
    this.beginButtonText.setColor(ready ? '#ffffff' : '#64748b');
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

  // This function opens a modal panel showing the selected adventurer's
  // identity, stats, happiness, and class description. It tracks every modal
  // object so tapping the close button or backdrop removes the whole panel.
  showAdventurerDetails(adventurer) {

    HapticsService.tap();
    const { width, height } = this.scale;

    const depth = 5000;
    const panelWidth = Math.min(980, width * 0.64);
    const panelHeight = Math.min(760, height * 0.84);
    const panelX = width / 2;
    const panelY = height / 2;
    const modalElements = [];

    // This function tracks each detail panel object so closing the panel
    // removes it all.
    const addElement = (element) => {

      modalElements.push(element);
      return element;
    };

    const blocker = addElement(this.add.rectangle(panelX, panelY, width, height, 0x000000, 0.58).setDepth(depth).setInteractive());
    addElement(this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x111827, 0.99).setStrokeStyle(5, 0x64748b).setDepth(depth + 1));

    const top = panelY - panelHeight / 2;
    const bottom = panelY + panelHeight / 2;

    addElement(this.add.text(panelX, top + 78, adventurer.name, {
      fontFamily: 'Arial', fontSize: '56px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setDepth(depth + 2));
    addElement(this.add.text(panelX, top + 142, adventurer.className, {
      fontFamily: 'Arial', fontSize: '36px', fontStyle: 'bold', color: '#e2e8f0'
    }).setOrigin(0.5).setDepth(depth + 2));
    addElement(this.add.text(panelX, top + 190, `Role: ${adventurer.role}`, {
      fontFamily: 'Arial', fontSize: '30px', color: '#cbd5e1'
    }).setOrigin(0.5).setDepth(depth + 2));

    // Build the stat list, adding healing and mana only when those resources
    // apply to this adventurer.
    const statRows = [
      ['Level', `${adventurer.level}`],
      ['HP', `${adventurer.maxHp}`],
      ['Attack', `${adventurer.attackPower}`]
    ];

    if (typeof adventurer.healPower === 'number' && adventurer.healPower > 0) {
      statRows.push(['Heal Power', `${adventurer.healPower}`]);
    }
    if ((adventurer.maxMana ?? 0) > 0) {
      statRows.push(['Mana', `${adventurer.maxMana}`]);
    }

    statRows.push(
      ['Move Speed', `${adventurer.moveSpeed}`],
      ['Crit', `${Math.round((adventurer.critChance ?? 0) * 100)}%`],
      ['Happiness', `${adventurer.happiness ?? 70}% (${happinessLabel(adventurer.happiness ?? 70)})`]
    );

    const labelX = panelX - panelWidth * 0.28;
    const valueX = panelX + panelWidth * 0.04;
    const startY = top + 250;
    const lineGap = 43;

    statRows.forEach((row, index) => {

      const y = startY + index * lineGap;
      addElement(this.add.text(labelX, y, `${row[0]}:`, {
        fontFamily: 'Arial', fontSize: '29px', fontStyle: 'bold', color: '#94a3b8'
      }).setOrigin(0, 0.5).setDepth(depth + 2));
      addElement(this.add.text(valueX, y, row[1], {
        fontFamily: 'Arial', fontSize: '29px', color: '#e2e8f0'
      }).setOrigin(0, 0.5).setDepth(depth + 2));
    });

    // Reserve the bottom of the detail panel for the description and close
    // button.
    const closeY = bottom - 58;
    const descriptionY = closeY - 94;
    addElement(this.add.text(panelX, descriptionY, adventurer.description, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#94a3b8',
      align: 'center',
      wordWrap: { width: panelWidth - 130, useAdvancedWrap: true }
    }).setOrigin(0.5).setDepth(depth + 2));

    const close = addElement(this.add.rectangle(panelX, closeY, 300, 72, 0x334155)
      .setInteractive({ useHandCursor: true }).setDepth(depth + 2));
    addElement(this.add.text(panelX, closeY, 'CLOSE', {
      fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setDepth(depth + 3));

    // This function removes the complete adventurer detail panel when it
    // closes.
    const destroyModal = () => modalElements.forEach((element) => element.destroy());
    blocker.on('pointerdown', destroyModal);
    close.on('pointerdown', destroyModal);
  }

  // This function gives brief feedback about an unavailable choice or
  // completed action.
  showToast(message) {

    const { width, height } = this.scale;
    const label = this.add.text(width / 2, height * 0.18, message, {
      fontFamily: 'Arial',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#fca5a5',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center',
      wordWrap: { width: width * 0.78 }
    }).setOrigin(0.5).setDepth(6000);

    this.tweens.add({
      targets: label,
      alpha: 0,
      delay: 1000,
      duration: 350,
      onComplete: () => label.destroy()
    });
  }
}
