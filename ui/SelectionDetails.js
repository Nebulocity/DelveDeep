import { delveDropNames } from '../game/DelveDrops.js';
import HapticsService from '../services/HapticsService.js';
import { addWoodenPanel, addWoodenNotice } from './WoodenPanel.js';
import { addStonePanel, addStoneButton, addStoneOrnaments, stoneText, STONE } from './CarvedStone.js';
import { preparationNotice } from './DelvePreparation.js';
import { bindButtonPress } from './ButtonPress.js';
import { addRegionPanel, addRegionNotice, regionMessageBounds } from './RegionMapTheme.js';
import { isGuildHall } from './GuildHallTheme.js';
import { showGuildDetails } from './GuildHallDialogs.js';

export const DETAILS_HINT = 'Long-press or hold-click a selection for details.';

export function addDetailsHint(scene, y, text = DETAILS_HINT, options = {}) {
  if (isDelvePreparation(scene)) return preparationNotice(scene, options.x ?? scene.scale.width / 2, y, text, options).text;
  return (scene.scene?.key === 'TitleScene' ? addRegionNotice : addWoodenNotice)(scene, options.x ?? scene.scale.width / 2, y, text,
    { width: 1100, fontSize: 28, ...(scene.scene?.key === 'TitleScene' ? { depth: 1000 } : {}), ...options }).text;
}

function isDelvePreparation(scene) {
  return ['DelveSelectScene', 'PartySelectScene', 'DungeonScene'].includes(scene.scene?.key);
}

function isHallMenu(scene) {
  return ['AdventurersHallScene', 'RosterScene', 'ItemsScene', 'RaidLeaderScene', 'FacilityScene', 'BlacksmithScene']
    .includes(scene.scene?.key);
}

function isTownMenu(scene) {
  return scene.scene?.key === 'TownScene';
}

export function characterDetails(unit) {
  if (unit.isEnemy) {
    const number = value => Number((value ?? 0).toFixed(2));
    const percent = value => `${number((value ?? 0) * 100)}%`;
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
  return {
    title: unit.name,
    description: [
      `${unit.className ?? 'Monster'} | ${unit.role ?? 'Enemy'}${unit.level ? ` | Level ${unit.level}` : ''}`,
      `HP: ${unit.hp ?? unit.maxHp}/${unit.maxHp} | Attack: ${unit.attackPower}`,
      (unit.maxMana ?? 0) > 0 ? `Mana: ${Math.floor(unit.mana ?? unit.maxMana)}/${unit.maxMana}` : '',
      unit.description ?? '',
      Object.values(unit.abilities ?? {}).map((ability) => ability.name).filter(Boolean).join(', ')
    ].filter(Boolean).join('\n\n')
  };
}

export function delveDetails(delve) {
  return { title: delve.name, description: `${delve.subtitle}\n\n${delve.difficulty} | Recommended level ${delve.recommendedLevel} | ${delve.rooms} waves\n\nPossible Drops:\n${delveDropNames(delve).map(name => `• ${name}`).join('\n')}`, image: delve.visuals?.environment?.layers[0]?.key, align: 'left', titleAboveBody: true, panelWidth: 1600 };
}

// Modal details block underlying controls. Combat clocks and decisions pause
// together so reading never costs the party health or consumes a queued cast.
export function showSelectionDetails(scene, details) {
  if (isGuildHall(scene)) return showGuildDetails(scene, details);
  scene.selectionDetailsClose?.();
  const { width, height } = scene.scale;
  const hall = isHallMenu(scene);
  const town = isTownMenu(scene);
  const regionMap = scene.scene?.key === 'TitleScene';
  const messageBounds = regionMessageBounds(scene, regionMap ? details.messageScope : 'ui');
  const centerX = messageBounds.centerX;
  const warm = true;
  const shopTheme = details.shopTheme;
  const shop = Boolean(shopTheme);
  const objects = [];
  const wasPaused = scene.combatPaused;
  const clockPaused = scene.time.paused;
  if (typeof wasPaused === 'boolean') {
    scene.combatPaused = true;
    scene.time.paused = true;
  }
  const close = () => {
    objects.forEach((object) => object.destroy());
    if (typeof wasPaused === 'boolean') {
      scene.combatPaused = wasPaused;
      scene.time.paused = clockPaused;
    }
    scene.selectionDetailsClose = null;
    scene.events.off('shutdown', close);
  };
  scene.selectionDetailsClose = close;
  scene.events.once('shutdown', close);
  const depth = 10000;
  const stone = scene.scene?.key === 'BattleScene' || isDelvePreparation(scene);
  const panelWidth = Math.min(details.panelWidth ?? (details.gear ? 1760 : 1100), messageBounds.width - 120);
  const hasImage = Boolean(details.image && scene.textures.exists(details.image));
  const bodyMargin = 65;
  const imageColumn = hasImage ? 300 : shop ? 220 : 0;
  const bodyWidth = panelWidth - bodyMargin * 2 - imageColumn;
  const bodyCenter = centerX + imageColumn / 2;
  const body = scene.add.text(bodyCenter, 0, details.description, {
    fontFamily: 'Arial', fontSize: '32px', color: stone ? STONE.text : shop ? shopTheme.text : warm ? '#f1dfca' : '#e2e8f0',
    wordWrap: { width: bodyWidth }, fixedWidth: bodyWidth, align: details.align ?? 'center'
  }).setOrigin(0.5, 0).setDepth(depth + 2);
  const panelHeight = Math.min(height - 140, Math.max(hasImage ? 540 : 340, body.height + (details.gear ? 480 : 210)));
  const top = (height - panelHeight) / 2;
  body.setY(top + 94);
  // Keep long descriptions contained while retaining the normal large type.
  const bodyHeight = panelHeight - (details.gear ? 450 : 190);
  if (body.height > bodyHeight) body.setScale(bodyHeight / body.height);
  const shade = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    .setDepth(depth).setInteractive();
  const panel = (stone ? addStonePanel : regionMap ? addRegionPanel : addWoodenPanel)(scene, centerX, height / 2, panelWidth + 36, panelHeight + 36, depth + 1);
  if (stone && scene.stoneTheme) objects.push(addStoneOrnaments(scene, centerX, top + 42, panelWidth, scene.stoneTheme, depth + 2));
  const conceptHeight = Math.min(368, panelHeight - 180);
  const shopSign = shop && scene.textures.exists(shopTheme.plaque)
    ? scene.add.image(centerX - panelWidth / 2 + 120, top + Math.min(190, panelHeight / 2), shopTheme.plaque)
      .setDisplaySize(shopTheme.square ? 145 : 180, shopTheme.square ? 145 : 120).setDepth(depth + 2)
    : null;
  const conceptImage = hasImage
    ? scene.add.image(centerX - panelWidth / 2 + 155, height / 2, details.image)
      .setDepth(depth + 2)
    : null;
  if (conceptImage) conceptImage.setScale(Math.min(270 / conceptImage.width, conceptHeight / conceptImage.height));
  const panelHit = town
    ? scene.add.rectangle(centerX, height / 2, panelWidth, panelHeight, 0x000000, 0)
      .setDepth(depth + 1).setInteractive()
    : panel.setInteractive();
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
      objects.push(stoneText(scene, x, y - 72, item.slot.toUpperCase(), 26, depth + 3, { color: STONE.muted }));
      objects.push(stoneText(scene, x, y - 12, item.name, 30, depth + 3, { wordWrap: { width: cardWidth - 40 } }));
      objects.push(stoneText(scene, x, y + 65, item.summary, 26, depth + 3, { fontFamily: 'Arial', wordWrap: { width: cardWidth - 40 } }));
    });
  }
  const buttonY = top + panelHeight - 52;
  const button = (stone ? addStoneButton : regionMap ? addRegionPanel : addWoodenPanel)(scene, centerX, buttonY, 300, 72, depth + 3).setInteractive({ useHandCursor: true });
  if (stone) {
    const label = stoneText(scene, centerX, buttonY, 'CLOSE', 32, depth + 4);
    objects.push(label);
    bindButtonPress(scene, button, [label], () => { HapticsService.tap(); close(); });
  } else button.on('pointerdown', dismiss);
  objects.push(shade, panel, body, button);
  if (conceptImage) objects.push(conceptImage);
  if (town) objects.push(panelHit);
  if (shopSign) objects.push(shopSign);
  objects.push(
    scene.add.text(details.titleAboveBody ? bodyCenter : centerX, top + 44, details.title, {
      fontFamily: town || stone ? 'Georgia' : 'Arial', fontSize: '36px', fontStyle: 'bold',
      wordWrap: { width: details.titleAboveBody ? bodyWidth : panelWidth - 170 }, align: 'center',
      color: warm || shop ? (shop ? shopTheme.text : '#fff1d2') : '#bef264', stroke: town || shop ? '#24170f' : undefined,
      strokeThickness: town || shop ? 3 : 0
    }).setOrigin(0.5).setDepth(depth + 2),
    scene.add.text(centerX, button.y, stone ? '' : 'CLOSE', {
      fontFamily: town || shop ? 'Georgia' : 'Arial', fontSize: '32px', color: warm || shop ? (shop ? shopTheme.text : '#fff1d2') : '#ffffff',
      stroke: town || shop ? '#24170f' : undefined, strokeThickness: town || shop ? 2 : 0
    }).setOrigin(0.5).setDepth(depth + 4));
}

