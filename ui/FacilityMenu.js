import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { bindSelectionDetails, addDetailsHint } from './SelectionDetails.js';
import { UI_SAFE_TOP } from './Layout.js';
import { addReturnButton } from './ReturnButton.js';

export const FACILITIES = {
  Alchemist: {
    name: 'Alchemist', title: 'ALCHEMIST', background: 'alchemist', subtitle: 'Potions, mixtures, and remedies.',
    choices: [
      { id: 'buy', label: 'BUY', subtitle: 'Browse potions', description: 'Browse potions and alchemical supplies when they become available.', message: 'No potions or alchemical supplies are stocked yet.' },
      { id: 'sell', label: 'SELL', subtitle: 'Trade supplies', description: 'Trade spare potions and ingredients when alchemical stock is available.', message: 'You have no alchemical supplies to sell.' },
      { id: 'brew', label: 'BREW', subtitle: 'Mix remedies', description: 'Prepare remedies from ingredients when brewing recipes become available.', message: 'No brewing recipes are available yet.' }
    ]
  },
  Blacksmith: {
    name: 'Blacksmith', title: 'BLACKSMITH', background: 'blacksmith', subtitle: 'Equipment and the forge.',
    choices: [
      { id: 'buy', label: 'BUY', subtitle: 'Browse equipment', description: 'Browse equipment and crafting supplies when they become available.', message: 'No equipment or crafting supplies are stocked.' },
      { id: 'sell', label: 'SELL', subtitle: 'Trade equipment', description: 'Sell spare equipment and materials when the inventory has stock.', message: 'You have no equipment or materials to sell.' },
      { id: 'craft', label: 'CRAFT', subtitle: 'Visit the forge', description: 'Craft equipment when recipes and materials become available.', message: 'No crafting recipes are available.' }
    ]
  },
  Enchanter: {
    name: 'Enchanter', title: 'ENCHANTER', background: 'enchanter', subtitle: 'Arcane improvements and magical wares.',
    choices: [
      { id: 'enchant', label: 'ENCHANT', subtitle: 'Empower gear', description: 'Improve equipment with enchantments when that service becomes available.', message: 'No enchantments are available yet.' },
      { id: 'buy', label: 'BUY', subtitle: 'Browse arcane wares', description: 'Browse magical goods when the enchanter has stock.', message: 'No arcane wares are stocked yet.' },
      { id: 'sell', label: 'SELL', subtitle: 'Trade arcane goods', description: 'Trade magical goods when the inventory has stock.', message: 'You have no arcane goods to sell.' }
    ]
  }
};

export function renderFacilityMenu(scene, facility, selected, onSelect, onReturn) {
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

  addReturnButton(scene, choice ? facility.name : 'Town', onReturn,
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

  if (choice) {
    const panelWidth = Math.min(1380, width - 300);
    scene.add.rectangle(width / 2, 535, panelWidth, 280, 0x21130d, 0.93).setStrokeStyle(4, 0xd9a662);
    scene.add.text(width / 2, 469, choice.label, {
      fontFamily: 'Arial', fontSize: '48px', fontStyle: 'bold', color: '#fff1d2'
    }).setOrigin(0.5);
    scene.add.text(width / 2, 554, choice.message, {
      fontFamily: 'Arial', fontSize: '37px', color: '#f1dfca', align: 'center',
      wordWrap: { width: panelWidth - 100 }
    }).setOrigin(0.5);
  }

  const cardWidth = Math.min(600, (width - 280) / facility.choices.length);
  const gap = 28;
  const firstX = width / 2 - (cardWidth + gap) * (facility.choices.length - 1) / 2;
  const cardY = height - 151;
  facility.choices.forEach((entry, index) => {
    const x = firstX + index * (cardWidth + gap);
    const active = selected === entry.id;
    const card = scene.add.rectangle(x, cardY, cardWidth, 150, active ? 0x6b4527 : 0x3a2013, 0.94)
      .setStrokeStyle(4, active ? 0xffd58e : 0xd9a662).setInteractive({ useHandCursor: true });
    scene.add.text(x, cardY - 24, entry.label, {
      fontFamily: 'Arial', fontSize: '42px', fontStyle: 'bold', color: '#fff1d2'
    }).setOrigin(0.5);
    scene.add.text(x, cardY + 35, entry.subtitle, {
      fontFamily: 'Arial', fontSize: '27px', color: '#e8c89f', align: 'center',
      wordWrap: { width: cardWidth - 36 }
    }).setOrigin(0.5);
    bindSelectionDetails(scene, card, { title: entry.label, description: entry.description }, () => {
      HapticsService.tap();
      onSelect(entry.id);
    });
  });
  addDetailsHint(scene, height - 260);
}
