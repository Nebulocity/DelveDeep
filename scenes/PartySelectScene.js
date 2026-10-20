import { preloadCombatHud, combatPanel as addStonePanel, combatButton as addStoneButton, combatText as stoneText } from '../ui/CombatHudTheme.js';
import { scrollbarSurface, scrollbarArrow } from '../ui/Scrollbar.js';
import { classIcon } from '../ui/IdentityIcons.js';
// The role lists hold selectable adventurers; the lineup holds the chosen party. The list
// mask limits both visible rows and valid touches. Remembering IDs keeps selection stable
// across sorting, scrolling and returning to this screen.

import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { preloadCarvedStone, stoneIcon, STONE } from '../ui/CarvedStone.js';
import { preparationFrame, preparationButton, preparationNotice } from '../ui/DelvePreparation.js';
import { bindButtonPress } from '../ui/ButtonPress.js';
import { preloadSelectionPortraits, selectionCharacterPortrait, refreshSelectionIdleVisibility } from '../ui/SelectedCharacterIdle.js';
import { bindSelectionDetails, showSelectionDetails } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { addBgmToggle } from '../ui/BgmToggle.js';

import { getEquippedAdventurer } from '../game/Equipment.js';
import HapticsService from '../services/HapticsService.js';
import { happinessLabel } from '../game/AdventurerProgression.js';
import { saveProfile } from '../game/GameStorage.js';
import { resolveWorldMapCharacter } from '../game/WorldMapCharacter.js';
import { UI_SAFE_TOP, UI_SAFE_BOTTOM, UI_SAFE_LEFT, UI_SAFE_RIGHT } from '../ui/Layout.js';
import { currentTownArtwork } from '../ui/TownFeatureUI.js';
import { pois } from '../data/worldMap.js';
import { preloadEnvironment } from '../combat/LayeredEnvironment.js';
import { everdeepUnavailableIds } from '../game/Everdeep.js';

import { MAX_PARTY_SIZE, ROLE_LIMITS, partyCounts, partyRoleGroup, partyCompositionWarning } from '../game/PartySelection.js';

const ROLE_COLUMNS = [
  { title: 'TANKS', roles: ['Tank'] },
  { title: 'HEALERS', roles: ['Healer'] },
  { title: 'MELEE', roles: ['Melee DPS'] },
  { title: 'RANGED', roles: ['Ranged DPS'] }
];

export default class PartySelectScene extends Phaser.Scene {

  // This helper registers PartySelectScene so the game can navigate to this screen.
  constructor() {

    super('PartySelectScene');

    // A Set keeps each value once. has checks membership without searching a list for
    // duplicate entries.
    this.selectedIds = new Set();

    // A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
    // object; get/set read and write that same key.
    this.cards = new Map();
    this.columns = [];
    this.lastTap = new Map();
  }

  // This helper restores the party selection whenever this screen opens.
  init(data = {}) {
    this.returnScene = data.returnScene ?? 'DelveSelectScene';
    this.townParty = data.origin === 'town';
    const town = this.townParty ? pois.find(poi => poi.id === GameState.world.currentLocation && poi.type === 'town') : null;
    this.partyDelve = this.townParty ? null : GameState.currentDelve;
    this.partyContext = this.townParty ? { name: town?.name ?? 'Town' } : this.partyDelve;
    this.backgroundKey = this.townParty ? currentTownArtwork() : this.partyDelve?.visuals?.environment?.layers[0]?.key;
    this.nextAvailabilityCheck = 0;
    this.unavailableIds = everdeepUnavailableIds();
    this.selectedIds = this.buildInitialSelection();
  }

