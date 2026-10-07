import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { bindSelectionDetails } from './SelectionDetails.js';
import { UI_SAFE_TOP } from './Layout.js';
import { addFacilityReturnButton, addFacilityDetailsHint } from './FacilityChrome.js';
import { addFacilityChoiceCard, addFacilityPlate } from './FacilityChoiceArt.js';
import { bindButtonPress } from './ButtonPress.js';
import { addWoodenPanel } from './WoodenPanel.js';

export const FACILITIES = {
  Alchemist: {
    name: 'Alchemist', title: 'ALCHEMIST', background: 'alchemist', subtitle: 'Potions, mixtures, and remedies.',
    choices: [
      { id: 'buy', label: 'BUY', icon: 'flask', subtitle: 'Browse potions', description: 'Buy three-use potion packs for your adventurers.', message: 'Choose a potion pack.' },
      { id: 'sell', label: 'SELL', icon: 'flask-sale', subtitle: 'Sell any item', description: 'Sell owned gear, potion packs, materials, and enchantment scrolls. Unequip gear first.', message: 'Choose an owned item to sell.' },
      { id: 'brew', label: 'BREW', icon: 'cauldron', subtitle: 'Mix remedies', description: 'Brew Health and Mana Potion packs from gathered ingredients.', message: 'Choose a potion recipe.' }
    ]
  },
  Blacksmith: {
    name: 'Blacksmith', title: 'BLACKSMITH', background: 'blacksmith', subtitle: 'Equipment and the forge.',
    choices: [
      { id: 'buy', label: 'BUY', icon: 'sword', subtitle: 'Browse gear', description: 'Buy stocked weapons and armor.', message: 'Choose gear.' },
      { id: 'sell', label: 'SELL', icon: 'satchel', subtitle: 'Sell any item', description: 'Sell owned gear, potions, materials, and scrolls. Unequip gear first.', message: 'Choose an owned item to sell.' },
      { id: 'craft', label: 'CRAFT', icon: 'anvil', subtitle: 'Visit the forge', description: 'Craft learned weapons, armor, and material components from gathered materials.', message: 'Choose a recipe.' }
    ]
  },
  Enchanter: {
    name: 'Enchanter', title: 'ENCHANTER', background: 'enchanter', subtitle: 'Arcane improvements and magical wares.',
    choices: [
      { id: 'buy', label: 'BUY', icon: 'scroll', subtitle: 'Attribute scrolls', description: 'Buy attribute scrolls. Buying a scroll teaches its inscription recipe.' },
      { id: 'sell', label: 'SELL', icon: 'satchel', subtitle: 'Sell any item', description: 'Sell gear, potions, materials, and scrolls. Unequip gear first.' },
      { id: 'inscribe', label: 'INSCRIBE', icon: 'scroll', subtitle: 'Craft scrolls', description: 'Inscribe learned attribute scroll recipes from materials and Gold.' },
      { id: 'enchant', label: 'ENCHANT', icon: 'rune', subtitle: 'Improve gear', description: 'Consume a scroll to apply one minor enchantment to compatible gear.' },
      { id: 'disenchant', label: 'DISENCHANT', icon: 'rune', subtitle: 'Recover materials', description: 'Remove a known enchantment, keep the gear, and recover a random half of its recipe materials.' }
    ]
  }
};

const DETAIL_THEMES = {
  Alchemist: { plaque: 'town-sign-alchemist', edge: 0x9fbd78, button: 0x315b3e, face: 0x20382e, text: '#eff9d7' },
  Blacksmith: { plaque: 'town-sign-blacksmith', edge: 0xd58b55, button: 0x593728, face: 0x272b2c, text: '#fff0d8', square: true },
  Enchanter: { plaque: 'town-sign-enchanter', edge: 0xb69ada, button: 0x463663, face: 0x28243b, text: '#f3eaff' }
};

export function renderFacilityMenu(scene, facility, selected, onSelect, onReturn, onClose, renderDetail) {
  scene.selectionDetailsClose?.();
  scene.children.removeAll(true);
  const { width, height } = scene.scale;
  const choice = facility.choices.find((entry) => entry.id === selected);
  scene.cameras.main.setBackgroundColor('#1b0e09');
  const background = scene.add.image(width / 2, height / 2, facility.background);
  background.setScale(Math.max(width / background.width, height / background.height));
  scene.add.rectangle(width / 2, height / 2, width, height, 0x120904, 0.08);
  scene.add.rectangle(width / 2, 0, width, UI_SAFE_TOP + 152, 0x180d09, 0.84).setOrigin(0.5, 0);
  scene.add.rectangle(width / 2, height, width, 320, 0x180d09, 0.78).setOrigin(0.5, 1);

  addFacilityReturnButton(scene, facility.name, onReturn,
    { y: UI_SAFE_TOP + 32 });
  scene.add.text(width / 2, UI_SAFE_TOP + 24, facility.title, {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('display70'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2',
    stroke: '#241008', strokeThickness: 4
  }).setOrigin(0.5);
  scene.add.text(width / 2, UI_SAFE_TOP + 91, facility.subtitle, {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body31'), color: '#f4d5ab'
  }).setOrigin(0.5);
  scene.add.text(width - 72, UI_SAFE_TOP + 32, `${GameState.gold} GOLD`, {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body34'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fbbf24'
  }).setOrigin(1, 0.5);

  let panelBounds = choice && renderDetail?.(choice);
  if (choice && !panelBounds) {
    const panelWidth = Math.min(1380, width - 300);
    addWoodenPanel(scene, width / 2, 535, panelWidth, 280);
    panelBounds = { x: width / 2, y: 535, width: panelWidth, height: 280 };
    scene.add.text(width / 2, 469, choice.label, {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('heading48'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2'
    }).setOrigin(0.5);
    scene.add.text(width / 2, 554, choice.message, {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body37'), color: '#f1dfca', align: 'center',
      wordWrap: { width: panelWidth - 100 }
    }).setOrigin(0.5);
  }

  if (choice) {
    const x = panelBounds.x + panelBounds.width / 2 - 46;
    const y = panelBounds.y - panelBounds.height / 2 + 46;
    const { art } = addFacilityPlate(scene, facility.name, x, y, 76, 76);
    const close = scene.add.rectangle(x, y, 76, 76, 0, 0).setName('facility-close').setInteractive({ useHandCursor: true });
    close.pressVisuals = [art];
    const label = scene.add.text(x, y, 'X', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('heading42'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2'
    }).setOrigin(0.5);
    bindButtonPress(scene, close, [label], () => { HapticsService.tap(); onClose(); });
  }

  const cardWidth = Math.min(600, (width - 280) / facility.choices.length);
  const gap = 28;
  const firstX = width / 2 - (cardWidth + gap) * (facility.choices.length - 1) / 2;
  const cardY = height - 151;
  facility.choices.forEach((entry, index) => {
    const x = firstX + index * (cardWidth + gap);
    const active = selected === entry.id;
    const card = addFacilityChoiceCard(scene, facility.name, entry, x, cardY, cardWidth, active);
    bindSelectionDetails(scene, card, { title: entry.label, description: entry.description, shopTheme: DETAIL_THEMES[facility.name] }, () => {
      HapticsService.tap();
      onSelect(entry.id);
    });
  });
  if (!choice) addFacilityDetailsHint(scene, facility.name, height - 42);
}
