// These are the facility action cards used before opening the item workspace. A facility
// supplies labels and callbacks; the shared builders handle placement and held details so
// all three shops behave consistently.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { bindSelectionDetails } from './SelectionDetails.js';
import { addFacilityReturnButton, addFacilityDetailsHint } from './FacilityChrome.js';
import { addFacilityChoiceCard } from './FacilityChoiceArt.js';
import { addWoodenPanel } from './WoodenPanel.js';

export const FACILITIES = {
  Alchemist: {
    name: 'Alchemist', title: 'ALCHEMIST', background: 'alchemist', subtitle: 'Potions, mixtures, and remedies.',
    choices: [
      { id: 'buy', label: 'BUY', icon: 'flask', subtitle: 'Browse potions', description: 'Buy three-use potion packs for your adventurers.', message: 'Choose a potion pack.' },

      {
        id: 'sell',
        label: 'SELL',
        icon: 'flask-sale',
        subtitle: 'Sell any item',
        description: 'Sell owned gear, potion packs, materials, and enchantment scrolls. Unequip gear first.',
        message: 'Choose an owned item to sell.'
      },

      {
        id: 'brew',
        label: 'BREW',
        icon: 'cauldron',
        subtitle: 'Mix remedies',
        description: 'Brew Health and Mana Potion packs from gathered ingredients.',
        message: 'Choose a potion recipe.'
      }
    ]
  },

  Blacksmith: {
    name: 'Blacksmith', title: 'BLACKSMITH', background: 'blacksmith', subtitle: 'Equipment and the forge.',
    choices: [
      { id: 'buy', label: 'BUY', icon: 'sword', subtitle: 'Browse gear', description: 'Buy stocked weapons and armor.', message: 'Choose gear.' },

      {
        id: 'sell',
        label: 'SELL',
        icon: 'satchel',
        subtitle: 'Sell any item',
        description: 'Sell owned gear, potions, materials, and scrolls. Unequip gear first.',
        message: 'Choose an owned item to sell.'
      },

      {
        id: 'craft',
        label: 'CRAFT',
        icon: 'anvil',
        subtitle: 'Visit the forge',
        description: 'Craft learned weapons, armor, and material components from gathered materials.',
        message: 'Choose a recipe.'
      }
    ]
  },

  Enchanter: {
    name: 'Enchanter', title: 'ENCHANTER', background: 'enchanter', subtitle: 'Arcane improvements and magical wares.',
    choices: [
      { id: 'buy', label: 'BUY', icon: 'scroll', subtitle: 'Attribute scrolls', description: 'Buy attribute scrolls. Buying a scroll teaches its inscription recipe.' },
      { id: 'sell', label: 'SELL', icon: 'satchel', subtitle: 'Sell any item', description: 'Sell gear, potions, materials, and scrolls. Unequip gear first.' },
      { id: 'inscribe', label: 'INSCRIBE', icon: 'scroll', subtitle: 'Craft scrolls', description: 'Inscribe learned attribute scroll recipes from materials and Gold.' },
      { id: 'enchant', label: 'ENCHANT', icon: 'rune', subtitle: 'Improve gear', description: 'Consume a scroll to apply one minor enchantment to compatible gear.' },

      {
        id: 'disenchant',
        label: 'DISENCHANT',
        icon: 'rune',
        subtitle: 'Recover materials',
        description: 'Remove a known enchantment, keep the gear, and recover a random half of its recipe materials.'
      }
    ]
  }
};

const DETAIL_THEMES = {
  Alchemist: { text: '#eff9d7' },
  Blacksmith: { text: '#fff0d8' },
  Enchanter: { text: '#f3eaff' }
};

// Build the selected facility's main action cards with tap actions and held descriptions.
export function renderFacilityMenu(scene, facility, selected, onSelect, onReturn, renderDetail) {

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  scene.selectionDetailsClose?.();
  scene.children.removeAll(true);

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { width, height } = scene.scale;

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const choice = facility.choices.find((entry) => entry.id === selected);
  scene.cameras.main.setBackgroundColor('#1b0e09');
  const background = scene.add.image(width / 2, height / 2, facility.background);

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  background.setScale(Math.max(width / background.width, height / background.height));
  scene.add.rectangle(width / 2, height / 2, width, height, 0x120904, 0.08);

  // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center and
  // 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
  // corner.
  scene.add.rectangle(width / 2, 0, width, 188, 0x180d09, 0.84).setOrigin(0.5, 0);
  scene.add.rectangle(width / 2, height, width, 150, 0x180d09, 0.78).setOrigin(0.5, 1);

  addFacilityReturnButton(scene, facility.name, onReturn,
    { y: 76 });
  scene.add.text(width / 2, 66, facility.title, {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('display70'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2',
    stroke: '#241008', strokeThickness: 4
  }).setOrigin(0.5);
  scene.add.text(width / 2, 133, facility.subtitle, {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body31'), color: '#f4d5ab'
  }).setOrigin(0.5);

  scene.add.text(width - 72, 76, `${GameState.gold} GOLD`, {
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

  const cardWidth = Math.min(600, (width - 280) / facility.choices.length);
  const gap = 28;
  const firstX = width / 2 - (cardWidth + gap) * (facility.choices.length - 1) / 2;
  const cardY = height - 79;
  facility.choices.forEach((entry, index) => {
    const x = firstX + index * (cardWidth + gap);
    const active = selected === entry.id;
    const card = addFacilityChoiceCard(scene, facility.name, entry, x, cardY, cardWidth, active, { height: 104, showSubtitle: false });
    bindSelectionDetails(scene, card, { title: entry.label, description: entry.description, shopTheme: DETAIL_THEMES[facility.name] }, () => {
      HapticsService.tap();
      onSelect(entry.id);
    });
  });

  if (!choice) addFacilityDetailsHint(scene, facility.name, height - 202);
}
