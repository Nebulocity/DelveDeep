import HapticsService from '../services/HapticsService.js';
import { addWoodenPanel, addWoodenNotice } from './WoodenPanel.js';
import { addStonePanel, addStoneButton, stoneText } from './CarvedStone.js';
import { bindButtonPress } from './ButtonPress.js';

export const DETAILS_HINT = 'Long-press or hold-click a selection for details.';

export function addDetailsHint(scene, y, text = DETAILS_HINT, options = {}) {
  return addWoodenNotice(scene, options.x ?? scene.scale.width / 2, y, text,
    { width: 1100, fontSize: 28, ...options }).text;
}

function isHallMenu(scene) {
  return ['AdventurersHallScene', 'RosterScene', 'ItemsScene', 'RaidLeaderScene', 'FacilityScene', 'BlacksmithScene']
    .includes(scene.scene?.key);
}

function isTownMenu(scene) {
  return scene.scene?.key === 'TownScene';
}

export function characterDetails(unit) {
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
  return { title: delve.name, description: `${delve.subtitle}\n\n${delve.difficulty} | Recommended level ${delve.recommendedLevel} | ${delve.rooms} waves\n\nRewards: ${(delve.possibleDrops ?? []).join(', ')}`, image: delve.visuals?.environment?.layers[0]?.key };
}

// Modal details block underlying controls. Combat clocks and decisions pause
// together so reading never costs the party health or consumes a queued cast.
export function showSelectionDetails(scene, details) {
  scene.selectionDetailsClose?.();
  const { width, height } = scene.scale;
  const hall = isHallMenu(scene);
  const town = isTownMenu(scene);
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
  const stone = scene.scene?.key === 'BattleScene';
  const panelWidth = Math.min(details.panelWidth ?? 1100, width - 120);
  const hasImage = Boolean(details.image && scene.textures.exists(details.image));
  const bodyMargin = 65;
  const imageColumn = hasImage ? 300 : shop ? 220 : 0;
  const body = scene.add.text(width / 2 - panelWidth / 2 + bodyMargin + imageColumn, 0, details.description, {
    fontFamily: 'Arial', fontSize: '32px', color: shop ? shopTheme.text : warm ? '#f1dfca' : '#e2e8f0',
    wordWrap: { width: panelWidth - bodyMargin * 2 - imageColumn }
  }).setDepth(depth + 2);
  const panelHeight = Math.min(height - 140, Math.max(hasImage ? 540 : 340, body.height + 210));
  const top = (height - panelHeight) / 2;
  body.setY(top + 94);
  // Keep long descriptions contained while retaining the normal large type.
  if (body.height > panelHeight - 190) body.setScale((panelHeight - 190) / body.height);
  const shade = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    .setDepth(depth).setInteractive();
  const panel = (stone ? addStonePanel : addWoodenPanel)(scene, width / 2, height / 2, panelWidth + 36, panelHeight + 36, depth + 1);
  const conceptHeight = Math.min(368, panelHeight - 180);
  const shopSign = shop && scene.textures.exists(shopTheme.plaque)
    ? scene.add.image(width / 2 - panelWidth / 2 + 120, top + Math.min(190, panelHeight / 2), shopTheme.plaque)
      .setDisplaySize(shopTheme.square ? 145 : 180, shopTheme.square ? 145 : 120).setDepth(depth + 2)
    : null;
  const conceptImage = hasImage
    ? scene.add.image(width / 2 - panelWidth / 2 + 155, height / 2, details.image)
      .setDepth(depth + 2)
    : null;
  if (conceptImage) conceptImage.setScale(Math.min(270 / conceptImage.width, conceptHeight / conceptImage.height));
  const panelHit = town
    ? scene.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x000000, 0)
      .setDepth(depth + 1).setInteractive()
    : panel.setInteractive();
  panelHit.on('pointerdown', (pointer, x, y, event) => event.stopPropagation());
  const dismiss = (pointer, x, y, event) => {
    event.stopPropagation();
    HapticsService.tap();
    close();
  };
  shade.on('pointerdown', dismiss);
  const buttonY = top + panelHeight - 52;
  const button = (stone ? addStoneButton : addWoodenPanel)(scene, width / 2, buttonY, 300, 72, depth + 3).setInteractive({ useHandCursor: true });
  if (stone) {
    const label = stoneText(scene, width / 2, buttonY, 'CLOSE', 32, depth + 4);
    objects.push(label);
    bindButtonPress(scene, button, [label], () => { HapticsService.tap(); close(); });
  } else button.on('pointerdown', dismiss);
  objects.push(shade, panel, body, button);
  if (conceptImage) objects.push(conceptImage);
  if (town) objects.push(panelHit);
  if (shopSign) objects.push(shopSign);
  objects.push(
    scene.add.text(width / 2, top + 44, details.title, {
      fontFamily: town ? 'Georgia' : 'Arial', fontSize: '36px', fontStyle: 'bold',
      color: warm || shop ? (shop ? shopTheme.text : '#fff1d2') : '#bef264', stroke: town || shop ? '#24170f' : undefined,
      strokeThickness: town || shop ? 3 : 0
    }).setOrigin(0.5).setDepth(depth + 2),
    scene.add.text(width / 2, button.y, stone ? '' : 'CLOSE', {
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
