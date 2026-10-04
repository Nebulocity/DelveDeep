import InventoryScene from '../ui/InventoryScene.js';
import { ownedEquipment, equipmentOwner, equipmentStatsText } from '../game/Equipment.js';
import { bindSelectionDetails } from '../ui/SelectionDetails.js';
import GameState from '../game/GameState.js';
import { CRAFTING_MATERIALS, getPotionDefinition } from '../data/items.js';

const CATEGORIES = [
  { id: 'armor', label: 'Armor' },
  { id: 'accessories', label: 'Accessories' },
  { id: 'items', label: 'Items' },
  { id: 'materials', label: 'Materials' },
  { id: 'potions', label: 'Potions' },
  { id: 'weapons', label: 'Weapons' }
];

export default class ItemsScene extends InventoryScene {
  constructor() { super('ItemsScene'); }

  create() {
    this.category = 'armor';
    this.page = 0;
    this.message = '';
    this.render();
  }

  render() {
    this.frame('ITEMS', 'AdventurersHallScene', "Adventurer's Hall");
    this.add.rectangle(315, 565, 550, 690, 0x21130d, 0.91).setStrokeStyle(3, 0x9b6b3b);
    this.add.rectangle(1510, 565, 1710, 690, 0x21130d, 0.91).setStrokeStyle(3, 0x9b6b3b);
    this.text(315, 265, 'CATEGORIES', 32, '#ffe0a7').setOrigin(0.5);
    CATEGORIES.forEach(({ id, label }, index) => this.button(315, 340 + index * 101, 490, label, () => {
      this.category = id;
      this.page = 0;
      this.render();
    }, { selected: id === this.category }));
    const slot = this.category === 'armor' ? 'armor' : this.category === 'weapons' ? 'weapon'
      : this.category === 'accessories' ? 'accessory' : this.category === 'potions' ? 'potion' : null;
    const rows = slot ? ownedEquipment().filter((item) => item.slot === slot)
      : this.category === 'materials' ? Object.entries(GameState.inventory.materials ?? {})
        .filter(([id, count]) => CRAFTING_MATERIALS[id] && count > 0)
        .map(([id, count]) => ({ ...CRAFTING_MATERIALS[id], count })) : [];
    const start = this.pager(rows.length, 4, 'page', 1510, 948);
    if (!rows.length) this.text(1510, 550, `No ${this.category} are available yet.`, 38, '#c7a982', 1500).setOrigin(0.5);
    rows.slice(start, start + 4).forEach((item, index) => {
      const y = 390 + index * 140;
      const card = this.add.rectangle(1510, y, 1650, 128, 0x302018, 0.95).setStrokeStyle(3, 0x9b6b3b);
      const stats = this.category === 'materials' ? item.description
        : slot === 'potion' ? `${item.charges}/3 uses  •  ${getPotionDefinition(item.itemId)?.description ?? 'Effect unknown'}`
          : equipmentStatsText(item.stats) || 'No bonuses';
      bindSelectionDetails(this, card, { title: item.name, description: stats });
      this.text(715, y - 31, item.name, 38, '#fff1d2', 1000);
      this.text(2300, y - 31, this.category === 'materials' ? `x${item.count}` : equipmentOwner(item.id)?.name ?? 'Unequipped', 30, '#ffe0a7').setOrigin(1, 0.5);
      this.text(715, y + 28, stats, 29, '#e8c89f', 1580);
    });
  }
}
