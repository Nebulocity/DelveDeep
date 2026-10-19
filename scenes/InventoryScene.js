import TownFeatureScene, { featurePanel, featureList, featureBody, featureSelect } from '../ui/TownFeatureUI.js';
import { serviceText, serviceCard, serviceButton, serviceIcon, SERVICE_ICONS } from '../ui/TownServiceTheme.js';
import { ownedEquipment, equipmentOwner, unequipItem } from '../game/Equipment.js';
import { equipmentDetails } from '../game/EquipmentDescriptions.js';
import { CRAFTING_RECIPES, ITEM_RARITIES, getMaterialDefinition } from '../data/items.js';
import { ENCHANTMENT_BY_ID } from '../data/enchantments.js';
import { canCraft, recipeIngredientText } from '../game/Crafting.js';
import { sortShopRows } from '../game/ShopServices.js';
import { selectCharacter } from '../ui/CharacterSelection.js';
import GameState from '../game/GameState.js';

const CATEGORIES = [['equipment', 'Equipment'], ['supplies', 'Supplies'], ['potions', 'Potion packs'], ['materials', 'Materials'], ['recipes', 'Recipes']];

export default class InventoryScene extends TownFeatureScene {
  constructor() { super('InventoryScene'); }

  rows() {
    const owned = ownedEquipment();
    if (this.category === 'equipment') return owned.filter(item => ['weapon', 'armor', 'accessory'].includes(item.slot));
    if (this.category === 'supplies') return owned.filter(item => item.slot === 'scroll');
    if (this.category === 'potions') return owned.filter(item => item.slot === 'potion');
    if (this.category === 'materials') return Object.entries(GameState.inventory.materials ?? {})
      .filter(([id, count]) => count > 0 && getMaterialDefinition(id)).map(([id, count]) => ({ ...getMaterialDefinition(id), id, count }));
    return CRAFTING_RECIPES;
  }

