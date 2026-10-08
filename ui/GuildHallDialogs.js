// Hall details use temporary parchment and framed controls above the main screen. Text is
// measured and wrapped within the paper inset, leaving room for the close control. Cleanup
// must remove masks, blockers and listeners as well as visible text.

import { GUILD, guildSurface, guildCrest, guildRule } from './GuildHallTheme.js';
import { bindButtonPress } from './ButtonPress.js';
import HapticsService from '../services/HapticsService.js';
import GameState from '../game/GameState.js';
import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { hallScroll } from './HallUI.js';

import { bindSelectionDetails } from './SelectionDetails.js';
import { abilityDescription } from '../game/AbilityDescriptions.js';
import { rankedAbility } from '../game/AdventurerAbilities.js';
import { getEquippedAdventurer } from '../game/Equipment.js';

// Build styled text at the requested position using this screen's shared text defaults.
function text(scene, x, y, value, size, options = {}) {

  // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center and
  // 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
  // corner. ... copies the source's own fields into this object; fields listed later
  // replace earlier ones. This is a shallow copy, so nested objects are still shared.
  return scene.add.text(x, y, value, { fontFamily: UI_FONT_FAMILIES.sans, fontSize: `${size}px`, color: GUILD.ink, ...options }).setOrigin(0.5);
}

// Build a themed control and attach the supplied action to its valid press.
function button(scene, x, y, width, label, callback, depth) {

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects.
  const face = guildSurface(scene, x, y, width, 112, 'button').setDepth(depth);

  // This gives the display object an input hit area. Visible artwork alone does not make
  // an object respond to a tap.
  const hit = scene.add.rectangle(x, y, width, 112, 0, 0).setDepth(depth + 1).setInteractive({ useHandCursor: true });
  const caption = text(scene, x, y, label, UI_FONT_SIZES.body34, { color: GUILD.paper, fontFamily: UI_FONT_FAMILIES.serif }).setDepth(depth + 2);
  hit.pressVisuals = [face];
  bindButtonPress(scene, hit, [caption], () => {
    HapticsService.tap();
    callback();
  });
  const move = (pointer) => {

    // Math.hypot calculates straight-line length from the x/y differences: square each,
    // add them, then take the square root.
    if (pointer.isDown && Math.hypot(pointer.x - pointer.downX, pointer.y - pointer.downY) > 24) hit.emit('pointerout');
  };

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  scene.input.on('pointermove', move);

  // once registers a callback that removes itself after the first matching event.
  hit.once('destroy', () => scene.input.off('pointermove', move));
  return hit;
}

// Prepare the temporary dialog objects and blocker that the details view owns.
function start(scene, title, width, height, label, preserveEquipment = false) {

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  scene.selectionDetailsClose?.();
  if (!preserveEquipment) scene.equipmentModalClose?.();
  const objects = [], depth = 11000;

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
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

  // once registers a callback that removes itself after the first matching event.
  scene.events.once('shutdown', close);

  // Scroll containers can remove earlier children, so modal ownership must use identity.
  const existing = new Set(scene.children.list);

  // This gives the display object an input hit area. Visible artwork alone does not make
  // an object respond to a tap. Depth is drawing order, not distance or size. Higher-depth
  // objects draw on top of lower-depth objects.
  const shade = scene.add.rectangle(x, y, screenWidth, screenHeight, 0x0c0805, 0.8).setDepth(depth).setInteractive();
  const panel = guildSurface(scene, x, y, width, height, 'panel').setDepth(depth + 1);
  const blocker = scene.add.rectangle(x, y, width, height, 0, 0).setDepth(depth + 2).setInteractive();
  const stop = (pointer, px, py, event) => event?.stopPropagation?.();

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  shade.on('pointerdown', stop);
  blocker.on('pointerdown', stop);
  blocker.on('pointerup', stop);
  guildSurface(scene, x, top + 89, width - 54, 126, 'beam').setDepth(depth + 3);
  guildCrest(scene, x - width / 2 + 96, top + 87, 70).setDepth(depth + 4);
  guildCrest(scene, x + width / 2 - 96, top + 87, 70).setDepth(depth + 4);
  text(scene, x, top + 48, label, UI_FONT_SIZES.compact24, { color: '#cfaa70', letterSpacing: 4 }).setDepth(depth + 4);
  text(scene, x, top + 100, title, UI_FONT_SIZES.heading46, { color: GUILD.paper, fontFamily: UI_FONT_FAMILIES.serif, wordWrap: { width: width - 320 } }).setDepth(depth + 4);

  return { x, top, width, height, depth, close, finish: (...extra) => objects.push(...scene.children.list.filter(object => !existing.has(object)), ...extra.filter(Boolean)), panel };
}

