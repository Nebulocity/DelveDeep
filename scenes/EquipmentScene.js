import InventoryScene from '../ui/InventoryScene.js';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { EQUIPMENT_BY_ID, ITEM_RARITIES, equipmentDetails, equipmentStatsText } from '../data/items.js';
import { ownedEquipment, equipmentOwner, equippedItem, getEquippedAdventurer, equipItem, unequipItem } from '../game/Equipment.js';
import { bindSelectionDetails, characterDetails } from '../ui/SelectionDetails.js';

export default class EquipmentScene extends InventoryScene {
  constructor() { super('EquipmentScene'); }

  create() {
    this.role = 'all';
    this.heroId = GameState.roster[0]?.id;
    this.slot = 'weapon';
    this.heroPage = 0;
    this.itemPage = 0;
    this.message = '';
    this.render();
  }

  render() {
    this.frame('EQUIPMENT', 'AdventurersHallScene', 'HALL');
    this.tabs([['all', 'All roles'], ['Tank', 'Tanks'], ['Healer', 'Healers'], ['Melee DPS', 'Melee'], ['Ranged DPS', 'Ranged']],
      this.role, 155, (role) => {
        this.role = role; this.heroPage = 0; this.itemPage = 0;
        this.heroId = GameState.roster.find((hero) => role === 'all' || hero.role === role)?.id;
        this.message = ''; this.render();
      });
    const heroes = GameState.roster.filter((hero) => this.role === 'all' || hero.role === this.role);
    const start = this.pager(heroes.length, 4, 'heroPage', 355, 927, 570);
    heroes.slice(start, start + 4).forEach((hero, index) => {
      const y = 305 + index * 157;
      const selected = hero.id === this.heroId;
      const card = this.add.rectangle(355, y, 570, 138, selected ? 0x304966 : 0x1e293b)
        .setStrokeStyle(3, selected ? 0x93c5fd : 0x334155);
      this.add.circle(118, y - 18, 22, hero.color);
      this.text(162, y - 28, hero.name, 40);
      this.text(100, y + 26, `${hero.className}  /  Level ${hero.level}`, 32, '#cbd5e1');
      bindSelectionDetails(this, card, () => characterDetails(getEquippedAdventurer(hero)), () => {
        HapticsService.tap();
        this.heroId = hero.id; this.itemPage = 0; this.message = ''; this.render();
      });
    });
    const hero = GameState.roster.find((entry) => entry.id === this.heroId);
    if (!hero) return;
    this.text(735, 239, `${hero.name}  /  ${hero.className}`, 44, '#f8fafc');
    const stats = getEquippedAdventurer(hero);
    this.text(735, 295, `HP ${stats.maxHp}   |   Attack ${stats.attackPower}   |   Healing ${stats.healPower ?? 0}   |   Armor ${Math.round((stats.armor ?? 0) * 100)}%`, 32, '#cbd5e1');
    ['weapon', 'armor'].forEach((slot, index) => {
      const x = 1110 + index * 800;
      const item = equippedItem(hero, slot);
      const card = this.add.rectangle(x, 393, 750, 134, this.slot === slot ? 0x304966 : 0x1e293b)
        .setStrokeStyle(3, this.slot === slot ? 0x93c5fd : 0x475569);
      this.text(x - 347, 364, slot.toUpperCase(), 30, '#94a3b8');
      this.text(x - 347, 411, item?.name ?? 'Empty slot', 36, item ? ITEM_RARITIES[item.rarity].color : '#94a3b8');
      bindSelectionDetails(this, card, item ? equipmentDetails(item) : { title: slot, description: 'Choose an owned item from the list below.' }, () => {
        HapticsService.tap();
        this.slot = slot; this.itemPage = 0; this.render();
      });
      this.button(x, 511, 330, `UNEQUIP ${slot.toUpperCase()}`, () => this.commit(unequipItem(hero.id, slot)), { enabled: Boolean(item) });
    });
    this.text(735, 588, `Owned ${hero.className} ${this.slot}s - tap a slot above to switch`, 32, '#cbd5e1');
    const items = ownedEquipment().filter((instance) => {
      const item = EQUIPMENT_BY_ID[instance.itemId];
      return item.className === hero.className && item.slot === this.slot;
    });
    const offset = this.pager(items.length, 2, 'itemPage', 1530, 927, 700);
    if (!items.length) this.text(1530, 737, 'No matching equipment owned.\nBuy or craft gear at the Blacksmith.', 38, '#94a3b8', 1400).setOrigin(0.5);
    items.slice(offset, offset + 2).forEach((instance, index) => {
      const item = EQUIPMENT_BY_ID[instance.itemId];
      const owner = equipmentOwner(instance.id);
      const y = 693 + index * 142;
      const card = this.add.rectangle(1530, y, 1590, 124, 0x1e293b).setStrokeStyle(2, 0x334155);
      bindSelectionDetails(this, card, equipmentDetails(item));
      this.text(761, y - 30, item.name, 36, ITEM_RARITIES[item.rarity].color);
      this.text(761, y + 10, `${ITEM_RARITIES[item.rarity].label}  |  ${equipmentStatsText(item.stats)}`, 30, '#cbd5e1');
      this.text(761, y + 44, owner ? `Equipped by ${owner.name}` : 'Available', 28, '#94a3b8');
      this.button(2160, y, 280, owner ? 'IN USE' : 'EQUIP', () => this.commit(equipItem(hero.id, instance.id)), { enabled: !owner, details: equipmentDetails(item) });
    });
  }
}
