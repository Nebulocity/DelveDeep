import InventoryScene from '../ui/InventoryScene.js';
import GameState from '../game/GameState.js';
import { EQUIPMENT_BY_ID, ITEM_RARITIES, CRAFTING_MATERIALS, equipmentDetails, equipmentStatsText } from '../data/items.js';
import { ownedEquipment, equipmentOwner } from '../game/Equipment.js';
import { bindSelectionDetails, TONIC_DESCRIPTION } from '../ui/SelectionDetails.js';

const CATEGORIES = [
  { id: 'armor', label: 'Armor', description: 'All owned armor, including equipped pieces. Change loadouts on an adventurer’s character sheet.' },
  { id: 'items', label: 'Items', description: 'Healing Tonics are used in combat.' },
  { id: 'materials', label: 'Materials', description: 'Craft at the Blacksmith. Buy starter supplies there; delve material drops will come later.' },
  { id: 'weapons', label: 'Weapons', description: 'All owned weapons, including equipped pieces. Change loadouts on an adventurer’s character sheet.' },
  { id: 'void', label: 'Void', description: 'Void Keys open Void Portals from the world map.' }
];

export default class ItemsScene extends InventoryScene {
  constructor() { super('ItemsScene'); }

  create() { this.category = 'armor'; this.page = 0; this.message = ''; this.render(); }

  render() {
    this.frame('ITEMS', 'AdventurersHallScene', "Adventurer's Hall");
    this.add.rectangle(315, 565, 550, 690, 0x21130d, 0.91).setStrokeStyle(3, 0x9b6b3b);
    this.add.rectangle(1510, 565, 1710, 690, 0x21130d, 0.91).setStrokeStyle(3, 0x9b6b3b);
    this.text(315, 275, 'CATEGORIES', 32, '#ffe0a7').setOrigin(0.5);
    CATEGORIES.forEach(({ id, label }, index) => this.button(315, 360 + index * 112, 490, label, () => {
        this.category = id;
        this.page = 0;
        this.render();
      }, { selected: id === this.category }));
    this.text(700, 275, CATEGORIES.find(({ id }) => id === this.category)?.description ?? '', 32, '#e8c89f', 1610);
    let rows = [];
    if (this.category === 'items') {
      rows = [{ name: 'Healing Tonic', count: GameState.inventory.healingTonic, description: TONIC_DESCRIPTION }]
        .filter((row) => row.count > 0);
    } else if (this.category === 'void') {
      rows = [{ name: 'Void Key', count: GameState.inventory.voidKeys,
        description: 'Expedition item. Consumed when entering a Void Portal; not usable during battle.' }]
        .filter((row) => row.count > 0);
    } else if (this.category === 'materials') {
      rows = Object.entries(GameState.inventory.materials ?? {}).filter(([, count]) => count > 0).map(([id, count]) => {
        const item = CRAFTING_MATERIALS[id];
        return { name: item?.name ?? id, count, description: item?.description ?? 'Crafting material.', rarity: item?.rarity };
      });
    } else {
      rows = ownedEquipment().filter((instance) => EQUIPMENT_BY_ID[instance.itemId]?.slot === (this.category === 'armor' ? 'armor' : 'weapon'))
        .map((instance) => {
        const item = EQUIPMENT_BY_ID[instance.itemId];
        const owner = equipmentOwner(instance.id);
        return { name: item.name, rarity: item.rarity, description: `${item.className} ${item.slot}   |   ${equipmentStatsText(item.stats)}`,
          status: owner ? `Equipped by ${owner.name}` : 'Unequipped', details: equipmentDetails(item) };
      });
    }
    const start = this.pager(rows.length, 4, 'page', 1510, 948);
    if (!rows.length) this.text(1510, 550, this.category === 'items' ? 'No items owned. Buy Healing Tonics from the Quartermaster.'
      : this.category === 'void' ? 'No Void Keys owned. Clear delves to earn them.'
      : this.category === 'materials' ? 'No crafting materials owned. Visit the Blacksmith to buy supplies.'
        : `No ${this.category} owned. Buy or craft gear at the Blacksmith.`, 38, '#c7a982', 1500).setOrigin(0.5);
    rows.slice(start, start + 4).forEach((row, index) => {
      const y = 390 + index * 140;
      const card = this.add.rectangle(1510, y, 1650, 128, 0x302018, 0.95).setStrokeStyle(3, 0x9b6b3b);
      bindSelectionDetails(this, card, row.details ?? { title: row.name, description: row.description });
      const rarity = ITEM_RARITIES[row.rarity];
      this.text(715, y - 31, row.name, 38, rarity?.color ?? '#fff1d2', 1000);
      this.text(2300, y - 31, row.count != null ? `Owned: ${row.count}` : row.status, 30, '#ffe0a7').setOrigin(1, 0.5);
      this.text(715, y + 28, `${rarity ? rarity.label + '  |  ' : ''}${row.description}`, 29, '#e8c89f', 1580);
    });
  }
}
