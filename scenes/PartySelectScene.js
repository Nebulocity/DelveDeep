// The role lists hold selectable adventurers; the lineup holds the chosen party. The list
// mask limits both visible rows and valid touches. Remembering IDs keeps selection stable
// across sorting, scrolling and returning to this screen.

import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
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
  init() {

    this.selectedIds = this.buildInitialSelection();
  }

  // Load the shared battle surfaces and existing character portraits.
  preload() {
    preloadCarvedStone(this);
    for (const definition of Object.values(CHARACTER_SPRITES)) {
      const frame = definition.clips.idle.south.frames[0];

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const texture = definition.textures.find(entry => entry.key === frame.key);
      if (texture && !this.textures.exists(texture.key)) this.load.spritesheet(texture.key, texture.url, { frameWidth: 256, frameHeight: 256 });
    }
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
    preparationFrame(this, GameState.currentDelve, 'PARTY SELECT', 'DELVE OVERVIEW', () => this.scene.start('DelveSelectScene'));
    this.partyCountText = stoneText(this, width / 2, 171, '', UI_FONT_SIZES.partyCount, 3, { fontFamily: UI_FONT_FAMILIES.sans, color: STONE.muted });
    const columnWidth = (width - 130) / 4;

    const gap = 18;
    const startX = 38 + columnWidth / 2;
    ROLE_COLUMNS.forEach((definition, index) => {
      this.createRoleColumn(definition, startX + index * (columnWidth + gap), 258, columnWidth, 458);
    });

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    this.lineup = this.add.container(0, 0).setDepth(5);
    const action = preparationButton(this, width - 360, height - 74, 630, 104, 'BATTLE OVERVIEW', () => this.begin(), { primary: true, size: UI_FONT_SIZES.body36 });
    this.beginButton = action.button;
    this.beginButtonText = action.text;
    addDetailsHint(this, height - 73, 'Tap to select. Hold an adventurer for stats. Drag lists to browse.', { x: width * 0.34, width: 1500, fontSize: UI_FONT_SIZES.partyHint });

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

      const minY = column.trackTop + column.thumbHeight / 2;
      const maxY = column.trackTop + column.trackHeight - column.thumbHeight / 2;

      // Clamp keeps the first argument between the lower bound (second argument) and upper
      // bound (third argument).
      const clampedY = Phaser.Math.Clamp(dragY, minY, maxY);
      const usableHeight = Math.max(1, column.trackHeight - column.thumbHeight);
      const ratio = (clampedY - minY) / usableHeight;
      this.setColumnOffset(column, ratio * column.maxOffset, false);
    });

    this.refreshSelectionUi();
  }

  // This helper restores a valid previous party while leaving first-time selection empty.
  buildInitialSelection() {

    // A Set keeps each value once. has checks membership without searching a list for
    // duplicate entries.
    const initialIds = new Set();

    // Prefer the active party, falling back to saved IDs. An empty history leaves the
    // initial selection empty.
    const preferredIds = GameState.activeParty.length > 0
      ? GameState.activeParty.map((adventurer) => adventurer.id)
      : (GameState.lastPartyIds ?? []);

    preferredIds.forEach((id) => {

      if (initialIds.size >= MAX_PARTY_SIZE) return;

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const adventurer = GameState.roster.find((entry) => entry.id === id);
      if (adventurer && this.canAddToSelection(adventurer, initialIds)) initialIds.add(id);
    });

    return initialIds;
  }

  // This helper builds one role column, including its adventurer cards, clipped viewing
  // area, and scrolling controls. The saved column state lets dragging, arrow buttons, and
  // track taps share the same scrolling logic.
  createRoleColumn(definition, x, top, width, height) {
    addStonePanel(this, x, top + height / 2 - 24, width, height + 76, 0);
    stoneIcon(this, x - width / 2 + 54, top - 28, definition.title, 40, 2, this.stoneTheme.accent);

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const roster = GameState.roster.filter(adventurer => definition.roles.includes(adventurer.role));
    stoneText(this, x + 10, top - 28, `${definition.title} · ${roster.length}`, UI_FONT_SIZES.body34, 2);
    const itemHeight = 140;
    const scrollTop = top + 16;
    const scrollHeight = height - 36;

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const content = this.add.container(0, 0).setDepth(3);
    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff).fillRect(x - width / 2 + 16, scrollTop, width - 82, scrollHeight);

    // The mask limits which pixels are drawn. It does not automatically limit the touch
    // hit area; input bounds need their own check. A geometry mask uses a Graphics shape
    // to decide which pixels remain visible. The mask shape can be hidden while still
    // clipping its target.
    content.setMask(maskShape.createGeometryMask());

    // once registers a callback that removes itself after the first matching event.
    this.events.once('shutdown', () => maskShape.destroy());
    const contentCenterX = x - 25;
    const cardWidth = width - 94;
    roster.forEach((adventurer, index) => {
      const cardY = scrollTop + 64 + index * itemHeight;
      const card = addStoneButton(this, contentCenterX, cardY, cardWidth, 126, 0);

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      const frame = CHARACTER_SPRITES[adventurer.id]?.clips.idle.south.frames[0];
      const portraitX = contentCenterX - cardWidth / 2 + 62;

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const portrait = frame && this.textures.exists(frame.key)
        ? this.add.image(portraitX, cardY, frame.key, frame.frame).setDisplaySize(116, 116).setFlipX(frame.flipX === true)
        : stoneIcon(this, portraitX, cardY, definition.title, 56, 0, adventurer.color);
      const textX = contentCenterX - cardWidth / 2 + 120;
      const textWidth = cardWidth - 135;

      // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
      // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the
      // object's corner.
      const name = stoneText(this, textX, cardY - 37, adventurer.name, UI_FONT_SIZES.body32, 0).setOrigin(0, 0.5);

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      const cls = stoneText(this, textX, cardY + 2, adventurer.shortName ?? adventurer.className, UI_FONT_SIZES.partyClass, 0, { fontFamily: UI_FONT_FAMILIES.sans, fontStyle: UI_FONT_WEIGHTS.normal, color: STONE.muted }).setOrigin(0, 0.5);
      const level = stoneText(this, textX, cardY + 37, `Lv ${adventurer.level} · ${adventurer.happiness ?? 70}%`, UI_FONT_SIZES.partyLevel, 0, { fontFamily: UI_FONT_FAMILIES.sans, fontStyle: UI_FONT_WEIGHTS.normal, color: STONE.muted }).setOrigin(0, 0.5);
      [name, cls].forEach(label => { if (label.width > textWidth) label.setScale(textWidth / label.width); });

      // ... expands these entries into the new list or call. It does not deep-copy the
      // objects inside.
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

    if (!roster.length) content.add(stoneText(this, x, scrollTop + scrollHeight / 2, 'No adventurers yet', UI_FONT_SIZES.support28, 0));
    const trackX = x + width / 2 - 36;
    const trackTop = scrollTop + 62;
    const trackHeight = scrollHeight - 124;
    const up = preparationButton(this, trackX, scrollTop + 27, 54, 54, '^', () => this.scrollColumn(column, -1), { size: UI_FONT_SIZES.compact24, depth: 3 });
    const down = preparationButton(this, trackX, scrollTop + scrollHeight - 27, 54, 54, 'v', () => this.scrollColumn(column, 1), { size: UI_FONT_SIZES.compact24, depth: 3 });

    // This gives the display object an input hit area. Visible artwork alone does not make
    // an object respond to a tap.
    const track = this.add.rectangle(trackX, trackTop + trackHeight / 2, 44, trackHeight, 0x111925).setStrokeStyle(2, STONE.edge).setDepth(3).setInteractive();

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const contentHeight = roster.length ? 128 + (roster.length - 1) * itemHeight : scrollHeight;

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
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

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    track.on('pointerdown', pointer => this.setColumnOffsetFromPointer(column, pointer.y));
    if (maxOffset === 0) [track, thumb, up.button, down.button].forEach(control => control.disableInteractive());
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

    const counts = { Tank: 0, Healer: 0, DPS: 0, total: 0 };
    GameState.roster.forEach((adventurer) => {

      if (!selectedIds.has(adventurer.id)) return;
      const group = this.getRoleGroup(adventurer.role);
      counts[group] += 1;
      counts.total += 1;
    });

    return counts;
  }

  // This helper combines melee and ranged damage dealers under the shared DPS limit.
  getRoleGroup(role) {

    if (role === 'Tank') return 'Tank';
    if (role === 'Healer') return 'Healer';
    return 'DPS';
  }

  // This helper enforces both party size and role limits before adding an adventurer.
  canAddToSelection(adventurer, selectedIds = this.selectedIds) {

    const counts = this.getSelectionCounts(selectedIds);
    const roleGroup = this.getRoleGroup(adventurer.role);
    if (counts.total >= MAX_PARTY_SIZE) return false;

    return counts[roleGroup] < ROLE_LIMITS[roleGroup];
  }

  // This helper explains which party limit prevents this selection.
  getSelectionBlockReason(adventurer) {

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
      this.tweens.add({ targets: column.container, y: -column.offset, duration: 140, ease: 'Quad.Out' });
    } else {
      column.container.y = -column.offset;
    }
    this.updateColumnScrollUi(column);
  }

  // This helper translates a scrollbar tap into a position in the roster list.
  setColumnOffsetFromPointer(column, pointerY) {

    const minY = column.trackTop + column.thumbHeight / 2;
    const maxY = column.trackTop + column.trackHeight - column.thumbHeight / 2;

    // Clamp keeps the first argument between the lower bound (second argument) and upper
    // bound (third argument).
    const clampedY = Phaser.Math.Clamp(pointerY, minY, maxY);
    const usableHeight = Math.max(1, column.trackHeight - column.thumbHeight);
    const ratio = (clampedY - minY) / usableHeight;
    this.setColumnOffset(column, ratio * column.maxOffset, false);
  }

  // This helper shows the list position and dims scrolling controls when unnecessary.
  updateColumnScrollUi(column) {

    const scrollable = column.maxOffset > 0;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
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

    // Linear blends from the first value to the second using the third argument: 0 gives
    // the start, 1 gives the end, and 0.5 gives halfway.
    column.thumb.y = Phaser.Math.Linear(minY, maxY, ratio);
  }

  // This helper shows selected and unavailable adventurers alongside party readiness.
  refreshSelectionUi() {

    const counts = this.getSelectionCounts();
    this.partyCountText.setText(
      `${counts.total} / ${MAX_PARTY_SIZE} selected  |  Tanks ${counts.Tank}/${ROLE_LIMITS.Tank}  |  Healers ${counts.Healer}/${ROLE_LIMITS.Healer}  |  DPS ${counts.DPS}/${ROLE_LIMITS.DPS}`
    );

    this.cards.forEach((objects, id) => {
      const selected = this.selectedIds.has(id);
      const disabled = !selected && !this.canAddToSelection(objects.adventurer);

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      objects.card.setFillStyle(selected ? 0x3b321d : 0x1f2937).setStrokeStyle(selected ? 4 : 2, selected ? STONE.gold : STONE.edge);

      // ... expands these entries into the new list or call. It does not deep-copy the
      // objects inside.
      [...objects.card.pressVisuals, objects.portrait, objects.name, objects.cls, objects.level].forEach(object => object.setAlpha(disabled ? 0.45 : 1));
    });

    const ready = counts.total === MAX_PARTY_SIZE;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.beginButton.setStrokeStyle(ready ? 3 : 2, ready ? STONE.gold : STONE.edge);
    this.beginButtonText.setColor(ready ? STONE.text : STONE.muted);
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
    const slotWidth = (width - 100) / 5;
    for (let index = 0; index < MAX_PARTY_SIZE; index++) {
      const x = 50 + slotWidth * (index + 0.5);
      const hero = heroes[index];
      const panel = addStonePanel(this, x, 839, slotWidth - 16, 150, 0);
      this.lineup.add(panel);

      if (hero) {

        // find returns the first matching entry, or undefined when none matches. Check for
        // that missing result before using its fields.
        const icon = stoneIcon(this, x - slotWidth / 2 + 58, 838, ROLE_COLUMNS.find(role => role.roles.includes(hero.role)).title, 46, 0, this.stoneTheme.accent);
        const name = stoneText(this, x + 25, 813, hero.name, UI_FONT_SIZES.body32, 0);

        // ?? uses the fallback only for null or undefined. A real zero or false stays
        // intact.
        const cls = stoneText(this, x + 25, 859, hero.shortName ?? hero.className, UI_FONT_SIZES.partyClass, 0, { fontFamily: UI_FONT_FAMILIES.sans, color: STONE.muted });
        [name, cls].forEach(label => { if (label.width > slotWidth - 135) label.setScale((slotWidth - 135) / label.width); });
        const hit = this.add.rectangle(x, 839, slotWidth - 16, 150, 0, 0);
        bindSelectionDetails(this, hit, null, () => this.toggleAdventurer(hero.id), () => this.showAdventurerDetails(hero));
        this.lineup.add([icon, name, cls, hit]);
      } else {
        this.lineup.add(stoneText(this, x, 816, `SLOT ${index + 1}`, UI_FONT_SIZES.body30, 0, { color: STONE.muted }));
        this.lineup.add(stoneText(this, x, 861, 'Choose an adventurer', UI_FONT_SIZES.compact26, 0, { fontFamily: UI_FONT_FAMILIES.sans, color: STONE.muted }));
      }
    }
  }

  // This helper saves a complete party and advances to the battle overview.
  begin() {

    if (this.selectedIds.size !== MAX_PARTY_SIZE) {
      this.showToast('Choose five adventurers before continuing.');
      return;
    }

    HapticsService.confirm();

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry. filter keeps entries whose callback returns
    // true. It builds a new list and leaves the original list in place.
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

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place. The condition before ? chooses the first value when true
    // and the value after : when false. ?? uses the fallback only for null or undefined. A
    // real zero or false stays intact.
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
