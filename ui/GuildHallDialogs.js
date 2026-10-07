import { GUILD, guildSurface, guildCrest, guildRule } from './GuildHallTheme.js';
import { bindButtonPress } from './ButtonPress.js';
import HapticsService from '../services/HapticsService.js';
import GameState from '../game/GameState.js';
import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';

function text(scene, x, y, value, size, options = {}) {
  return scene.add.text(x, y, value, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: `${size}px`, color: GUILD.ink, ...options }).setOrigin(0.5);
}

function button(scene, x, y, width, label, callback, depth) {
  const face = guildSurface(scene, x, y, width, 112, 'button').setDepth(depth);
  const hit = scene.add.rectangle(x, y, width, 112, 0, 0).setDepth(depth + 1).setInteractive({ useHandCursor: true });
  const caption = text(scene, x, y, label, UI_FONT_SIZES.body34, { color: GUILD.paper, fontFamily: UI_FONT_FAMILIES.serif }).setDepth(depth + 2);
  hit.pressVisuals = [face];
  bindButtonPress(scene, hit, [caption], () => { HapticsService.tap(); callback(); });
  const move = (pointer) => {
    if (pointer.isDown && Math.hypot(pointer.x - pointer.downX, pointer.y - pointer.downY) > 24) hit.emit('pointerout');
  };
  scene.input.on('pointermove', move);
  hit.once('destroy', () => scene.input.off('pointermove', move));
  return hit;
}

function start(scene, title, width, height, label, preserveEquipment = false) {
  scene.selectionDetailsClose?.();
  if (!preserveEquipment) scene.equipmentModalClose?.();
  const objects = [], depth = 11000;
  const { width: screenWidth, height: screenHeight } = scene.scale;
  const x = screenWidth / 2, y = screenHeight / 2, top = y - height / 2;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scene.events.off('shutdown', close);
    if (scene.selectionDetailsClose === close) scene.selectionDetailsClose = null;
    objects.forEach((object) => { if (object.active) object.destroy(); });
  };
  scene.selectionDetailsClose = close;
  scene.events.once('shutdown', close);
  const first = scene.children.list.length;
  const shade = scene.add.rectangle(x, y, screenWidth, screenHeight, 0x0c0805, 0.8).setDepth(depth).setInteractive();
  const panel = guildSurface(scene, x, y, width, height, 'panel').setDepth(depth + 1);
  const blocker = scene.add.rectangle(x, y, width, height, 0, 0).setDepth(depth + 2).setInteractive();
  const stop = (pointer, px, py, event) => event?.stopPropagation?.();
  shade.on('pointerdown', stop); blocker.on('pointerdown', stop); blocker.on('pointerup', stop);
  guildSurface(scene, x, top + 89, width - 54, 126, 'beam').setDepth(depth + 3);
  guildCrest(scene, x - width / 2 + 96, top + 87, 70).setDepth(depth + 4);
  guildCrest(scene, x + width / 2 - 96, top + 87, 70).setDepth(depth + 4);
  text(scene, x, top + 48, label, UI_FONT_SIZES.compact24, { color: '#cfaa70', letterSpacing: 4 }).setDepth(depth + 4);
  text(scene, x, top + 100, title, UI_FONT_SIZES.heading46, { color: GUILD.paper, fontFamily: UI_FONT_FAMILIES.serif, wordWrap: { width: width - 320 } }).setDepth(depth + 4);
  return { x, top, width, height, depth, close, finish: (...extra) => objects.push(...scene.children.list.slice(first), ...extra.filter(Boolean)), panel };
}

