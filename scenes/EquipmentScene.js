import TownFeatureScene, { featurePanel, featureList, featureSelect, featureBody } from '../ui/TownFeatureUI.js';
import { characterSelector, selectedCharacter } from '../ui/CharacterSelection.js';
import { serviceText, serviceCard, serviceButton, serviceIcon, serviceScrollSurface, SERVICE_ICONS } from '../ui/TownServiceTheme.js';
import { hallScroll } from '../ui/HallUI.js';
import { ownedEquipment, equippedItem, equipmentOwner, canEquipItem, equipItem, unequipItem } from '../game/Equipment.js';
import { equipmentDetails } from '../game/EquipmentDescriptions.js';
import { ITEM_RARITIES } from '../data/items.js';
import { CHANCE_STATS } from '../config/characterProgression.js';
import { unifiedSpellBonuses } from '../game/SpellPower.js';
import { showSelectionDetails } from '../ui/SelectionDetails.js';

const SLOTS = ['weapon', 'armor', 'accessory', 'potion'];

export default class EquipmentScene extends TownFeatureScene {
  constructor() { super('EquipmentScene', true); }

  init(data) {
    this.slot = data?.slot ?? this.slot ?? 'weapon';
    this.itemId = data?.itemId ?? null;
  }

  render() {
    const hero = selectedCharacter();
    const b = this.frame('Equipment', 'equipment', { resource: hero ? `${hero.name} · Level ${hero.level}` : '',
      hint: 'Choose a slot, then compare compatible owned equipment. Green and red show direct bonus changes.' });
    characterSelector(this, { ...b, width: 440 }, () => {
      this.itemId = null; this.itemOffset = 0; this.compareOffset = 0; this.render();
    });
    if (!hero) return;
    this.slot ??= 'weapon';
    const loadout = { x: 520, y: b.y, width: 560, height: b.height };
    const storage = { x: 1108, y: b.y, width: 570, height: b.height };
    const detail = { x: 1706, y: b.y, width: b.width - 1654, height: b.height };
    [loadout, storage, detail].forEach(panel => featurePanel(this, panel));
    serviceText(this, loadout.x + 30, b.y + 28, 'Currently equipped', 'heading38');
    SLOTS.forEach((slot, index) => {
      const item = equippedItem(hero, slot), y = b.y + 100 + index * 143;
      const card = serviceCard(this, loadout.x + 280, y + 62, 504, 126, { selected: this.slot === slot, rarity: ITEM_RARITIES[item?.rarity]?.color });
      serviceIcon(this, SERVICE_ICONS[slot], loadout.x + 76, y + 67, 80);
      serviceText(this, loadout.x + 133, y + 12, slot.toUpperCase(), 'support28', { color: '#dfbf7a' });
      serviceText(this, loadout.x + 133, y + 48, item?.name ?? 'Empty slot', 'body32', { wordWrap: { width: 366 }, maxLines: 2 });
      featureSelect(this, loadout.x + 280, y + 62, 504, 126, () => {
        this.slot = slot; this.itemId = null; this.itemOffset = 0; this.compareOffset = 0; this.render();
      }, { name: `equipment-slot-${slot}`, visuals: [card] });
    });
    const current = equippedItem(hero, this.slot);
    serviceButton(this, loadout.x + 280, b.bottom - 58, 490, 82, 'Unequip selected slot', () => this.commit(unequipItem(hero.id, this.slot)),
      { enabled: Boolean(current), compact: true, slot: 'body30' });
    serviceText(this, storage.x + 28, b.y + 28, 'Swap Equipment', 'heading38', { wordWrap: { width: 510 } });
    const entries = ownedEquipment().filter(item => item.slot === this.slot && canEquipItem(hero, item));
    featureList(this, { x: storage.x + 24, y: b.y + 108, width: storage.width - 76, height: b.height - 142 }, entries,
      (item, x, y, width) => {
        const owner = equipmentOwner(item.id);
        const card = serviceCard(this, x + width / 2, y + 68, width, 128, { selected: item.id === this.itemId, rarity: ITEM_RARITIES[item.rarity]?.color });
        serviceText(this, x + 20, y + 14, item.name, 'body32', { wordWrap: { width: width - 40 }, maxLines: 2 });
        serviceText(this, x + 20, y + 93, owner ? `Equipped: ${owner.name}` : 'Available to equip', 'support28', { color: '#c6bdac', wordWrap: { width: width - 40 }, maxLines: 1 });
        featureSelect(this, x + width / 2, y + 68, width, 128, () => { this.itemId = item.id; this.compareOffset = 0; this.render(); },
          { name: `equipment-item-${item.id}`, visuals: [card] });
      }, { stride: 148, offset: this.itemOffset ?? 0, onScroll: value => { this.itemOffset = value; } });
    if (!entries.length) featureBody(this, { x: storage.x + 38, y: b.y + 140, width: storage.width - 100, height: b.height - 200 },
      'No owned items for this slot match this character’s class and level.');
    serviceText(this, detail.x + 28, b.y + 28, 'Equipment Comparison', 'heading38', { wordWrap: { width: detail.width - 60 } });
    const candidate = entries.find(item => item.id === this.itemId);
    if (!candidate) {
      featureBody(this, { x: detail.x + 35, y: b.y + 130, width: detail.width - 95, height: b.height - 190 },
        `Currently: ${current?.name ?? 'Empty slot'}\n\nSelect owned equipment to compare bonuses and inspect its requirements.`);
      return;
    }
    const before = unifiedSpellBonuses(current?.stats), after = unifiedSpellBonuses(candidate.stats);
    const deltas = [...new Set([...Object.keys(before), ...Object.keys(after)])].map(key => {
      const difference = (after[key] ?? 0) - (before[key] ?? 0);
      const scale = CHANCE_STATS.includes(key) ? 100 : 1;
      const format = value => `${Math.round(value * scale * 100) / 100}${scale === 100 ? '%' : ''}`;
      return { text: `${key.replace(/([A-Z])/g, ' $1')}\n${format(before[key] ?? 0)} → ${format(after[key] ?? 0)} (${difference > 0 ? '+' : ''}${format(difference)})`, difference };
    });
    const information = equipmentDetails(candidate, hero);
    const retained = new Set(this.children.list);
    let y = b.y + 125;
    const title = serviceText(this, detail.x + 34, y, candidate.name, 'body36', { wordWrap: { width: detail.width - 92 } });
    y += title.height + 22;
    const versus = serviceText(this, detail.x + 34, y, `Compared with: ${current?.name ?? 'Empty slot'}`, 'body30', { wordWrap: { width: detail.width - 92 }, color: '#c6bdac' });
    y += versus.height + 28;
    for (const delta of deltas) {
      const line = serviceText(this, detail.x + 34, y, delta.text, 'body30', {
        color: delta.difference > 0 ? '#83dfa5' : delta.difference < 0 ? '#f2a49e' : '#c6bdac', wordWrap: { width: detail.width - 92 }
      });
      y += line.height + 20;
    }
    const description = serviceText(this, detail.x + 34, y, information.description, 'body30', { wordWrap: { width: detail.width - 92 } });
    y += description.height + 20;
    const objects = this.children.list.filter(object => !retained.has(object));
    hallScroll(this, { x: detail.x + 28, y: b.y + 120, width: detail.width - 84, height: b.height - 420 }, objects, y - b.y - 120,
      this.compareOffset ?? 0, value => { this.compareOffset = value; }, serviceScrollSurface);
    const owner = equipmentOwner(candidate.id), same = current?.id === candidate.id;
    const reason = same ? 'Already equipped.' : owner && owner.id !== hero.id ? `Unequip from ${owner.name} first.` : 'Direct item bonuses; character stats use the existing equipment rules.';
    serviceText(this, detail.x + detail.width / 2, b.bottom - 161, reason, 'body30', { align: 'center', wordWrap: { width: detail.width - 84 } }).setOrigin(0.5);
    serviceButton(this, detail.x + detail.width / 2, b.bottom - 66, detail.width - 80, 80, 'Equip this item',
      () => this.commit(equipItem(hero.id, candidate.id)), { enabled: !same && (!owner || owner.id === hero.id) });
    serviceButton(this, detail.x + detail.width / 2, b.bottom - 250, detail.width - 80, 64, 'Full item details',
      () => showSelectionDetails(this, information), { compact: true, slot: 'body30' });
  }

}