  // A wall-clock expedition can return while this screen is open. Refresh the cards
  // once per second; combat itself is not running on this selection screen.
  update() {
    const now = Date.now();
    if (now < (this.nextAvailabilityCheck ?? 0)) return;
    this.nextAvailabilityCheck = now + 1000;
    const unavailable = everdeepUnavailableIds(now);
    const changed = [...unavailable].join('|') !== [...this.unavailableIds].join('|');
    this.unavailableIds = unavailable;
    const rosterChanged = this.rosterSignature !== this.currentRosterSignature();
    if (rosterChanged) {
      this.rosterSignature = this.currentRosterSignature();
      this.refreshRoleColumns();
      for (const id of this.selectedIds) if (!GameState.roster.some(hero => hero.id === id)) this.selectedIds.delete(id);
    }
    if (changed || rosterChanged) {
      for (const id of this.selectedIds) if (unavailable.has(id)) this.selectedIds.delete(id);
      this.refreshSelectionUi();
    }
  }

  // Load the shared battle surfaces and existing character portraits.
  preload() {
    preloadCarvedStone(this);
    preloadCombatHud(this);
    if (this.partyDelve?.visuals?.environment) preloadEnvironment(this, this.partyDelve.visuals.environment);
    preloadSelectionPortraits(this);
  }

