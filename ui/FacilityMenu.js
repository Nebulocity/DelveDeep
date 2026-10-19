// Merchant definitions stay shared; presentation lives in the Town service shell.
import { renderShopShell } from './ShopShell.js';

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
        description: 'Sell unequipped gear, potion packs, materials, and enchantment scrolls.',
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
        description: 'Sell unequipped gear, potions, materials, and scrolls.',
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
      { id: 'buy', label: 'BUY', icon: 'scroll', subtitle: 'Attribute scrolls', description: 'Buy attribute scrolls. Stocked scroll recipes are already known.' },
      { id: 'sell', label: 'SELL', icon: 'satchel', subtitle: 'Sell any item', description: 'Sell unequipped gear, potions, materials, and scrolls.' },
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


export function renderFacilityMenu(scene, facility, selected, onSelect, onReturn, renderDetail) {
  scene.selectionDetailsClose?.();

  // Destroy scroll containers as well as loose objects so old masks and input handlers
  // cannot survive a category, service or item change.
  for (const object of [...scene.children.list]) {
    if (object.active) object.destroy();
  }
  scene.shopBounds = renderShopShell(scene, facility, selected, onSelect, onReturn);
  const choice = facility.choices.find(entry => entry.id === selected);
  if (choice) renderDetail(choice);
}
