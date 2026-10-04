import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { bindSelectionDetails, addDetailsHint } from './SelectionDetails.js';
import { UI_SAFE_TOP } from './Layout.js';
import { addReturnButton } from './ReturnButton.js';
import { addFacilityChoiceCard } from './FacilityChoiceArt.js';

export const FACILITIES = {
  Alchemist: {
    name: 'Alchemist', title: 'ALCHEMIST', background: 'alchemist', subtitle: 'Potions, mixtures, and remedies.',
    choices: [
      { id: 'buy', label: 'BUY', icon: 'flask', subtitle: 'Browse potions', description: 'Buy three-use potion packs for your adventurers.', message: 'Choose a potion pack.' },
      { id: 'sell', label: 'SELL', icon: 'flask-sale', subtitle: 'Trade potions', description: 'Sell unequipped potion packs for Gold based on remaining uses.', message: 'Choose a potion pack to sell.' },
      { id: 'brew', label: 'BREW', icon: 'cauldron', subtitle: 'Mix remedies', description: 'Prepare remedies from ingredients when brewing recipes become available.', message: 'No brewing recipes are available yet.' }
    ]
  },
  Blacksmith: {
    name: 'Blacksmith', title: 'BLACKSMITH', background: 'blacksmith', subtitle: 'Equipment and the forge.',
    choices: [
      { id: 'buy', label: 'BUY', icon: 'sword', subtitle: 'Browse equipment', description: 'Browse equipment and crafting supplies when they become available.', message: 'No equipment or crafting supplies are stocked.' },
      { id: 'sell', label: 'SELL', icon: 'ingot', subtitle: 'Trade equipment', description: 'Sell spare equipment and materials when the inventory has stock.', message: 'You have no equipment or materials to sell.' },
      { id: 'craft', label: 'CRAFT', icon: 'anvil', subtitle: 'Visit the forge', description: 'Craft equipment when recipes and materials become available.', message: 'No crafting recipes are available.' }
    ]
  },
  Enchanter: {
    name: 'Enchanter', title: 'ENCHANTER', background: 'enchanter', subtitle: 'Arcane improvements and magical wares.',
    choices: [
      { id: 'buy', label: 'BUY', icon: 'scroll', subtitle: 'Browse scrolls', description: 'Browse enchanting scrolls when the enchanter has stock.', message: 'No scrolls are stocked yet.' },
      { id: 'sell', label: 'SELL', icon: 'scroll-sale', subtitle: 'Trade scrolls', description: 'Sell spare enchanting scrolls when the inventory has stock.', message: 'You have no scrolls to sell.' },
      { id: 'craft', label: 'CRAFT', icon: 'rune', subtitle: 'Inscribe scrolls', description: 'Craft scrolls to enchant gear when recipes become available.', message: 'No scroll recipes are available yet.' }
    ]
  }
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

  addReturnButton(scene, 'Town', onReturn,
    { y: UI_SAFE_TOP + 32 });
  scene.add.text(width / 2, UI_SAFE_TOP + 24, facility.title, {
    fontFamily: 'Arial', fontSize: '70px', fontStyle: 'bold', color: '#fff1d2',
    stroke: '#241008', strokeThickness: 4
  }).setOrigin(0.5);
  scene.add.text(width / 2, UI_SAFE_TOP + 91, facility.subtitle, {
    fontFamily: 'Arial', fontSize: '31px', color: '#f4d5ab'
  }).setOrigin(0.5);
  scene.add.text(width - 72, UI_SAFE_TOP + 32, `${GameState.gold} GOLD`, {
    fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#fbbf24'
  }).setOrigin(1, 0.5);

  let panelBounds = choice && renderDetail?.(choice);
  if (choice && !panelBounds) {
    const panelWidth = Math.min(1380, width - 300);
    scene.add.rectangle(width / 2, 535, panelWidth, 280, 0x21130d, 0.93).setStrokeStyle(4, 0xd9a662);
    panelBounds = { x: width / 2, y: 535, width: panelWidth, height: 280 };
    scene.add.text(width / 2, 469, choice.label, {
      fontFamily: 'Arial', fontSize: '48px', fontStyle: 'bold', color: '#fff1d2'
    }).setOrigin(0.5);
    scene.add.text(width / 2, 554, choice.message, {
      fontFamily: 'Arial', fontSize: '37px', color: '#f1dfca', align: 'center',
      wordWrap: { width: panelWidth - 100 }
    }).setOrigin(0.5);
  }

  if (choice) {
    const x = panelBounds.x + panelBounds.width / 2 - 46;
    const y = panelBounds.y - panelBounds.height / 2 + 46;
    const close = scene.add.rectangle(x, y, 76, 76, 0x6b4527)
      .setStrokeStyle(3, 0xd9a662).setInteractive({ useHandCursor: true });
    scene.add.text(x, y, 'X', {
      fontFamily: 'Arial', fontSize: '42px', fontStyle: 'bold', color: '#fff1d2'
    }).setOrigin(0.5);
    close.on('pointerdown', () => { HapticsService.tap(); onClose(); });
  }

  const cardWidth = Math.min(600, (width - 280) / facility.choices.length);
  const gap = 28;
  const firstX = width / 2 - (cardWidth + gap) * (facility.choices.length - 1) / 2;
  const cardY = height - 151;
  facility.choices.forEach((entry, index) => {
    const x = firstX + index * (cardWidth + gap);
    const active = selected === entry.id;
    const card = addFacilityChoiceCard(scene, facility.name, entry, x, cardY, cardWidth, active);
    bindSelectionDetails(scene, card, { title: entry.label, description: entry.description }, () => {
      HapticsService.tap();
      onSelect(entry.id);
    });
  });
  addDetailsHint(scene, height - 260);
}