  // We build this screen and connect its input after the queued assets are ready. Display
  // objects belong to this scene and are removed when the scene shuts down.
  create() {

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    this.cards.clear();
    this.columns = [];
    this.lastTap.clear();
    preparationFrame(this, this.partyContext, 'PARTY MANAGEMENT', 'CANCEL', () => this.scene.start(this.returnScene),
      { backgroundKey: this.backgroundKey, backgroundAlpha: this.townParty ? 1 : 0.48 });
    this.bgmToggle = addBgmToggle(this, width - 165, 64);
    const cancel = () => {
      if (this.selectionDetailsClose) this.selectionDetailsClose();
      else this.scene.start(this.returnScene);
    };
    this.input.keyboard?.on('keydown-ESC', cancel);
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ESC', cancel));

    // Separate header, summary, lists, lineup and footer in logical canvas coordinates.
    const usableWidth = width - UI_SAFE_LEFT - UI_SAFE_RIGHT;
    this.partyCountText = stoneText(this, width / 2, UI_SAFE_TOP + 12, '', UI_FONT_SIZES.partyCount, 3,
      { fontFamily: UI_FONT_FAMILIES.sans, color: STONE.muted }).setOrigin(0.5, 0);
    this.recommendationText = stoneText(this, width / 2, this.partyCountText.y + this.partyCountText.height + 2,
      '', UI_FONT_SIZES.support28, 3, { fontFamily: UI_FONT_FAMILIES.sans, color: STONE.muted }).setOrigin(0.5, 0);

    // Set initial copy before measuring the summary's actual font height.
    this.partyCountText.setText('0/5 Selected · Tanks 0/1 · Healers 0/2 · DPS 0/4');
    this.recommendationText.setY(this.partyCountText.y + this.partyCountText.height + 2)
      .setText('Recommended: one Tank, one Healer and three DPS.');
    const lineupHeight = 120;
    const actionHeight = 84;
    const actionY = height - UI_SAFE_BOTTOM - actionHeight / 2;
    this.lineupY = height - 234;
    this.lineupHeight = lineupHeight;
    this.lineup = this.add.container(0, 0).setDepth(5);
    const panelTop = this.recommendationText.y + this.recommendationText.height + 16;
    const panelBottom = this.lineupY - lineupHeight / 2 - 20;
    const gap = 18;
    const columnWidth = (usableWidth - gap * 3) / 4;
    this.roleLayout = { top: panelTop, height: panelBottom - panelTop, width: columnWidth, gap };
    this.refreshRoleColumns();
    this.rosterSignature = this.currentRosterSignature();

    const autoWidth = 360;
    const saveWidth = Math.min(630, usableWidth * 0.30);
    const autoX = UI_SAFE_LEFT + autoWidth / 2;
    const saveX = width - UI_SAFE_RIGHT - saveWidth / 2;
    this.autoSelectButton = addStoneButton(this, autoX, actionY, autoWidth, actionHeight, 10);
    this.autoSelectText = stoneText(this, autoX, actionY, 'AUTO-SELECT', UI_FONT_SIZES.body30, 11, { color: STONE.muted });
    bindButtonPress(this, this.autoSelectButton, [this.autoSelectText], () => this.autoSelectParty());
    const action = preparationButton(this, saveX, actionY, saveWidth, actionHeight, 'SAVE PARTY',
      () => this.begin(), { primary: true, size: UI_FONT_SIZES.body36 });
    this.beginButton = action.button.setName('party-save');
    this.autoSelectButton.setName('party-auto-select');
    this.beginButtonText = action.text;
    stoneText(this, width / 2, this.lineupY + lineupHeight / 2 + 20,
      'Tap to select or remove. Hold for details. Drag lists to browse.', UI_FONT_SIZES.support28, 3,
      { fontFamily: UI_FONT_FAMILIES.sans, color: STONE.muted });

    // Scroll only the role column under the pointer.
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const column = this.columns.find((entry) => Phaser.Geom.Rectangle.Contains(entry.bounds, pointer.x, pointer.y));
      if (column) this.scrollColumn(column, deltaY > 0 ? 1 : -1);
    });

    let listDrag = null;

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    this.input.on('pointerdown', (pointer) => {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const column = this.columns.find((entry) => Phaser.Geom.Rectangle.Contains(entry.bounds, pointer.x, pointer.y));

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      if (column?.maxOffset > 0) listDrag = { id: pointer.id, y: pointer.y, startY: pointer.y, column, moved: false };
    });

    this.input.on('pointermove', (pointer) => {
      if (listDrag && !listDrag.column.container.active) listDrag = null;
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

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const column = this.columns.find((entry) => entry.thumb === gameObject);
      if (!column || column.maxOffset <= 0) return;

      const ratio = column.thumb.scrollbarProgressFromPointer(pointer.y, column.trackTop, column.trackHeight, true);
      this.setColumnOffset(column, ratio * column.maxOffset, false);
    });

    this.refreshSelectionUi();
  }

  // This helper restores a valid previous party while leaving first-time selection empty.
  buildInitialSelection() {

    // A Set keeps each value once. has checks membership without searching a list for
    // duplicate entries.
    const initialIds = new Set();

    const preferredIds = GameState.lastPartyIds;

    preferredIds.forEach((id) => {

      if (initialIds.size >= MAX_PARTY_SIZE) return;

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const adventurer = GameState.roster.find((entry) => entry.id === id);
      if (adventurer && this.canAddToSelection(adventurer, initialIds)) initialIds.add(id);
    });

    return initialIds;
  }

  currentRosterSignature() {
    return GameState.roster.map(hero => `${hero.id}:${hero.role}`).join('|');
  }

  refreshRoleColumns() {
    const offsets = this.columns.map(column => column.offset);
    this.columns.forEach(column => column.destroy());
    this.columns = [];
    this.cards.clear();
    const { top, height, width, gap } = this.roleLayout;
    ROLE_COLUMNS.forEach((definition, index) => {
      const x = UI_SAFE_LEFT + width / 2 + index * (width + gap);
      this.createRoleColumn(definition, x, top, width, height);
      this.setColumnOffset(this.columns[index], offsets[index] ?? 0);
    });
  }

  createRoleColumn(definition, x, top, width, height) {
    const retained = new Set(this.children.list);
    addStonePanel(this, x, top + height / 2, width, height, 0);
    stoneIcon(this, x - width / 2 + 54, top + 35, definition.title, 40, 2, this.stoneTheme.accent);
    const roster = GameState.roster.filter(adventurer => definition.roles.includes(adventurer.role));
    stoneText(this, x + 10, top + 35, `${definition.title} · ${roster.length}`, UI_FONT_SIZES.body34, 2);
    const scrollTop = top + 60;
    const scrollHeight = height - 82;

    // Use spare list height for card padding while retaining three complete rows.
    const cardHeight = Math.min(140, Math.max(128, Math.floor((scrollHeight - 24) / 3)));
    const itemHeight = cardHeight + 12;
    const textStep = cardHeight * 0.27;
    const content = this.add.container(0, 0).setDepth(3);
    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff).fillRect(x - width / 2 + 20, scrollTop, width - 94, scrollHeight);
    const mask = maskShape.createGeometryMask();
    content.setMask(mask);
    const contentCenterX = x - 27;
    const cardWidth = width - 110;
    const renderedCards = [];
    roster.forEach((adventurer, index) => {
      const cardY = scrollTop + cardHeight / 2 + index * itemHeight;
      const card = addStoneButton(this, contentCenterX, cardY, cardWidth, cardHeight, 0);
      renderedCards.push(card);
      const selection = this.add.graphics();
      selection.fillStyle(0xbb8528, 0.28).fillRoundedRect(contentCenterX - cardWidth / 2 + 8,
        cardY - cardHeight / 2 + 8, cardWidth - 16, cardHeight - 16, 12);
      selection.lineStyle(3, STONE.gold, 1).strokeRoundedRect(contentCenterX - cardWidth / 2 + 8,
        cardY - cardHeight / 2 + 8, cardWidth - 16, cardHeight - 16, 12);

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      const portraitX = contentCenterX - cardWidth / 2 + 58;
      const portrait = selectionCharacterPortrait(this, adventurer, portraitX, cardY, 104, 'partySelect',
        this.selectedIds.has(adventurer.id));
      const check = this.add.graphics({ x: portraitX + 27, y: cardY + textStep });
      check.fillStyle(0x17130b).fillCircle(0, 0, 17);
      check.lineStyle(2, STONE.gold).strokeCircle(0, 0, 17);
      check.lineStyle(4, 0xffe7a7).lineBetween(-8, 0, -2, 7).lineBetween(-2, 7, 9, -7);
      const status = stoneText(this, portraitX, cardY + textStep, '', UI_FONT_SIZES.compact22, 0,
        { fontFamily: UI_FONT_FAMILIES.sans, color: '#e9c78b' });
      const textX = contentCenterX - cardWidth / 2 + 112;
      const textWidth = cardWidth - 146;

      // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
      // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the
      // object's corner.
      const name = stoneText(this, textX, cardY - textStep, adventurer.name, UI_FONT_SIZES.body32, 0).setOrigin(0, 0.5);

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      const cls = stoneText(this, textX + 40, cardY, adventurer.shortName ?? adventurer.className, UI_FONT_SIZES.partyClass, 0, { fontFamily: UI_FONT_FAMILIES.sans, fontStyle: UI_FONT_WEIGHTS.normal, color: STONE.muted }).setOrigin(0, 0.5);
      const level = stoneText(this, textX, cardY + textStep, `Lv ${adventurer.level} · ${adventurer.happiness ?? 70}%`, UI_FONT_SIZES.partyLevel, 0, { fontFamily: UI_FONT_FAMILIES.sans, fontStyle: UI_FONT_WEIGHTS.normal, color: STONE.muted }).setOrigin(0, 0.5);
      const emblem = classIcon(this, adventurer.className, textX + 16, cardY, 32);
      [name, cls, level].forEach(label => {
        const availableWidth = textWidth - (label === cls ? 40 : 0);
        label.setScale(Math.min(1, availableWidth / label.width, (textStep - 2) / label.height));
      });

      // ... expands these entries into the new list or call. It does not deep-copy the
      // objects inside.
      content.add([...card.pressVisuals, selection, portrait, name, emblem, cls, level, check, status, card]);
      card.setName(`party-adventurer-${adventurer.id}`);
      this.cards.set(adventurer.id, { card, selection, check, status, portrait, name, cls, level, emblem, adventurer });
      this.bindCardInput(card, adventurer);

      // Geometry masks only clip rendering; reject input outside the visible list too.
      const hitTest = card.input.hitAreaCallback;
      card.input.hitAreaCallback = (area, localX, localY, object) => {
        const worldY = card.y + content.y + localY - card.height / 2;
        return worldY >= scrollTop && worldY <= scrollTop + scrollHeight && hitTest(area, localX, localY, object);
      };
    });

    if (!roster.length) content.add(stoneText(this, x, scrollTop + scrollHeight / 2, 'No adventurers yet', UI_FONT_SIZES.support28, 0));
    const trackX = x + width / 2 - 36;
    const trackTop = scrollTop + 62;
    const trackHeight = scrollHeight - 124;
    const up = scrollbarArrow(this, trackX, scrollTop + 27, -1, () => this.scrollColumn(column, -1));
    const down = scrollbarArrow(this, trackX, scrollTop + scrollHeight - 27, 1, () => this.scrollColumn(column, 1));

    // This gives the display object an input hit area. Visible artwork alone does not make
    // an object respond to a tap.
    const track = scrollbarSurface(this, trackX, trackTop + trackHeight / 2, 56, trackHeight, 'track', 3)
      .setInteractive({ useHandCursor: true });

    // Measure the actual final card, including inter-card spacing, against the mask.
    const contentHeight = renderedCards.length
      ? renderedCards.at(-1).getBounds().bottom - scrollTop : 0;

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    const maxOffset = Math.max(0, contentHeight - scrollHeight);
    const thumbHeight = Math.min(trackHeight, Math.max(52, trackHeight * Math.min(1, scrollHeight / Math.max(1, contentHeight))));
    const thumb = scrollbarSurface(this, trackX, trackTop + thumbHeight / 2, 56, thumbHeight, 'thumb', 4)
      .setInteractive({ draggable: true, useHandCursor: true });
    this.input.setDraggable(thumb);
    const column = {
      bounds: new Phaser.Geom.Rectangle(x - width / 2 + 16, scrollTop, width - 94, scrollHeight),
      portraits: content.list.filter(object => object.selectionIdle),
      container: content, offset: 0, maxOffset, thumbHeight, thumb, track, trackTop, trackHeight,
      upButton: up.button, downButton: down.button, upIcon: up.text, downIcon: down.text
    };

    this.columns.push(column);

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    track.on('pointerdown', pointer => this.setColumnOffsetFromPointer(column, pointer.y));
    const owned = this.children.list.filter(object => !retained.has(object));
    const destroy = () => {
      this.events.off('shutdown', destroy);
      this.tweens.killTweensOf(content);
      content.clearMask();
      mask.destroy();
      maskShape.destroy();
      owned.forEach(object => { if (object.scene) object.destroy(); });
    };
    column.destroy = destroy;
    this.events.once('shutdown', destroy);
    refreshSelectionIdleVisibility(column.portraits, column.bounds);
    this.updateColumnScrollUi(column);
  }

  // This helper connects an adventurer card to selection and detail viewing. A short tap
  // toggles selection, while a long press or closely repeated tap opens the stat panel.
  bindCardInput(card, adventurer) {

    bindSelectionDetails(this, card, null, () => {

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      const previous = this.lastTap.get(adventurer.id) ?? -Infinity;
      this.lastTap.set(adventurer.id, this.time.now);
      if (this.time.now - previous < 320) this.showAdventurerDetails(adventurer);
      else this.toggleAdventurer(adventurer.id);
    }, () => this.showAdventurerDetails(adventurer), { allowSceneInput: true });
  }

  // This helper counts the party by the role limits used during selection.
  getSelectionCounts(selectedIds = this.selectedIds) {

    return partyCounts(GameState.roster.filter(hero => selectedIds.has(hero.id)));
  }

  getRoleGroup(role) {
    return partyRoleGroup(role);
  }

  // This helper enforces both party size and role limits before adding an adventurer.
  canAddToSelection(adventurer, selectedIds = this.selectedIds) {
    if (this.unavailableIds?.has(adventurer.id)) return false;
    const counts = this.getSelectionCounts(selectedIds);
    const roleGroup = this.getRoleGroup(adventurer.role);
    if (counts.total >= MAX_PARTY_SIZE) return false;

    return counts[roleGroup] < ROLE_LIMITS[roleGroup];
  }

  // Choose a complete party with the same role limits used by manual selection.
  autoSelectParty() {

    const available = GameState.roster.filter(hero => !this.unavailableIds.has(hero.id));

    // A shuffled copy leaves the roster's saved order untouched while making every
    // adventurer in a role equally likely to appear in the chosen slots.
    const chooseRandom = (members, count) => Phaser.Utils.Array.Shuffle([...members]).slice(0, count);
    const tanks = chooseRandom(available.filter(hero => hero.role === 'Tank'), 1);
    const healers = chooseRandom(available.filter(hero => hero.role === 'Healer'), 1);
    const damageDealers = chooseRandom(available.filter(hero => hero.role === 'Melee DPS' || hero.role === 'Ranged DPS'), 3);

    // Keep the current lineup if the roster cannot fill every requested role.
    if (tanks.length < 1 || healers.length < 1 || damageDealers.length < 3) {
      this.showToast('Auto-select needs an available tank, healer and three DPS. Cancel an Everdeep expedition to bring adventurers home.');
      return;
    }

    HapticsService.tap();
    this.selectedIds = new Set([...tanks, ...healers, ...damageDealers].map(hero => hero.id));
    this.refreshSelectionUi();
  }

  // This helper explains which party limit prevents this selection.
  getSelectionBlockReason(adventurer) {

    if (this.unavailableIds.has(adventurer.id)) return 'In The Everdeep. Cancel that expedition to bring this adventurer home.';

    const counts = this.getSelectionCounts();
    const roleGroup = this.getRoleGroup(adventurer.role);

    if (counts.total >= MAX_PARTY_SIZE) return 'Party is limited to five adventurers.';
    if (roleGroup === 'Tank' && counts.Tank >= ROLE_LIMITS.Tank) return 'Only one tank can be selected.';
    if (roleGroup === 'Healer' && counts.Healer >= ROLE_LIMITS.Healer) return 'Only two healers can be selected.';

    if (roleGroup === 'DPS' && counts.DPS >= ROLE_LIMITS.DPS) return 'Only four DPS can be selected.';
    return '';
  }

  // This helper adds or removes an adventurer and explains any selection limit.
  toggleAdventurer(id) {

    HapticsService.tap();
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
      this.refreshSelectionUi();
      return;
    }

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
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

  // This helper moves the role list by one comfortable browsing step.
  scrollColumn(column, direction) {

    this.setColumnOffset(column, column.offset + direction * 130, true);
  }

  // This helper keeps list scrolling within bounds and updates its controls.
  setColumnOffset(column, offset, animate = false) {

    this.tweens.killTweensOf(column.container);

    // Clamp keeps the first argument between the lower bound (second argument) and upper
    // bound (third argument).
    column.offset = Phaser.Math.Clamp(offset, 0, column.maxOffset);
    if (animate) {
      this.tweens.add({ targets: column.container, y: -column.offset, duration: 140, ease: 'Quad.Out',
        onUpdate: () => refreshSelectionIdleVisibility(column.portraits, column.bounds) });
    } else {
      column.container.y = -column.offset;
    }
    refreshSelectionIdleVisibility(column.portraits, column.bounds);
    this.updateColumnScrollUi(column);
  }

  // This helper translates a scrollbar tap into a position in the roster list.
  setColumnOffsetFromPointer(column, pointerY) {

    const ratio = column.thumb.scrollbarProgressFromPointer(pointerY, column.trackTop, column.trackHeight);
    this.setColumnOffset(column, ratio * column.maxOffset, false);
  }

  // Hide the complete scroll control, including ornate arrow faces, when the list fits.
  updateColumnScrollUi(column) {

    const scrollable = column.maxOffset > 0;
    for (const control of [column.track, column.thumb, column.upButton, column.downButton]) {
      control.setVisible(scrollable);
      if (scrollable) control.setInteractive();
      else control.disableInteractive();
    }
    column.upIcon.setVisible(scrollable);
    column.downIcon.setVisible(scrollable);
    if (!scrollable) return;

    const ratio = column.offset / column.maxOffset;
    const minY = column.trackTop + column.thumbHeight / 2;
    const maxY = column.trackTop + column.trackHeight - column.thumbHeight / 2;

    // Linear blends from the first value to the second using the third argument: 0 gives
    // the start, 1 gives the end, and 0.5 gives halfway.
    column.thumb.y = Phaser.Math.Linear(minY, maxY, ratio);
    column.thumb.setScrollbarProgress(ratio, column.trackHeight);
    for (const [button, enabled] of [
      [column.upButton, column.offset > 0],
      [column.downButton, column.offset < column.maxOffset]
    ]) {
      button.setScrollbarEnabled(enabled);
      if (enabled) button.setInteractive();
      else button.disableInteractive();
    }
  }

  // This helper shows selected and unavailable adventurers alongside party readiness.
  refreshSelectionUi() {

    const counts = this.getSelectionCounts();
    this.partyCountText.setText(
      `${counts.total}/${MAX_PARTY_SIZE} Selected · Tanks ${counts.Tank}/${ROLE_LIMITS.Tank} · Healers ${counts.Healer}/${ROLE_LIMITS.Healer} · DPS ${counts.DPS}/${ROLE_LIMITS.DPS}`);
    this.recommendationText.setText(partyCompositionWarning(GameState.roster.filter(hero => this.selectedIds.has(hero.id)))
      || 'Recommended: one Tank, one Healer and three DPS.');

    this.cards.forEach((objects, id) => {
      const away = this.unavailableIds.has(id);
      objects.level.setText(away ? 'IN THE EVERDEEP' : `Lv ${objects.adventurer.level} · ${objects.adventurer.happiness ?? 70}%`);
      objects.level.setColor(away ? '#d9b6ff' : STONE.muted);
      const selected = this.selectedIds.has(id);
      objects.portrait.selectionIdle?.setSelected(selected);
      objects.selection.setVisible(selected);
      objects.check.setVisible(selected);
      const disabled = !selected && !this.canAddToSelection(objects.adventurer);
      objects.status.setText(away ? 'AWAY' : disabled ? (counts.total >= MAX_PARTY_SIZE ? 'FULL' : 'LIMIT') : '')
        .setVisible(!selected && disabled);

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      objects.card.setFillStyle(selected ? 0x3b321d : 0x1f2937).setStrokeStyle(selected ? 4 : 2, selected ? STONE.gold : STONE.edge);

      // ... expands these entries into the new list or call. It does not deep-copy the
      // objects inside.
      [...objects.card.pressVisuals, objects.portrait, objects.name, objects.cls, objects.level, objects.emblem].forEach(object => object.setAlpha(away ? 0.45 : disabled ? 0.72 : 1));
    });

    this.beginButton.setStrokeStyle(3, STONE.gold);
    this.beginButtonText.setColor(STONE.text);
    this.refreshLineup();
  }

  // Rebuild the selected party strip in its current order and connect removal/inspection
  // input.
  refreshLineup() {
    this.lineup.removeAll(true);

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width } = this.scale;

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const heroes = GameState.roster.filter(hero => this.selectedIds.has(hero.id));
    const slotWidth = (width - UI_SAFE_LEFT - UI_SAFE_RIGHT) / 5;
    const y = this.lineupY;
    for (let index = 0; index < MAX_PARTY_SIZE; index++) {
      const x = UI_SAFE_LEFT + slotWidth * (index + 0.5);
      const hero = heroes[index];
      const panel = addStonePanel(this, x, y, slotWidth - 16, this.lineupHeight, 0);
      this.lineup.add(panel);

      if (hero) {

        // find returns the first matching entry, or undefined when none matches. Check for
        // that missing result before using its fields.
        const icon = stoneIcon(this, x - slotWidth / 2 + 58, y, ROLE_COLUMNS.find(role => role.roles.includes(hero.role)).title, 46, 0, this.stoneTheme.accent);
        const name = stoneText(this, x + 25, y - 23, hero.name, UI_FONT_SIZES.body32, 0);

        // ?? uses the fallback only for null or undefined. A real zero or false stays
        // intact.
        const cls = stoneText(this, x + 25, y + 23, hero.shortName ?? hero.className, UI_FONT_SIZES.partyClass, 0, { fontFamily: UI_FONT_FAMILIES.sans, color: STONE.muted });
        [name, cls].forEach(label => { if (label.width > slotWidth - 135) label.setScale((slotWidth - 135) / label.width); });
        const hit = this.add.rectangle(x, y, slotWidth - 16, this.lineupHeight, 0, 0);
        bindSelectionDetails(this, hit, null, () => this.toggleAdventurer(hero.id), () => this.showAdventurerDetails(hero));
        this.lineup.add([icon, name, cls, hit]);
      } else {
        this.lineup.add(stoneText(this, x, y - 22, `SLOT ${index + 1}`, UI_FONT_SIZES.body30, 0, { color: STONE.muted }));
        this.lineup.add(stoneText(this, x, y + 22, 'Choose an adventurer', UI_FONT_SIZES.compact26, 0, { fontFamily: UI_FONT_FAMILIES.sans, color: STONE.muted }));
      }
    }
  }

  // Commit only on Save. Cancel leaves the persisted lineup untouched, even when empty.
  begin() {
    if (GameState.activeBattle) {
      this.showToast('Return to your active battle before changing the party.');
      return;
    }
    this.unavailableIds = everdeepUnavailableIds();
    if ([...this.selectedIds].some(id => this.unavailableIds.has(id))) {
      this.showToast('A selected adventurer is in The Everdeep. Remove them before saving.');
      return;
    }
    HapticsService.confirm();
    GameState.lastPartyIds = [...this.selectedIds];
    GameState.activeParty = GameState.lastPartyIds.map(id => ({ ...GameState.roster.find(hero => hero.id === id) }));
    resolveWorldMapCharacter();
    saveProfile();
    this.scene.start(this.returnScene);
  }

  // Use the shared themed modal for equipment-adjusted stats and class details.
  showAdventurerDetails(adventurer) {
    adventurer = getEquippedAdventurer(adventurer);

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place. The condition before ? chooses the first value when true
    // and the value after : when false. ?? uses the fallback only for null or undefined. A
    // real zero or false stays intact.
    const stats = [
      `Level ${adventurer.level} · ${adventurer.role}`,
      `HP ${adventurer.maxHp} · Attack ${adventurer.attackPower}`,
      (adventurer.spellPower ?? adventurer.healPower) > 0 ? `Spell Power ${adventurer.spellPower ?? adventurer.healPower}` : '',
      adventurer.maxMana > 0 ? `Mana ${adventurer.maxMana}` : '',
      `Move Speed ${adventurer.moveSpeed} · Crit ${Math.round((adventurer.critChance ?? 0) * 100)}%`,
      `Happiness ${adventurer.happiness ?? 70}% (${happinessLabel(adventurer.happiness ?? 70)})`
    ].filter(Boolean).join('\n');

    showSelectionDetails(this, { title: adventurer.name, className: adventurer.className,
      mapCharacterId: adventurer.id,
      mapCharacterParty: GameState.roster.filter(hero => this.selectedIds.has(hero.id)),
      classHeader: adventurer.shortName ?? adventurer.className,
      description: `${adventurer.className}\n\n${stats}\n\n${adventurer.description ?? ''}` });
  }

  // Show themed feedback at a readable size inside the current screen.
  showToast(message) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.toast?.forEach(object => object.destroy());
    const notice = preparationNotice(this, this.scale.width / 2, this.scale.height / 2, message, { depth: 6000, width: 1200, fontSize: UI_FONT_SIZES.body34 });
    this.toast = [notice.panel, notice.text];
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1800, duration: 350, onComplete: () => {
      notice.panel.destroy();
      notice.text.destroy();
    } });
  }
}
