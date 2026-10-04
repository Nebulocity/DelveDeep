import HapticsService from '../services/HapticsService.js';

export const DETAILS_HINT = 'Long-press or hold-click a selection for details.';

export function addDetailsHint(scene, y, text = DETAILS_HINT) {
  const hall = isHallMenu(scene) || isTownMenu(scene);
  return scene.add.text(scene.scale.width / 2, y, text, {
    fontFamily: 'Arial', fontSize: '26px', color: hall ? '#f4d5ab' : '#cbd5e1',
    stroke: hall ? '#180d09' : '#111827', strokeThickness: 4
  }).setOrigin(0.5).setDepth(4800);
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
  return { title: delve.name, description: `${delve.subtitle}\n\n${delve.difficulty} | Recommended level ${delve.recommendedLevel} | ${delve.rooms} waves\n\nRewards: ${(delve.possibleDrops ?? []).join(', ')}` };
}

// Modal details block underlying controls. Combat clocks and decisions pause
// together so reading never costs the party health or consumes a queued cast.
export function showSelectionDetails(scene, details) {
  scene.selectionDetailsClose?.();
  const { width, height } = scene.scale;
  const hall = isHallMenu(scene);
  const town = isTownMenu(scene);
  const warm = hall || town;
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
  const panelWidth = Math.min(1100, width - 120);
  const bodyMargin = town ? 104 : 44;
  const body = scene.add.text(width / 2 - panelWidth / 2 + bodyMargin, 0, details.description, {
    fontFamily: 'Arial', fontSize: '30px', color: warm ? '#f1dfca' : '#e2e8f0',
    wordWrap: { width: panelWidth - bodyMargin * 2 }
  }).setDepth(depth + 2);
  const panelHeight = Math.min(height - 140, Math.max(340, body.height + 210));
  const top = (height - panelHeight) / 2;
  body.setY(top + 94);
  // Keep long descriptions contained while retaining the normal large type.
  if (body.height > panelHeight - 190) body.setScale((panelHeight - 190) / body.height);
  const shade = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    .setDepth(depth).setInteractive();
  const panel = town
    ? scene.add.image(width / 2, height / 2, 'town-sign-details')
      .setDisplaySize(panelWidth + 100, panelHeight + 160).setDepth(depth + 1)
    : scene.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, hall ? 0x21130d : 0x111827)
      .setStrokeStyle(3, hall ? 0xd9a662 : 0x84cc16).setDepth(depth + 1);
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
  const buttonArt = town ? scene.add.image(width / 2, buttonY, 'town-sign-world-map')
    .setDisplaySize(320, 118).setDepth(depth + 2) : null;
  const button = scene.add.rectangle(width / 2, buttonY, 300, 72, town ? 0x000000 : hall ? 0x6b4527 : 0x334155, town ? 0 : 1)
    .setStrokeStyle(town ? 0 : hall ? 3 : 0, hall ? 0xd9a662 : 0x334155)
    .setDepth(depth + 3).setInteractive({ useHandCursor: true });
  button.on('pointerdown', dismiss);
  objects.push(shade, panel, body, button);
  if (town) objects.push(panelHit, buttonArt);
  objects.push(
    scene.add.text(width / 2, top + 44, details.title, {
      fontFamily: town ? 'Georgia' : 'Arial', fontSize: '36px', fontStyle: 'bold',
      color: warm ? '#fff1d2' : '#bef264', stroke: town ? '#24170f' : undefined,
      strokeThickness: town ? 3 : 0
    }).setOrigin(0.5).setDepth(depth + 2),
    scene.add.text(width / 2, button.y, 'CLOSE', {
      fontFamily: town ? 'Georgia' : 'Arial', fontSize: '30px', color: warm ? '#fff1d2' : '#ffffff',
      stroke: town ? '#24170f' : undefined, strokeThickness: town ? 2 : 0
    }).setOrigin(0.5).setDepth(depth + 4));
}

// Bind after a selection's normal pointerdown action. Defer that action until
// release, and suppress it after a hold or drag. Navigation-only buttons need
// no binding. Each binding cleans up with its object, including wave enemies.
export function bindSelectionDetails(scene, target, getDetails, onTap, onDetails) {
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
    event?.stopPropagation?.();
    cancel();
    press = { id: pointer.id, x: pointer.x, y: pointer.y, held: false };
    timer = globalThis.setTimeout(() => {
      timer = null;
      if (!press || !pointer.isDown || scene.selectionDetailsClose) return;
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
    args[3]?.stopPropagation?.();
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