  render() {
    this.category ??= 'equipment';
    const b = this.frame('Inventory', 'items', { hint: 'Browse party storage. Select an entry to inspect ownership, requirements and available actions.' });
    const categories = { x: b.x, y: b.y, width: 330, height: b.height };
    const catalog = { x: 410, y: b.y, width: 1010, height: b.height };
    const detail = { x: 1448, y: b.y, width: b.width - 1396, height: b.height };
    [categories, catalog, detail].forEach(panel => featurePanel(this, panel));
    serviceText(this, categories.x + 30, b.y + 30, 'Party Storage', 'heading38');
    CATEGORIES.forEach(([key, label], index) => serviceButton(this, categories.x + 165, b.y + 142 + index * 119, 278, 94, label, () => {
      this.category = key; this.entryId = null; this.listOffset = 0; this.detailOffset = 0; this.render();
    }, { selected: key === this.category, compact: true, slot: 'body32' }));
    const entries = sortShopRows(this.rows());
    serviceText(this, catalog.x + 34, b.y + 30, `${CATEGORIES.find(([key]) => key === this.category)[1]} · ${entries.length} entries`, 'heading40');
    featureList(this, { x: catalog.x + 26, y: b.y + 102, width: catalog.width - 80, height: b.height - 138 }, entries,
      (item, x, y, width) => {
        const owner = equipmentOwner(item.id);
        const icon = this.category === 'recipes' ? 'shop-scroll' : this.category === 'materials' ? 'shop-material' : SERVICE_ICONS[item.slot] ?? 'town-hub-items';
        const card = serviceCard(this, x + width / 2, y + 80, width, 150, { selected: item.id === this.entryId, rarity: ITEM_RARITIES[item.rarity]?.color });
        serviceIcon(this, icon, x + 62, y + 80, 88);
        serviceText(this, x + 122, y + 14, item.name, 'body34', { wordWrap: { width: width - 148 }, maxLines: 2 });
        const status = this.category === 'recipes' ? canCraft(item.id).ok ? 'Ready to craft' : 'View requirements'
          : this.category === 'materials' ? `Owned: ${item.count}` : owner ? `Equipped by ${owner.name}` : 'In storage';
        serviceText(this, x + 122, y + 112, status, 'body30', { color: '#c6bdac', wordWrap: { width: width - 148 }, maxLines: 1 });
        featureSelect(this, x + width / 2, y + 80, width, 150, () => { this.entryId = item.id; this.detailOffset = 0; this.render(); },
          { name: `inventory-${item.id}`, visuals: [card] });
      }, { stride: 172, offset: this.listOffset ?? 0, onScroll: value => { this.listOffset = value; } });
    if (!entries.length) serviceText(this, catalog.x + catalog.width / 2, b.y + 260, 'Nothing owned in this category yet.', 'body34',
      { wordWrap: { width: catalog.width - 100 }, align: 'center' }).setOrigin(0.5);
    const item = entries.find(entry => entry.id === this.entryId);
    serviceText(this, detail.x + 36, b.y + 30, 'Inventory Details', 'heading40');
    if (!item) {
      featureBody(this, { x: detail.x + 40, y: b.y + 130, width: detail.width - 106, height: b.height - 200 }, 'Choose an item, material or recipe to view its full details.');
      return;
    }
    let description, crafter, action;
    const owner = equipmentOwner(item.id);
    if (this.category === 'recipes') {
      const check = canCraft(item.id);
      crafter = item.crafter ?? (item.category === 'alchemy' ? 'Alchemist' : item.output.type === 'scroll' ? 'Enchanter' : 'Blacksmith');
      const materials = Object.entries(item.ingredients).map(([id, needed]) => `${getMaterialDefinition(id)?.name ?? id}: ${GameState.inventory.materials[id] ?? 0} / ${needed}`).join('\n');
      description = `${item.name}\n\n${GameState.inventory.knownRecipes.includes(item.id) ? 'Recipe learned' : 'Recipe not learned'}\n\n${recipeIngredientText(item)}\n${item.fee ?? 0} Gold fee\n\nOwned / required\n${materials}\n\n${check.ok ? 'Ready to craft at the merchant.' : check.message}`;
      action = () => this.scene.start('MarketScene', { vendor: crafter,
        catalogAction: crafter === 'Alchemist' ? 'brew' : crafter === 'Enchanter' ? 'inscribe' : 'craft',
        itemId: crafter === 'Enchanter' ? item.output.itemId : item.id });
    } else if (this.category === 'materials') description = `${item.name}\n\nOwned: ${item.count}\n\n${item.description ?? ''}`;
    else if (item.slot === 'scroll') {
      const enchantment = ENCHANTMENT_BY_ID[item.enchantmentId];
      description = `${item.name}\n\n${enchantment?.description ?? 'Enchantment scroll'}\n\nCompatible slots: ${enchantment?.slots.join(', ') ?? 'None'}\nUse at the Enchanter.`;
      action = () => this.scene.start('MarketScene', { vendor: 'Enchanter', catalogAction: 'enchant' });
      crafter = 'Enchanter';
    } else description = `${item.name}\n\n${equipmentDetails(item).description}\n\nUsable by: ${equipmentDetails(item).usableBy.join(', ')}\n\n${owner ? `Equipped by ${owner.name}` : 'Unequipped, available in shared storage.'}`;
    featureBody(this, { x: detail.x + 38, y: b.y + 112, width: detail.width - 102, height: b.height - 340 }, description,
      this.detailOffset ?? 0, value => { this.detailOffset = value; });
    if (action) serviceButton(this, detail.x + detail.width / 2, b.bottom - 70, detail.width - 100, 88,
      `Visit ${crafter}`, action, { slot: 'body32' });
    else if (this.category !== 'materials') {
      serviceButton(this, detail.x + detail.width / 2, b.bottom - 70, detail.width - 100, 88, 'Manage equipment', () => {
        if (owner) selectCharacter(owner.id);
        this.scene.start('EquipmentScene', { slot: item.slot, itemId: item.id });
      });
      if (owner) serviceButton(this, detail.x + detail.width / 2, b.bottom - 175, detail.width - 100, 76, `Unequip from ${owner.name}`,
        () => this.commit(unequipItem(owner.id, item.slot), 'equipment'), { compact: true, slot: 'body30' });
    } else serviceText(this, detail.x + detail.width / 2, b.bottom - 102, 'Materials are used by merchants for crafting and inscription.', 'body32',
      { align: 'center', wordWrap: { width: detail.width - 100 } }).setOrigin(0.5);
  }
}
