// Holding an inspectable object opens its details; a short valid release performs the
// ordinary action. We track the pointer and cancellation paths so dragging or closing an
// overlay cannot accidentally trigger the original selection underneath it.

import { delveDropNames } from '../game/DelveDrops.js';
import HapticsService from '../services/HapticsService.js';
import { addWoodenPanel, addWoodenNotice } from './WoodenPanel.js';
import { addStonePanel, addStoneButton, addStoneOrnaments, stoneText, STONE } from './CarvedStone.js';
import { preparationNotice } from './DelvePreparation.js';
import { bindButtonPress } from './ButtonPress.js';
import { addRegionPanel, addRegionNotice, regionMessageBounds } from './RegionMapTheme.js';

import { isGuildHall } from './GuildHallTheme.js';
import { showGuildDetails } from './GuildHallDialogs.js';
import { showShopDetails } from './ShopDetails.js';
import { UI_FONT_SIZES, fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { abilitySummary } from '../game/AbilityDescriptions.js';
import { hallScroll } from './HallUI.js';

export const DETAILS_HINT = 'Long-press or hold-click a selection for details.';

// Place the shared instruction for objects that support held inspection. scene is the
// Phaser screen that owns the objects, clock and input used here.
export function addDetailsHint(scene, y, text = DETAILS_HINT, options = {}) {
  if (isDelvePreparation(scene)) return preparationNotice(scene, options.x ?? scene.scale.width / 2, y, text, options).text;

  // The condition before ? chooses the first value when true and the value after : when
  // false. ?. only follows this link when the value exists; a missing optional value gives
  // undefined. ?? uses the fallback only for null or undefined. A real zero or false stays
  // intact.
  return (scene.scene?.key === 'TitleScene' ? addRegionNotice : addWoodenNotice)(scene, options.x ?? scene.scale.width / 2, y, text,
    { width: 1100, fontSize: UI_FONT_SIZES.support28, ...(scene.scene?.key === 'TitleScene' ? { depth: 1000 } : {}), ...options }).text;
}

// Choose stone held-details styling for the supported Delve preparation screens.
function isDelvePreparation(scene) {

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  return ['DelveSelectScene', 'PartySelectScene', 'DungeonScene'].includes(scene.scene?.key);
}

// Choose Hall materials and dialogs for the supported roster and inventory screens.
function isHallMenu(scene) {

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  return ['AdventurersHallScene', 'RosterScene', 'ItemsScene', 'RaidLeaderScene', 'FacilityScene', 'BlacksmithScene']
    .includes(scene.scene?.key);
}

// Choose wooden held-details styling for the supported town context.
function isTownMenu(scene) {

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  return scene.scene?.key === 'TownScene';
}

// Build the inspected character's current resources and equipped-skill details.
// unit is the live combatant, with current resources and arena position.
export function characterDetails(unit) {
  if (unit.isEnemy) {
    const number = value => Number((value ?? 0).toFixed(2));
    const percent = value => `${number((value ?? 0) * 100)}%`;

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place. ?? uses the fallback only for null or undefined. A real
    // zero or false stays intact. map builds one output entry for each input entry, in the
    // same order. The callback's return value becomes that output entry.
    return {
      title: unit.name,
      panelWidth: 1500,
      align: 'left',
      description: [
        `Level: ${unit.level} | Health: ${number(unit.hp)}/${number(unit.maxHp)} | Mana: ${number(unit.mana)}/${number(unit.maxMana)}`,
        `Armor: ${number(unit.armor)} | Dodge: ${percent(unit.dodge)} | Block: ${percent(unit.block)} | Speed: ${number(unit.speed)}`,
        `Strength: ${number(unit.strength)} | Agility: ${number(unit.agility)} | Constitution: ${number(unit.constitution)}`,
        `Intellect: ${number(unit.intellect)} | Wisdom: ${number(unit.wisdom)}`,
        `Hit Chance: +${percent(unit.hitChance)} | Crit Chance: ${percent(unit.critChance)} | Crit Multiplier: ${number(unit.critMultiplier)}x`,
        `Attack Power: ${number(unit.attackPower)} | Spell Damage: ${number(unit.spellDamage)} | Spell Healing: ${number(unit.spellHealing)}`,
        `Happiness: ${number(unit.happiness)}% | Delves Cleared: ${unit.delvesCompleted ?? 0}`,
        unit.description,
        Object.values(unit.abilities ?? {}).map(ability => ability.name).filter(Boolean).join(', ')
      ].filter(Boolean).join('\n\n')
    };
  }

  // The condition before ? chooses the first value when true and the value after : when
  // false. Math.floor rounds toward the smaller whole number, so 3.8 becomes 3.
  // Object.entries turns own fields into [key, value] pairs so we can visit or transform
  // them.

  // BattleUnit already contains only equipped, ranked skills. Keep this header short;
  // calculated damage and healing appear beside each skill instead of a separate stat list.
  return {
    title: unit.name,
    align: 'left',
    description: [
      `${unit.className ?? 'Monster'} | ${unit.role ?? 'Enemy'}${unit.level ? ` | Level ${unit.level}` : ''}\nHP: ${Math.floor(unit.hp ?? unit.maxHp)}/${unit.maxHp}${(unit.maxMana ?? 0) > 0 ? ` | Mana: ${Math.floor(unit.mana ?? unit.maxMana)}/${unit.maxMana}` : ''}`,
      Object.entries(unit.abilities ?? {}).filter(([key]) => !unit.abilityRanks || unit.abilityRanks[key] > 0)
        .map(([, ability]) => abilitySummary(unit, ability)).join('\n\n') || 'No skills equipped.'
    ].filter(Boolean).join('\n\n')
  };
}

// Build the selected Delve's actual difficulty, rewards, materials and entry information.
export function delveDetails(delve) {

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry. ?. only follows this link when the value
  // exists; a missing optional value gives undefined.
  return {
    title: delve.name,
    description: `${delve.subtitle}\n\n${delve.difficulty} | Recommended level ${delve.recommendedLevel} | ${delve.rooms} waves\n\nPossible Drops:\n${delveDropNames(delve).map(name => `• ${name}`).join('\n')}`,
    image: delve.visuals?.environment?.layers[0]?.key,
    align: 'left',
    titleAboveBody: true,
    panelWidth: 1600
  };
}

// Modal details block underlying controls while gameplay and timers continue.
export function showSelectionDetails(scene, details) {
  if (isGuildHall(scene)) return showGuildDetails(scene, details);
  if (details.shopTheme) return showShopDetails(scene, details);

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  scene.selectionDetailsClose?.();

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { width, height } = scene.scale;
  const hall = isHallMenu(scene);
  const town = isTownMenu(scene);
  const regionMap = scene.scene?.key === 'TitleScene';

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const messageBounds = regionMessageBounds(scene, regionMap ? details.messageScope : 'ui');
  const centerX = messageBounds.centerX;
  const warm = true;
  const objects = [];
  const close = () => {
    objects.forEach((object) => object.destroy());
    scene.selectionDetailsClose = null;
    scene.events.off('shutdown', close);
  };

  scene.selectionDetailsClose = close;

  // once registers a callback that removes itself after the first matching event.
  scene.events.once('shutdown', close);

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  const depth = details.depth ?? 10000;
  const stone = scene.scene?.key === 'BattleScene' || isDelvePreparation(scene);

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound.
  const panelWidth = Math.min(details.panelWidth ?? (details.gear ? 1760 : 1100), messageBounds.width - 120);
  const hasImage = Boolean(details.image && scene.textures.exists(details.image));
  const bodyMargin = 65;
  const imageColumn = hasImage ? 300 : 0;
  const bodyWidth = panelWidth - bodyMargin * 2 - imageColumn;
  const bodyCenter = centerX + imageColumn / 2;

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects. Origin is the anchor within the object: 0 is the left/top edge,
  // 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
  // necessarily the object's corner.
  const body = scene.add.text(bodyCenter, 0, details.description, {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: `${UI_FONT_SIZES.detailBody}px`, color: stone ? STONE.text : warm ? '#f1dfca' : '#e2e8f0',
    wordWrap: { width: bodyWidth }, fixedWidth: bodyWidth, align: details.align ?? 'center'
  }).setOrigin(0.5, 0).setDepth(depth + 2);
  const panelHeight = Math.min(height - 140, Math.max(hasImage ? 540 : 340, body.height + (details.gear ? 480 : 210)));
  const top = (height - panelHeight) / 2;
  body.setY(top + 94);

  // Scroll long descriptions without shrinking the reading size.
  const bodyHeight = panelHeight - (details.gear ? 450 : 190);

  // This gives the display object an input hit area. Visible artwork alone does not make
  // an object respond to a tap.
  const shade = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    .setDepth(depth).setInteractive();
  const panel = (stone ? addStonePanel : regionMap ? addRegionPanel : addWoodenPanel)(scene, centerX, height / 2, panelWidth + 36, panelHeight + 36, depth + 1);

  if (stone && scene.stoneTheme) objects.push(addStoneOrnaments(scene, centerX, top + 42, panelWidth, scene.stoneTheme, depth + 2));
  const conceptHeight = Math.min(368, panelHeight - 180);
  const conceptImage = hasImage
    ? scene.add.image(centerX - panelWidth / 2 + 155, height / 2, details.image)
      .setDepth(depth + 2)
    : null;

  if (conceptImage) conceptImage.setScale(Math.min(270 / conceptImage.width, conceptHeight / conceptImage.height));
  const panelHit = town
    ? scene.add.rectangle(centerX, height / 2, panelWidth, panelHeight, 0x000000, 0)
      .setDepth(depth + 1).setInteractive()
    : panel.setInteractive();

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  panelHit.on('pointerdown', (pointer, x, y, event) => event.stopPropagation());
  const dismiss = (pointer, x, y, event) => {
    event.stopPropagation();
    HapticsService.tap();
    close();
  };
  shade.on('pointerdown', dismiss);

  if (details.gear) {
    const cardWidth = (panelWidth - 130 - 48) / 4;
    details.gear.forEach((item, index) => {
      const x = centerX - panelWidth / 2 + 65 + cardWidth / 2 + index * (cardWidth + 16);
      const y = top + panelHeight - 235;
      objects.push(addStonePanel(scene, x, y, cardWidth, 220, depth + 2));
      objects.push(stoneText(scene, x, y - 72, item.slot.toUpperCase(), UI_FONT_SIZES.compact26, depth + 3, { color: STONE.muted }));
      objects.push(stoneText(scene, x, y - 12, item.name, UI_FONT_SIZES.body30, depth + 3, { wordWrap: { width: cardWidth - 40 } }));
      objects.push(stoneText(scene, x, y + 65, item.summary, UI_FONT_SIZES.compact26, depth + 3, { fontFamily: UI_FONT_FAMILIES.sans, wordWrap: { width: cardWidth - 40 } }));
    });
  }

  const buttonY = top + panelHeight - 52;
  const button = (stone ? addStoneButton : regionMap ? addRegionPanel : addWoodenPanel)(scene, centerX, buttonY, 300, 72, depth + 3).setInteractive({ useHandCursor: true });
  if (stone) {
    const label = stoneText(scene, centerX, buttonY, 'CLOSE', UI_FONT_SIZES.body32, depth + 4);
    objects.push(label);
    bindButtonPress(scene, button, [label], () => {
      HapticsService.tap();
      close();
    });
  } else button.on('pointerdown', dismiss);

  objects.push(shade, panel, body, button);
  if (body.height > bodyHeight) {
    const scroll = hallScroll(scene, { x: body.x - bodyWidth / 2, y: body.y, width: bodyWidth, height: bodyHeight },
      [body], body.height, 0, () => {},
      (owner, x, y, w, h) => (stone ? addStonePanel : addWoodenPanel)(owner, x, y, w, h, depth + 2),
      () => false);
    scroll.container.setDepth(depth + 2);
    objects.push(scroll.container);
  }

  if (conceptImage) objects.push(conceptImage);
  if (town) objects.push(panelHit);
  objects.push(
    scene.add.text(details.titleAboveBody ? bodyCenter : centerX, top + 44, details.title, {
      fontFamily: town || stone ? UI_FONT_FAMILIES.serif : UI_FONT_FAMILIES.sans, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold,
      wordWrap: { width: details.titleAboveBody ? bodyWidth : panelWidth - 170 }, align: 'center',
      color: warm ? '#fff1d2' : '#bef264', stroke: town ? '#24170f' : undefined,
      strokeThickness: town ? 3 : 0
    }).setOrigin(0.5).setDepth(depth + 2),
    scene.add.text(centerX, button.y, stone ? '' : 'CLOSE', {
      fontFamily: town ? UI_FONT_FAMILIES.serif : UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'), color: warm ? '#fff1d2' : '#ffffff',
      stroke: town ? '#24170f' : undefined, strokeThickness: town ? 2 : 0
    }).setOrigin(0.5).setDepth(depth + 4));
}

// Bind after a selection's normal pointerdown action. Defer that action until release, and
// suppress it after a hold or drag. Navigation-only buttons need no binding. Each binding
// cleans up with its object, including wave enemies.
export function bindSelectionDetails(scene, target, getDetails, onTap, onDetails,
  { allowSceneInput = false, allowWhileModal = false } = {}) {

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const taps = onTap ? [onTap] : target.listeners('pointerdown').slice();
  target.removeAllListeners('pointerdown');

  // This gives the display object an input hit area. Visible artwork alone does not make
  // an object respond to a tap.
  target.setInteractive({ useHandCursor: true });
  let press = null;
  let timer = null;
  const cancel = () => {
    if (timer !== null) globalThis.clearTimeout(timer);
    timer = null;
    press = null;
  };

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  target.on('pointerdown', (pointer, x, y, event) => {
    if (!allowSceneInput) event?.stopPropagation?.();
    cancel();
    press = { id: pointer.id, x: pointer.x, y: pointer.y, held: false };
    timer = globalThis.setTimeout(() => {
      timer = null;
      if (!press || !pointer.isDown || (scene.selectionDetailsClose && !allowWhileModal)) return;

      // Math.hypot calculates straight-line length from the x/y differences: square each,
      // add them, then take the square root.
      if (Math.hypot(pointer.x - press.x, pointer.y - press.y) > 24) return cancel();
      press.held = true;
      HapticsService.tap();

      if (onDetails) onDetails();
  else showSelectionDetails(scene, typeof getDetails === 'function' ? getDetails() : getDetails);
    }, 550);
  });

  const move = (pointer) => {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. Math.hypot calculates straight-line length from the x/y differences:
    // square each, add them, then take the square root.
    if (press?.id === pointer.id && Math.hypot(pointer.x - press.x, pointer.y - press.y) > 24) cancel();
  };

  target.on('pointerup', (...args) => {
    const pointer = args[0];
    if (!allowSceneInput) args[3]?.stopPropagation?.();

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const tap = press?.id === pointer.id && !press.held;
    cancel();
    if (tap && (!scene.selectionDetailsClose || allowWhileModal)) taps.forEach((callback) => callback.apply(target, args));
  });

  target.on('pointerout', cancel);
  scene.input.on('pointermove', move);
  scene.input.on('pointerup', cancel);
  scene.input.on('gameout', cancel);
  const cleanup = () => {
    cancel();
    scene.input.off('pointermove', move);
    scene.input.off('pointerup', cancel);
    scene.input.off('gameout', cancel);
    scene.events.off('shutdown', cleanup);
  };

  // once registers a callback that removes itself after the first matching event.
  target.once('destroy', cleanup);
  scene.events.once('shutdown', cleanup);
}
