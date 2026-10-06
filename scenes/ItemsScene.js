import Phaser from 'phaser';
import { ownedEquipment, equipmentOwner, equipmentStatsText } from '../game/Equipment.js';
import { HALL, hallText, hallPanel, hallButton, hallDetails, hallIcon, addHallFrame } from '../ui/HallUI.js';
import GameState from '../game/GameState.js';
import { ENCHANTMENTS } from '../data/enchantments.js';
import { CRAFTING_MATERIALS, CRAFTING_RECIPES, getPotionDefinition } from '../data/items.js';
import { canCraft, recipeIngredientText } from '../game/Crafting.js';
import { guildSurface } from '../ui/GuildHallTheme.js';
import { UI_FONT_SIZES } from '../config/uiTypography.js';

const CATEGORIES = [
  { id: 'equipment', label: 'Equipment', icon: 'sword' },
  { id: 'items', label: 'Supplies', icon: 'scroll' },
  { id: 'potions', label: 'Potion packs', icon: 'flask' },
  { id: 'materials', label: 'Materials', icon: 'ingot' },
  { id: 'recipes', label: 'Recipes', icon: 'satchel' }
];

export default class ItemsScene extends Phaser.Scene {
  constructor() { super('ItemsScene'); }

  create() {
    this.category ??= 'equipment';
    this.page ??= 0;
    this.render();
  }

  render() {
    this.selectionDetailsClose?.();
    this.children.removeAll(true);
    addHallFrame(this, 'Items');
    hallPanel(this, 272, 638, 440, 736);
    hallPanel(this, 1431, 638, 1834, 736);
    hallText(this, 76, 321, 'Categories', 36, { fontStyle: 'bold' });
    CATEGORIES.forEach(({ id, label, icon }, index) => {
      const y = 426 + index * 126;
      hallButton(this, 272, y, 388, 112, label, () => {
        this.category = id; this.page = 0; this.render();
      }, { selected: id === this.category, name: `hall-category-${id}`, size: 32, textStyle: { padding: { left: 40 } } });
      hallIcon(this, icon, 116, y);
    });
    const rows = this.rows();
    const pages = Math.max(1, Math.ceil(rows.length / 4));
    this.page = Math.max(0, Math.min(this.page, pages - 1));
    hallText(this, 550, 321, CATEGORIES.find((category) => category.id === this.category).label, 40, { fontFamily: 'Georgia' });
    hallText(this, 2310, 321, `${rows.length} ${this.category === 'recipes' ? 'recipes' : 'owned entries'}`, 29, { color: HALL.muted }).setOrigin(1, 0.5);
    if (!rows.length) hallText(this, 1425, 608, 'Nothing owned in this category yet.', 40, { color: HALL.muted }).setOrigin(0.5);
    rows.slice(this.page * 4, this.page * 4 + 4).forEach((item, index) => {
      const y = 429 + index * 138;
      const stats = this.category === 'materials' ? item.description
        : this.category === 'recipes' ? recipeIngredientText(item)
          : item.slot === 'scroll' ? ENCHANTMENTS.find((entry) => entry.id === item.enchantmentId)?.description ?? 'Enchantment scroll'
            : item.slot === 'potion' ? `${item.charges}/3 uses · ${getPotionDefinition(item.itemId)?.description ?? ''}`
              : equipmentStatsText(item.stats) || 'No bonuses';
      guildSurface(this, 1431, y, 1760, 126, 'row');
      const card = this.add.rectangle(1431, y, 1760, 126, 0, 0).setName(`hall-item-${item.id}`);
      hallDetails(this, card, { title: item.name, description: `${stats}${equipmentOwner(item.id) ? `\n\nEquipped by ${equipmentOwner(item.id).name}` : ''}` });
      hallIcon(this, this.category === 'materials' ? 'ingot' : this.category === 'recipes' ? 'scroll' : item.slot === 'weapon' ? 'sword' : item.slot === 'potion' ? 'flask' : item.slot === 'scroll' ? 'scroll' : 'shield', 606, y);
      hallText(this, 660, y - 29, item.name, 35, { fontStyle: 'bold', wordWrap: { width: 1170 } });
      hallText(this, 2265, y - 29, this.category === 'materials' ? `×${item.count}` : this.category === 'recipes' ? canCraft(item.id).ok ? 'Ready' : 'Gather materials' : equipmentOwner(item.id)?.name ?? 'Unequipped', UI_FONT_SIZES.itemOwner, {
        color: '#ffe0a7'
      }).setOrigin(1, 0.5);
      hallText(this, 660, y + 30, stats, UI_FONT_SIZES.itemSummary, { color: HALL.muted, wordWrap: { width: 1590 } });
    });
    hallButton(this, 1100, 950, 270, 112, 'Prev', () => { this.page--; this.render(); }, { enabled: this.page > 0 });
    hallText(this, 1431, 950, `${this.page + 1} / ${pages}`, 32).setOrigin(0.5);
    hallButton(this, 1760, 950, 270, 112, 'Next >', () => { this.page++; this.render(); }, { enabled: this.page < pages - 1 });
  }

  rows() {
    const owned = ownedEquipment();
    if (this.category === 'equipment') return owned.filter((item) => ['weapon', 'armor', 'accessory'].includes(item.slot));
    if (this.category === 'items') return owned.filter((item) => item.slot === 'scroll');
    if (this.category === 'potions') return owned.filter((item) => item.slot === 'potion');
    if (this.category === 'materials') return Object.entries(GameState.inventory.materials ?? {})
      .filter(([id, count]) => CRAFTING_MATERIALS[id] && count > 0).map(([id, count]) => ({ ...CRAFTING_MATERIALS[id], count }));
    return CRAFTING_RECIPES;
  }
}
