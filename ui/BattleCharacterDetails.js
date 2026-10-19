import { combatPanel as addStonePanel, combatButton as addStoneButton, combatText as stoneText } from './CombatHudTheme.js';
import { classIcon, categoryIcon } from '../ui/IdentityIcons.js';
// The held battle sheet shows live resources and the four equipped skill slots.
// Drawing this modal does not pause combat; its shade only blocks underlying taps.
import GameState from '../game/GameState.js';
import { MAX_CHARACTER_LEVEL } from '../config/renown.js';
import { xpRequired } from '../game/AdventurerProgression.js';
import { abilityCardDetails } from '../game/AbilityDescriptions.js';
import { STONE } from './CarvedStone.js';
import { bindButtonPress } from './ButtonPress.js';
import { hallScroll } from './HallUI.js';
import { UI_FONT_FAMILIES } from '../config/uiTypography.js';
import HapticsService from '../services/HapticsService.js';

// Use logical canvas pixels so the same layout scales to a landscape phone.
export function showBattleCharacterDetails(scene, unit) {
  scene.selectionDetailsClose?.();
  const { width, height } = scene.scale;
  const panelWidth = Math.min(1440, width - 120);
  const panelHeight = Math.min(850, height - 120);
  const left = (width - panelWidth) / 2;
  const top = (height - panelHeight) / 2;
  const depth = 10000;
  const objects = [];
  const close = () => {
    objects.forEach(object => object.destroy());
    scene.selectionDetailsClose = null;
    scene.events.off('shutdown', close);
  };
  scene.selectionDetailsClose = close;
  scene.events.once('shutdown', close);

  const shade = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    .setDepth(depth).setInteractive();
  const panel = addStonePanel(scene, width / 2, height / 2, panelWidth, panelHeight, depth + 1).setInteractive();
  panel.on('pointerdown', (pointer, x, y, event) => event.stopPropagation());
  shade.on('pointerdown', (pointer, x, y, event) => {
    event.stopPropagation();
    HapticsService.tap();
    close();
  });
  objects.push(shade, panel);

  // Roster XP and levels can change after a wave while the live unit retains its combat kit.
  const hero = GameState.roster.find(record => record.id === unit.id) ?? unit;
  const level = hero.level ?? unit.level;
  const remainingXp = Math.max(0, xpRequired(level) - (hero.xp ?? 0));
  objects.push(stoneText(scene, width / 2, top + 44, unit.name, 42, depth + 2));
  objects.push(classIcon(scene, unit.className, left + 72, top + 104, 52, depth + 2));
  objects.push(stoneText(scene, left + 114, top + 104,
     `Lv ${level} ${unit.shortName ?? unit.className}`, 30, depth + 2).setOrigin(0, 0.5));
  objects.push(stoneText(scene, left + panelWidth - 46, top + 104,
    level >= MAX_CHARACTER_LEVEL ? 'Maximum level' : `XP to Level: ${remainingXp.toLocaleString('en-US')}`, 30, depth + 2,
    { color: '#ffd166' }).setOrigin(1, 0.5));
  objects.push(stoneText(scene, left + 46, top + 149,
    `Health: ${Math.floor(unit.hp)} / ${unit.maxHp}`, 30, depth + 2,
    { fontFamily: UI_FONT_FAMILIES.sans }).setOrigin(0, 0.5));
  if (unit.maxMana > 0) objects.push(stoneText(scene, left + 46, top + 187,
    `Mana: ${Math.floor(unit.mana)} / ${unit.maxMana}`, 30, depth + 2,
    { fontFamily: UI_FONT_FAMILIES.sans }).setOrigin(0, 0.5));

  const skills = Object.entries(unit.abilities ?? {})
    .filter(([key]) => !unit.abilityRanks || unit.abilityRanks[key] > 0).slice(0, 4);
  const cardWidth = (panelWidth - 116) / 2;
  const cardHeight = (panelHeight - 332) / 2;

  // Long effects and unusual costs keep the reading size and scroll within their card.
  const textRegion = (text, bounds, color, size) => {
    const body = stoneText(scene, bounds.x, bounds.y, text, size, depth + 3, {
      fontFamily: UI_FONT_FAMILIES.sans, fontStyle: 'normal', color,
      wordWrap: { width: bounds.width }, fixedWidth: bounds.width
    }).setOrigin(0, 0);
    if (body.height <= bounds.height) {
      objects.push(body);
      return;
    }
    const scroll = hallScroll(scene, bounds, [body], body.height, 0, () => {},
      (owner, x, y, w, h) => addStonePanel(owner, x, y, w, h, depth + 3), () => false, 28);
    scroll.container.setDepth(depth + 3);
    objects.push(scroll.container);
  };

  for (let index = 0; index < 4; index += 1) {
    // Modulo chooses the left or right column; integer division chooses the row.
    const x = left + 46 + (index % 2) * (cardWidth + 24);
    const y = top + 222 + Math.floor(index / 2) * (cardHeight + 20);
    objects.push(addStonePanel(scene, x + cardWidth / 2, y + cardHeight / 2,
      cardWidth, cardHeight, depth + 2));
    const equipped = skills[index];
    if (!equipped) {
      objects.push(stoneText(scene, x + cardWidth / 2, y + cardHeight / 2,
        'No ability equipped', 30, depth + 3, { color: STONE.muted }));
      continue;
    }
    const [key, ability] = equipped;
    const card = abilityCardDetails(unit, ability);
    const rank = unit.abilityRanks?.[key];
    objects.push(categoryIcon(scene, ability.category, x + 43, y + 36, 40, depth + 3));
    const title = stoneText(scene, x + 74, y + 16, ability.name, 32, depth + 3,
      { color: '#ffd166', wordWrap: { width: cardWidth - 98 } }).setOrigin(0, 0);
    objects.push(title);
    const bodyTop = Math.max(65, title.height + 28);
    textRegion(card.description, { x: x + 24, y: y + bodyTop, width: cardWidth - 76,
      height: cardHeight - 85 - bodyTop }, STONE.text, 30);
    textRegion(`${rank ? `Rank ${rank} · ` : ''}${card.facts}`,
      { x: x + 24, y: y + cardHeight - 76, width: cardWidth - 76,
      height: 64 }, STONE.muted, 26);
  }

  const button = addStoneButton(scene, width / 2, top + panelHeight - 45, 300, 72, depth + 3);
  const label = stoneText(scene, width / 2, button.y, 'CLOSE', 32, depth + 4);
  bindButtonPress(scene, button, [label], () => {
    HapticsService.tap();
    close();
  });
  objects.push(button, label);
}
