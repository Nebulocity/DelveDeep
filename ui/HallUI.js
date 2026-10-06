import { addHallBackground } from './HallBackground.js';
import { bindSelectionDetails } from './SelectionDetails.js';
import { bindButtonPress } from './ButtonPress.js';
import { addCategoryIcon } from './FacilityChoiceArt.js';
import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { guildSurface, guildCrest } from './GuildHallTheme.js';

export const HALL = { text: '#fff1d2', muted: '#d2b895', gold: 0xe6bd70, green: '#afd69f', edge: 0x866039 };
export const HALL_ARCHETYPES = [
  { role: 'Tank', label: 'Tanks', icon: 'shield', color: 0xa8c9dc },
  { role: 'Healer', label: 'Healers', icon: 'healer', color: 0xafd69f },
  { role: 'Melee DPS', label: 'Melee DPS', icon: 'sword', color: 0xe4ad85 },
  { role: 'Ranged DPS', label: 'Ranged DPS', icon: 'bow', color: 0xc3b3e3 }
];

export function hallText(scene, x, y, value, size = 34, options = {}) {
  return scene.add.text(x, y, value, {
    fontFamily: 'Arial', fontSize: `${size}px`, color: HALL.text, ...options
  }).setOrigin(0, 0.5);
}

export function hallPanel(scene, x, y, width, height, color = 0x2b1c13) {
  return guildSurface(scene, x, y, width, height);
}

export function hallIcon(scene, kind, x, y, color = HALL.gold, scale = 1) {
  if (!['healer', 'bow'].includes(kind)) return addCategoryIcon(scene, kind, x, y, color).setScale(0.72 * scale);
  const art = scene.add.graphics().setPosition(x, y).setScale(scale).lineStyle(4, color);
  if (kind === 'healer') art.lineBetween(-17, 0, 17, 0).lineBetween(0, -17, 0, 17);
  else {
    art.beginPath().moveTo(-15, -24).lineTo(1, -14).lineTo(10, 0).lineTo(1, 14).lineTo(-15, 24).strokePath();
    art.lineBetween(-15, -24, -15, 24).lineBetween(-25, 0, 24, 0);
    art.lineBetween(15, -8, 24, 0).lineBetween(15, 8, 24, 0);
  }
  return art;
}

export function hallButton(scene, x, y, width, height, label, onTap, options = {}) {
  const { selected = false, enabled = true, details, depth = 0 } = options;
  const face = guildSurface(scene, x, y, width, height, 'button', selected).setDepth(depth).setAlpha(enabled ? 1 : 0.55);
  const box = scene.add.rectangle(x, y, width, height, 0, 0).setDepth(depth + 0.1);
  box.pressVisuals = [face];
  const caption = hallText(scene, x, y, label, options.size ?? 32, {
    fontFamily: 'Georgia', align: 'center', wordWrap: { width: width - 24 }, ...(options.textStyle ?? {})
  }).setOrigin(0.5).setDepth(depth + 0.2).setAlpha(enabled ? 1 : 0.55);
  box.setName(options.name ?? label);
  if (enabled) {
    const tap = () => { if (!scene.equipmentModalClose || options.modal) { HapticsService.tap(); onTap?.(); } };
    hallDetails(scene, box, details ?? { title: label, description: label }, tap,
      details ? undefined : () => {});
    bindButtonPress(scene, box, [caption]);
  }
  return box;
}

export function hallDetails(scene, target, details, onTap, onDetails) {
  bindSelectionDetails(scene, target, details, onTap, onDetails, { allowSceneInput: true });
  const cancel = () => target.emit('pointerout');
  scene.game.events.on('blur', cancel);
  target.once('destroy', () => scene.game.events.off('blur', cancel));
}

export function addHallFrame(scene, active, message = '') {
  addHallBackground(scene, 0.3);
  const { width, height } = scene.scale;
  guildSurface(scene, width / 2, 63, width, 126, 'beam');
  guildCrest(scene, width / 2 - 370, 75, 78);
  guildCrest(scene, width / 2 + 370, 75, 78);
  hallText(scene, width / 2, 28, 'PINESHIRE', 24, { color: '#e6bd70', letterSpacing: 6 }).setOrigin(0.5);
  hallText(scene, width / 2, 78, 'Adventurer’s Hall', 54, { fontFamily: 'Georgia' }).setOrigin(0.5);
  hallButton(scene, 200, 63, 290, 112, 'TOWN', () => scene.scene.start('TownScene'));
  hallText(scene, width - 60, 67, `${GameState.gold} GOLD`, 38, { color: '#e6bd70' }).setOrigin(1, 0.5);
  guildSurface(scene, width / 2, 186, width, 120, 'beam');
  [['Adventurers', 'RosterScene'], ['Items', 'ItemsScene'], ['Tactics', 'RaidLeaderScene']].forEach(([label, destination], index) => {
    hallButton(scene, 250 + index * 405, 186, 380, 112, label, () => {
      if (destination !== scene.scene.key) scene.scene.start(destination);
    }, { selected: label === active, size: 36, name: `hall-nav-${label.toLowerCase()}` });
  });
  hallText(scene, width - 60, 186, 'Prepare for the road ahead', 32, {
    fontFamily: 'Georgia', fontStyle: 'italic', color: HALL.muted
  }).setOrigin(1, 0.5);
  guildSurface(scene, width / 2, height - 31, width, 62, 'beam');
  hallText(scene, 58, height - 31, message || 'Drag lists to scroll. Hold an adventurer, item or skill for details.', 28, {
    color: message ? '#ffe0a7' : HALL.muted, wordWrap: { width: width - 116 }
  });
}

