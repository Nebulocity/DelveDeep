import InventoryScene from '../ui/InventoryScene.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';
import GameState from '../game/GameState.js';
import { CLASS_DEFINITIONS } from '../data/classes.js';
import { EQUIPMENT_ITEMS, EQUIPMENT_BY_ID, ITEM_RARITIES, CRAFTING_MATERIALS, CRAFTING_RECIPES, equipmentDetails, equipmentStatsText, sellPrice } from '../data/items.js';
import { ownedEquipment, equipmentOwner, buyEquipment, sellEquipment, buyMaterial, sellMaterial, craftEquipment, craftingRequirements } from '../game/Equipment.js';
import { bindSelectionDetails } from '../ui/SelectionDetails.js';

export default class BlacksmithScene extends InventoryScene {
  constructor() { super('BlacksmithScene'); }

  create() {
    this.mode = 'buy';
    this.kind = 'equipment';
    this.classIndex = 0;
    this.rarity = 'all';
    this.page = 0;
    this.message = '';
    this.render();
  }

  change(field, value) {
    this[field] = value;
    this.page = 0;
    this.message = '';
    this.render();
  }

  render() {
    this.frame('BLACKSMITH', 'TownScene', 'TOWN');
    this.tabs([['buy', 'BUY'], ['sell', 'SELL'], ['craft', 'CRAFT']], this.mode, 155, (id) => this.change('mode', id));
    if (this.mode !== 'craft') {
      this.tabs([['equipment', 'Equipment'], ['materials', 'Materials']], this.kind, 250, (id) => this.change('kind', id), 70, 740);
    } else this.text(82, 250, 'Crafting supplies are sold under Buy.', 32, '#cbd5e1', 740);

    const classes = ['All classes', ...Object.keys(CLASS_DEFINITIONS)];
    const className = classes[this.classIndex];
    if (this.kind === 'equipment' || this.mode === 'craft') {
      this.button(1060, 250, 160, '<', () => this.change('classIndex', (this.classIndex + classes.length - 1) % classes.length));
      this.text(1565, 250, className, 38).setOrigin(0.5);
      this.button(2150, 250, 160, '>', () => this.change('classIndex', (this.classIndex + 1) % classes.length));
    }
    this.tabs([['all', 'All rarities'], ...Object.entries(ITEM_RARITIES).map(([id, rarity]) => [id, rarity.label])], this.rarity,
      345, (id) => this.change('rarity', id));

    let rows;
    if (this.mode === 'craft') rows = CRAFTING_RECIPES.map((recipe) => ({ item: EQUIPMENT_BY_ID[recipe.itemId], recipe }));
    else if (this.kind === 'materials') rows = Object.values(CRAFTING_MATERIALS)
      .filter((item) => this.mode === 'buy' || (GameState.inventory.materials?.[item.id] ?? 0) > 0).map((item) => ({ item, material: true }));
    else if (this.mode === 'buy') rows = EQUIPMENT_ITEMS.map((item) => ({ item }));
    else rows = ownedEquipment().map((instance) => ({ item: EQUIPMENT_BY_ID[instance.itemId], instance }));
    rows = rows.filter(({ item, material }) => (this.rarity === 'all' || item.rarity === this.rarity)
      && (material || this.classIndex === 0 || item.className === className));
    const start = this.pager(rows.length, 4, 'page', 1200, 927);
    if (!rows.length) this.text(1200, 610, 'No items match. Try another class or rarity.', 40, '#94a3b8').setOrigin(0.5);
    rows.slice(start, start + 4).forEach((row, index) => this.itemRow(row, 450 + index * 125));
  }

  itemRow({ item, instance, material, recipe }, y) {
    const rarity = ITEM_RARITIES[item.rarity];
    const owner = instance ? equipmentOwner(instance.id) : null;
    const card = this.add.rectangle(1200, y, 2260, 114, 0x1e293b).setStrokeStyle(2, 0x334155);
    const details = material ? { title: item.name, description: `${rarity.label} crafting material\n\n${item.description}\n\nBuy / sell: ${item.price} / ${sellPrice(item)} gold.` } : equipmentDetails(item);
    bindSelectionDetails(this, card, details);
    this.text(96, y - 32, item.name, 36, rarity.color);
    const stock = material ? GameState.inventory.materials?.[item.id] ?? 0 : ownedEquipment().filter((entry) => entry.itemId === item.id).length;
    this.text(790, y - 32, `${rarity.label} ${material ? 'material' : `${item.slot} / ${item.className}`}   |   Owned: ${stock}`, 30, '#cbd5e1');
    if (recipe) {
      const requirements = craftingRequirements(recipe);
      const ingredients = Object.entries(recipe.materials).map(([id, count]) => `${CRAFTING_MATERIALS[id].name} ${GameState.inventory.materials?.[id] ?? 0}/${count}`);
      if (recipe.equipment) ingredients.push(`${EQUIPMENT_BY_ID[recipe.equipment].name} ${requirements.ingredient ? 1 : 0}/1 (unequipped)`);
      if (recipe.gold) ingredients.push(`${recipe.gold}g`);
      this.text(96, y + 5, equipmentStatsText(item.stats), 28, '#cbd5e1');
      this.text(96, y + 38, ingredients.join('  +  '), 28, requirements.canCraft ? '#86efac' : '#fcd34d');
      this.button(2150, y, 300, 'CRAFT', () => showConfirmation(this, {
        title: 'Confirm crafting',
        description: `Craft 1 ${item.name}?\n\nConsumes: ${Object.entries(recipe.materials).map(([id, count]) => `${count} ${CRAFTING_MATERIALS[id].name}`).join(', ')}${recipe.equipment ? `, 1 unequipped ${EQUIPMENT_BY_ID[recipe.equipment].name}` : ''}.\n\nGold cost: ${recipe.gold}g.`,
        onConfirm: () => this.commit(craftEquipment(recipe.id))
      }), { enabled: requirements.canCraft, details });
    } else {
      this.text(96, y + 25, material ? item.description : `${equipmentStatsText(item.stats)}${owner ? `   |   Equipped: ${owner.name}` : instance ? '   |   Unequipped' : ''}`, 32, '#cbd5e1', 1840);
      if (this.mode === 'buy') this.button(2150, y, 300, `BUY ${item.price}g`, () => showConfirmation(this, {
        title: 'Confirm purchase', description: `Buy 1 ${item.name} for ${item.price} gold?\n\nCurrent gold: ${GameState.gold}`,
        onConfirm: () => this.commit(material ? buyMaterial(item.id) : buyEquipment(item.id))
      }), { enabled: GameState.gold >= item.price, details });
      else {
        this.button(2150, y, 300, owner ? 'EQUIPPED' : `SELL ${sellPrice(item)}g`, () => showConfirmation(this, {
          title: 'Confirm sale', description: `Sell 1 ${item.name} for ${sellPrice(item)} gold?\n\nThis item will be removed from your inventory.`,
          onConfirm: () => this.commit(material ? sellMaterial(item.id) : sellEquipment(instance.id))
        }), { enabled: !owner, details });
      }
    }
  }
}