// Bind after a selection's normal pointerdown action. Defer that action until
// release, and suppress it after a hold or drag. Navigation-only buttons need
// no binding. Each binding cleans up with its object, including wave enemies.
export function bindSelectionDetails(scene, target, getDetails, onTap, onDetails, { allowSceneInput = false } = {}) {
  const taps = onTap ? [onTap] : target.listeners('pointerdown').slice();
  target.removeAllListeners('pointerdown');
  target.setInteractive({ useHandCursor: true });
  let press = null;
  let timer = null;
  const cancel = () => {
    if (timer !== null) globalThis.clearTimeout(timer);
    timer = null;
    press = null;
  };
  target.on('pointerdown', (pointer, x, y, event) => {
    if (!allowSceneInput) event?.stopPropagation?.();
    cancel();
    press = { id: pointer.id, x: pointer.x, y: pointer.y, held: false };
    timer = globalThis.setTimeout(() => {
      timer = null;
      if (!press || !pointer.isDown || scene.selectionDetailsClose) return;
      if (Math.hypot(pointer.x - press.x, pointer.y - press.y) > 24) return cancel();
      press.held = true;
      HapticsService.tap();
      if (onDetails) onDetails();
  else showSelectionDetails(scene, typeof getDetails === 'function' ? getDetails() : getDetails);
    }, 550);
  });
  const move = (pointer) => {
    if (press?.id === pointer.id && Math.hypot(pointer.x - press.x, pointer.y - press.y) > 24) cancel();
  };
  target.on('pointerup', (...args) => {
    const pointer = args[0];
    if (!allowSceneInput) args[3]?.stopPropagation?.();
    const tap = press?.id === pointer.id && !press.held;
    cancel();
    if (tap && !scene.selectionDetailsClose) taps.forEach((callback) => callback.apply(target, args));
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
  target.once('destroy', cleanup);
  scene.events.once('shutdown', cleanup);
}