export function preloadHallPortraits(scene) {
  for (const definition of Object.values(CHARACTER_SPRITES)) {
    const frame = definition.clips.idle.south.frames[0];
    const texture = definition.textures.find((entry) => entry.key === frame.key);
    if (texture && !scene.textures.exists(texture.key)) scene.load.spritesheet(texture.key, texture.url, { frameWidth: 256, frameHeight: 256 });
  }
}

export function hallPortrait(scene, hero, x, y, size) {
  const frame = CHARACTER_SPRITES[hero.id]?.clips.idle.south.frames[0];
  if (!frame || !scene.textures.exists(frame.key)) return scene.add.circle(x, y, size / 3, hero.color);
  scene.textures.get(frame.key).setFilter(1);
  return scene.add.image(x, y, frame.key, frame.frame).setDisplaySize(size, size).setFlipX(frame.flipX === true);
}

// Masks constrain drawing and hit tests; off-screen controls cannot receive taps.
export function hallScroll(scene, bounds, objects, contentHeight, initial = 0, onScroll = () => {}) {
  const { x, y, width, height } = bounds;
  const container = scene.add.container(0, 0, objects.sort((a, b) => a.depth - b.depth));
  const maskArt = scene.make.graphics({ add: false }).fillRect(x, y, width, height);
  const mask = maskArt.createGeometryMask();
  container.setMask(mask);
  const max = Math.max(0, contentHeight - height);
  let value = Math.min(initial, max), drag = null, disposed = false;
  const trackX = x + width + 13;
  const track = guildSurface(scene, trackX, y + height / 2, 20, height, 'track');
  const thumbHeight = Math.max(105, height * height / (height + max));
  const thumb = guildSurface(scene, trackX, y + thumbHeight / 2, 30, thumbHeight, 'thumb');
  track.setVisible(max > 0); thumb.setVisible(max > 0);
  const blocked = () => Boolean(scene.selectionDetailsClose || scene.equipmentModalClose);
  const inside = (px, py) => px >= x && px <= x + width && py >= y && py <= y + height;
  for (const object of objects.filter((object) => object.input?.enabled)) {
    const hit = object.input.hitAreaCallback;
    object.input.hitAreaCallback = (area, px, py, target) => {
      const point = target.getWorldTransformMatrix().transformPoint(px - target.displayOriginX, py - target.displayOriginY);
      return !blocked() && inside(point.x, point.y) && hit(area, px, py, target);
    };
  }
  const set = (next) => {
    if (disposed) return;
    value = Math.max(0, Math.min(max, next));
    container.y = -value;
    thumb.y = y + thumbHeight / 2 + (max ? value / max * (height - thumbHeight) : 0);
    onScroll(value);
  };
  const wheel = (pointer, targets, dx, dy) => { if (!blocked() && inside(pointer.x, pointer.y)) set(value + dy); };
  const move = (pointer) => {
    if (!pointer.isDown || blocked()) { drag = null; return; }
    const bar = Math.abs(pointer.downX - trackX) <= 34 && pointer.downY >= y && pointer.downY <= y + height;
    if (bar && max) { set((pointer.y - y - thumbHeight / 2) / (height - thumbHeight) * max); return; }
    if (!inside(pointer.downX, pointer.downY)) return;
    if (!drag) drag = { start: pointer.downY, value };
    if (Math.abs(pointer.y - drag.start) > 24) set(drag.value + drag.start - pointer.y);
  };
  const release = () => { drag = null; };
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    scene.input.off('wheel', wheel).off('pointermove', move).off('pointerup', release).off('gameout', release);
    scene.game.events.off('blur', release);
    scene.events.off('shutdown', cleanup);
    mask.destroy(); maskArt.destroy(); track.destroy(); thumb.destroy();
  };
  scene.input.on('wheel', wheel).on('pointermove', move).on('pointerup', release).on('gameout', release);
  scene.game.events.on('blur', release);
  scene.events.once('shutdown', cleanup);
  container.once('destroy', cleanup);
  set(value);
  return { container, max, thumb, set, destroy: () => container.destroy(true) };
}