export function showGuildDetails(scene, details) {
  const hero = GameState.roster.find((entry) => entry.name === details.title);
  const width = Math.min(hero ? 1560 : 1380, scene.scale.width - 120);
  const body = !hero ? text(scene, 0, 0, details.description, UI_FONT_SIZES.detailBody, { align: 'center', wordWrap: { width: width - 180 }, lineSpacing: 12 }) : null;
  const height = hero ? Math.min(970, scene.scale.height - 90) : Math.min(scene.scale.height - 90, Math.max(540, body.height + 430));
  const modal = start(scene, details.title, width, height, hero ? 'GUILD REGISTRY' : 'GUILD HANDBOOK', details.preserveEquipment);
  const { x, top, depth } = modal;
  guildSurface(scene, x, top + (height + 10) / 2, width - 82, height - 350, 'paper').setDepth(depth + 3);
  if (hero) {
    const left = x - width / 2;
    const frame = CHARACTER_SPRITES[hero.id]?.clips.idle.south.frames[0];
    guildSurface(scene, left + 235, top + 405, 290, 350, 'panel').setDepth(depth + 4);
    if (frame && scene.textures.exists(frame.key)) scene.add.image(left + 235, top + 407, frame.key, frame.frame).setDisplaySize(256, 256).setDepth(depth + 5);
    const columnX = left + 970;
    text(scene, columnX, top + 237, `${hero.className} · ${hero.role} · Level ${hero.level}`, UI_FONT_SIZES.body31, {
      wordWrap: { width: 970 }, align: 'center', fontStyle: UI_FONT_WEIGHTS.bold
    }).setDepth(depth + 5);
    const paragraphs = details.description.split('\n\n');
    const stats = paragraphs.filter((line) => line.startsWith('HP:') || line.startsWith('Mana:')).join('     ');
    text(scene, columnX, top + 309, stats, UI_FONT_SIZES.body31, { align: 'center', wordWrap: { width: 970 } }).setDepth(depth + 5);
    guildRule(scene, columnX, top + 365, 880).setDepth(depth + 5);
    text(scene, columnX, top + 409, 'Known Skills', UI_FONT_SIZES.body35, { fontFamily: UI_FONT_FAMILIES.serif }).setDepth(depth + 5);
    Object.entries(hero.abilities ?? {}).filter(([key]) => (hero.abilityRanks?.[key] ?? 0) > 0).forEach(([key, ability], index) => {
      const tx = left + 610 + index % 2 * 470, ty = top + 465 + Math.floor(index / 2) * 57;
      scene.add.circle(tx - 17, ty, 3, 0x9b7643).setDepth(depth + 5);
      text(scene, tx, ty, `${ability.name} (Rank ${hero.abilityRanks[key]})`, UI_FONT_SIZES.body30, { wordWrap: { width: 445 } }).setOrigin(0, 0.5).setDepth(depth + 5);
    });
    text(scene, left + 235, top + 618, hero.shortName ?? hero.className, UI_FONT_SIZES.support29, { align: 'center', wordWrap: { width: 290 }, fontFamily: UI_FONT_FAMILIES.serif }).setDepth(depth + 5);
  } else {
    body.setPosition(x, top + (height + 10) / 2).setDepth(depth + 5);
    if (body.height > height - 402) body.setFontSize(UI_FONT_SIZES.detailBodyCompact);
  }
  button(scene, x, top + height - 87, 380, 'CLOSE', modal.close, depth + 6);
  modal.finish(body);
  return modal.close;
}

export function showGuildConfirmation(scene, { title, description, confirmLabel = 'CONFIRM', onConfirm, onCancel }) {
  const width = Math.min(1440, scene.scale.width - 120);
  const body = text(scene, 0, 0, description, UI_FONT_SIZES.body36, { align: 'center', wordWrap: { width: width - 190 }, lineSpacing: 9 });
  const height = Math.min(scene.scale.height - 90, Math.max(640, body.height + 430));
  const modal = start(scene, title, width, height, 'GUILD LEDGER');
  const { x, top, depth } = modal;
  guildSurface(scene, x, top + (height + 10) / 2, width - 82, height - 350, 'paper').setDepth(depth + 3);
  body.setPosition(x, top + (height + 10) / 2).setDepth(depth + 5);
  button(scene, x - width / 4, top + height - 87, width / 2 - 100, 'CANCEL', () => { modal.close(); onCancel?.(); }, depth + 6);
  button(scene, x + width / 4, top + height - 87, width / 2 - 100, confirmLabel, () => { modal.close(); onConfirm(); }, depth + 6);
  modal.finish(body);
  return modal.close;
}
