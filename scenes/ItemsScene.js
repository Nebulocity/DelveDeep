import InventoryScene from '../ui/InventoryScene.js';
import GameState from '../game/GameState.js';
import { EQUIPMENT_BY_ID, ITEM_RARITIES, CRAFTING_MATERIALS, equipmentDetails, equipmentStatsText } from '../data/items.js';
import { ownedEquipment, equipmentOwner } from '../game/Equipment.js';
import { bindSelectionDetails, TONIC_DESCRIPTION } from '../ui/SelectionDetails.js';

export default class ItemsScene extends InventoryScene {
  constructor() { super('ItemsScene'); }

  create() { this.category = 'battle'; this.page = 0; this.message = ''; this.render(); }

  render() {
    this.frame('ITEMS', 'AdventurersHallScene', 'HALL');
    this.tabs([['battle', 'Battle Items'], ['materials', 'Crafting Material'], ['equipment', 'Equipment']], this.category, 155,
      (id) => { this.category = id; this.page = 0; this.render(); });
    this.text(80, 250, this.category === 'equipment' ? 'All owned equipment, including items in use. Change loadouts in Equipment.'
      : this.category === 'materials' ? 'Craft at the Blacksmith. Buy starter supplies there; delve material drops will come later.'
        : 'Tonics are used in combat. Void Keys open Void Portals from the world map.', 34, '#cbd5e1', 2200);
    let rows = [];
    if (this.category === 'battle') {
      rows = [
        { name: 'Healing Tonic', count: GameState.inventory.healingTonic, description: TONIC_DESCRIPTION },
        { name: 'Void Key', count: GameState.inventory.voidKeys, description: 'Expedition item. Consumed when entering a Void Portal; not usable during battle.' }
      ].filter((row) => row.count > 0);
    } else if (this.category === 'materials') {
      rows = Object.entries(GameState.inventory.materials ?? {}).filter(([, count]) => count > 0).map(([id, count]) => {
        const item = CRAFTING_MATERIALS[id];
        return { name: item?.name ?? id, count, description: item?.description ?? 'Crafting material.', rarity: item?.rarity };
      });
    } else {
      rows = ownedEquipment().map((instance) => {
        const item = EQUIPMENT_BY_ID[instance.itemId];
        const owner = equipmentOwner(instance.id);
        return { name: item.name, rarity: item.rarity, description: `${item.className} ${item.slot}   |   ${equipmentStatsText(item.stats)}`,
          status: owner ? `Equipped by ${owner.name}` : 'Unequipped', details: equipmentDetails(item) };
      });
    }
    const start = this.pager(rows.length, 4, 'page', 1200, 927);
    if (!rows.length) this.text(1200, 550, this.category === 'battle' ? 'No battle items owned. Buy Healing Tonics from the Quartermaster.'
      : this.category === 'materials' ? 'No crafting materials owned. Visit the Blacksmith to buy supplies.'
        : 'No equipment owned. Buy or craft gear at the Blacksmith.', 38, '#94a3b8', 2000).setOrigin(0.5);
    rows.slice(start, start + 4).forEach((row, index) => {
      const y = 378 + index * 145;
      const card = this.add.rectangle(1200, y, 2260, 130, 0x1e293b).setStrokeStyle(2, 0x334155);
      bindSelectionDetails(this, card, row.details ?? { title: row.name, description: row.description });
      const rarity = ITEM_RARITIES[row.rarity];
      this.text(100, y - 31, row.name, 40, rarity?.color ?? '#f8fafc');
      this.text(2220, y - 31, row.count != null ? `Owned: ${row.count}` : row.status, 32, '#cbd5e1').setOrigin(1, 0.5);
      this.text(100, y + 28, `${rarity ? rarity.label + '  |  ' : ''}${row.description}`, 30, '#cbd5e1', 2110);
    });
  }
}
