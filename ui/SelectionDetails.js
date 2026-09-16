import HapticsService from '../services/HapticsService.js';

export const DETAILS_HINT = 'Long-press or hold-click a selection for details.';
export const TONIC_DESCRIPTION = 'Restores 35% maximum HP to a living, injured ally. Tap their TONIC button in combat. Also auto-uses at 35% HP or below. All tonics share a 1.5-second cooldown.';

export function addDetailsHint(scene, y, text = DETAILS_HINT) {
  return scene.add.text(scene.scale.width / 2, y, text, {
    fontFamily: 'Arial', fontSize: '26px', color: '#cbd5e1',
    stroke: '#111827', strokeThickness: 4
  }).setOrigin(0.5).setDepth(4800);
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
  return { title: delve.name, description: `${delve.subtitle}\n\n${delve.difficulty} | Recommended level ${delve.recommendedLevel} | ${delve.rooms} waves\n\nPossible drops: ${(delve.possibleDrops ?? []).join(', ')}${delve.requiresVoidKey ? '\n\nRequires a Void Key.' : ''}` };
}

// Modal details block underlying controls. Combat clocks and decisions pause
// together so reading never costs the party health or consumes a queued cast.
export function showSelectionDetails(scene, details) {
  scene.selectionDetailsClose?.();
  const { width, height } = scene.scale;
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
  const body = scene.add.text(width / 2 - panelWidth / 2 + 44, 0, details.description, {
    fontFamily: 'Arial', fontSize: '30px', color: '#e2e8f0',
    wordWrap: { width: panelWidth - 88 }
  }).setDepth(depth + 2);
  const panelHeight = Math.min(height - 140, Math.max(340, body.height + 210));
  const top = (height - panelHeight) / 2;
  body.setY(top + 94);
  // Keep long descriptions contained while retaining the normal large type.
  if (body.height > panelHeight - 190) body.setScale((panelHeight - 190) / body.height);
  const shade = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    .setDepth(depth).setInteractive();
  const panel = scene.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x111827)
    .setStrokeStyle(3, 0x84cc16).setDepth(depth + 1).setInteractive();
  panel.on('pointerdown', (pointer, x, y, event) => event.stopPropagation());
  const dismiss = (pointer, x, y, event) => {
    event.stopPropagation();
    HapticsService.tap();
    close();
  };
  shade.on('pointerdown', dismiss);
  const button = scene.add.rectangle(width / 2, top + panelHeight - 52, 300, 72, 0x334155)
    .setDepth(depth + 2).setInteractive({ useHandCursor: true });
  button.on('pointerdown', dismiss);
  objects.push(shade, panel, body, button,
    scene.add.text(width / 2, top + 44, details.title, {
      fontFamily: 'Arial', fontSize: '36px', fontStyle: 'bold', color: '#bef264'
    }).setOrigin(0.5).setDepth(depth + 2),
    scene.add.text(width / 2, button.y, 'CLOSE', {
      fontFamily: 'Arial', fontSize: '30px', color: '#ffffff'
    }).setOrigin(0.5).setDepth(depth + 3));
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