// Open the Hall's parchment details view with bounded text and shared dismissal cleanup.
// scene is the Phaser screen that owns the objects, clock and input used here.
export function showGuildDetails(scene, details) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const hero = GameState.roster.find((entry) => entry.name === details.title);

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound. The condition before ? chooses the first value when
  // true and the value after : when false.
  const width = Math.min(hero ? 1560 : 1380, scene.scale.width - 120);
  const body = !hero ? text(scene, 0, 0, details.description, UI_FONT_SIZES.detailBody, { align: 'center', fixedWidth: width - 180, wordWrap: { width: width - 180 }, lineSpacing: 12 }) : null;
  const height = hero ? Math.min(970, scene.scale.height - 90) : Math.min(scene.scale.height - 90, Math.max(540, body.height + 430));
  const modal = start(scene, details.title, width, height, hero ? 'GUILD REGISTRY' : 'GUILD HANDBOOK', details.preserveEquipment);

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { x, top, depth } = modal;
  let bodyScroll;

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects.
  guildSurface(scene, x, top + (height + 10) / 2, width - 82, height - 350, 'paper').setDepth(depth + 3);
  if (hero) {
    const left = x - width / 2;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const frame = CHARACTER_SPRITES[hero.id]?.clips.idle.south.frames[0];
    guildSurface(scene, left + 235, top + 405, 290, 350, 'panel').setDepth(depth + 4);
    if (frame && scene.textures.exists(frame.key)) scene.add.image(left + 235, top + 407, frame.key, frame.frame).setDisplaySize(256, 256).setDepth(depth + 5);
    const columnX = left + 970;
    text(scene, columnX, top + 237, `${hero.className} · ${hero.role} · Level ${hero.level}`, UI_FONT_SIZES.body31, {
      wordWrap: { width: 970 }, align: 'center', fontStyle: UI_FONT_WEIGHTS.bold
    }).setDepth(depth + 5);

    const paragraphs = details.description.split('\n\n');

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const stats = paragraphs.filter((line) => line.startsWith('HP:') || line.startsWith('Mana:')).join('     ');
    text(scene, columnX, top + 309, stats, UI_FONT_SIZES.body31, { align: 'center', wordWrap: { width: 970 } }).setDepth(depth + 5);
    guildRule(scene, columnX, top + 365, 880).setDepth(depth + 5);
    text(scene, columnX, top + 409, 'Known Skills', UI_FONT_SIZES.body35, { fontFamily: UI_FONT_FAMILIES.serif }).setDepth(depth + 5);

    // Object.entries turns own fields into [key, value] pairs so we can visit or transform
    // them. ?? uses the fallback only for null or undefined. A real zero or false stays
    // intact.
    Object.entries(hero.abilities ?? {}).filter(([key]) => (hero.abilityRanks?.[key] ?? 0) > 0).forEach(([key, ability], index) => {

      // % gives the remainder. With a nonnegative index and positive list length, it wraps
      // the index back to the start of the list. Math.floor rounds toward the smaller
      // whole number, so 3.8 becomes 3.
      const tx = left + 610 + index % 2 * 470, ty = top + 465 + Math.floor(index / 2) * 57;

      // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
      // lower-depth objects.
      scene.add.circle(tx - 17, ty, 3, 0x9b7643).setDepth(depth + 5);

      // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
      // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the
      // object's corner.
      const skill = text(scene, tx, ty, `${ability.name} (Rank ${hero.abilityRanks[key]})`, UI_FONT_SIZES.body30, { wordWrap: { width: 445 } }).setOrigin(0, 0.5).setDepth(depth + 5);
      const hit = scene.add.rectangle(tx + 208, ty, 445, 57, 0, 0).setDepth(depth + 5);
      bindSelectionDetails(scene, hit, () => ({ title: ability.name,
        description: abilityDescription(getEquippedAdventurer(hero), rankedAbility(ability, hero.abilityRanks[key])) }),
      undefined, undefined, { allowSceneInput: true, allowWhileModal: true });
      skill.setName(`known-skill-${key}`);
    });

    text(scene, left + 235, top + 618, hero.shortName ?? hero.className, UI_FONT_SIZES.support29, { align: 'center', wordWrap: { width: 290 }, fontFamily: UI_FONT_FAMILIES.serif }).setDepth(depth + 5);
  } else {

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    body.setPosition(x - (width - 180) / 2, top + 220).setOrigin(0, 0).setDepth(depth + 5);
    bodyScroll = hallScroll(scene, { x: body.x, y: body.y, width: width - 180, height: height - 402 },
      [body], body.height, 0, () => {},
      (owner, sx, sy, sw, sh, style) => guildSurface(owner, sx, sy, sw, sh, style).setDepth(depth + 5),
      () => false);
    bodyScroll.container.setDepth(depth + 5);
  }

  button(scene, x, top + height - 87, 380, 'CLOSE', modal.close, depth + 6);
  modal.finish(body, bodyScroll?.container);
  return modal.close;
}

// Open a Hall-themed confirm/cancel decision above the existing workspace. scene is the
// Phaser screen that owns the objects, clock and input used here.
export function showGuildConfirmation(scene, { title, description, confirmLabel = 'CONFIRM', onConfirm, onCancel }) {

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound.
  const width = Math.min(1440, scene.scale.width - 120);
  const body = text(scene, 0, 0, description, UI_FONT_SIZES.body36, { align: 'center', wordWrap: { width: width - 190 }, lineSpacing: 9 });
  const height = Math.min(scene.scale.height - 90, Math.max(640, body.height + 430));
  const modal = start(scene, title, width, height, 'GUILD LEDGER');

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { x, top, depth } = modal;

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects.
  guildSurface(scene, x, top + (height + 10) / 2, width - 82, height - 350, 'paper').setDepth(depth + 3);
  body.setPosition(x, top + (height + 10) / 2).setDepth(depth + 5);
  button(scene, x - width / 4, top + height - 87, width / 2 - 100, 'CANCEL', () => {
    modal.close();
    onCancel?.();
  }, depth + 6);
  button(scene, x + width / 4, top + height - 87, width / 2 - 100, confirmLabel, () => {
    modal.close();
    onConfirm();
  }, depth + 6);
  modal.finish(body);

  return modal.close;
}
