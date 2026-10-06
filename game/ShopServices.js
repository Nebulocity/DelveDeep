import GameState from './GameState.js';
import { EQUIPMENT_ITEMS, getPotionDefinition, getMaterialDefinition } from '../data/items.js';
import { ENCHANTMENT_BY_ID } from '../data/enchantments.js';
import { grantEquipment, equipmentOwner, sellMaterial, sellPotionPack } from './Equipment.js';

export const GEAR_STOCK = EQUIPMENT_ITEMS.map(item => ({ ...item, price: item.slot === 'armor' ? 100 : 80 }));

export function saleValue(item) {
  if (item.slot === 'potion') {
    const definition = getPotionDefinition(item.itemId);
    return definition ? Math.floor(definition.price * 0.5 * item.charges / definition.uses) : 0;
  }
  if (item.slot === 'scroll') return Math.floor((ENCHANTMENT_BY_ID[item.enchantmentId]?.price ?? 0) / 2);
  return Math.floor((GEAR_STOCK.find(entry => entry.id === item.itemId)?.price ?? 80) / 2);
}

export function saleRows(state = GameState) {
  return [
    ...state.inventory.equipment.map(item => ({ id: item.id, category: item.slot, name: item.name, description: equipmentOwner(item.id, state) ? `Equipped by ${equipmentOwner(item.id, state).name}. Unequip to sell.` : item.slot === 'potion' ? `${item.charges}/3 uses remaining` : 'One owned item', value: saleValue(item), enabled: !equipmentOwner(item.id, state), item })),
    ...Object.entries(state.inventory.materials ?? {}).filter(([, count]) => count > 0).map(([id, count]) => ({ id, category: 'material', name: getMaterialDefinition(id)?.name ?? id, description: `Owned: ${count} | Sell one at a time`, value: 5, enabled: true }))
  ];
}

export function sellOwnedItem(id, state = GameState) {
  const item = state.inventory.equipment.find(entry => entry.id === id);
  if (!item) return sellMaterial(id, 1, state);
  if (equipmentOwner(id, state)) return { ok: false, message: 'Unequip this item before selling it.' };
  if (item.slot === 'potion') return sellPotionPack(id, state);
  const value = saleValue(item);
  state.inventory.equipment = state.inventory.equipment.filter(entry => entry.id !== id);
  state.gold += value;
  return { ok: true, message: `Sold ${item.name} for ${value} Gold.` };
}

export function buyGear(id, state = GameState) {
  const stock = GEAR_STOCK.find(entry => entry.id === id);
  if (!stock || state.gold < stock.price) return { ok: false, message: 'Not enough Gold or item unavailable.' };
  const instance = grantEquipment(id, state);
  state.gold -= stock.price;
  return { ok: true, instance, message: `Bought ${stock.name}.` };
}

export function inscribeEnchantment(id, state = GameState, buy = false) {
  const definition = ENCHANTMENT_BY_ID[id];
  if (!definition) return { ok: false, message: 'Unknown enchantment.' };
  if (buy ? state.gold < definition.price : Object.entries(definition.ingredients).some(([key, count]) => (state.inventory.materials[key] ?? 0) < count)) return { ok: false, message: buy ? 'Not enough Gold.' : 'Need more materials.' };
  if (buy) state.gold -= definition.price;
  else for (const [key, count] of Object.entries(definition.ingredients)) {
    state.inventory.materials[key] -= count;
    if (!state.inventory.materials[key]) delete state.inventory.materials[key];
  }
  let next = state.inventory.nextEquipmentId ?? 1;
  while (state.inventory.equipment.some(item => item.id === `gear-${next}`)) next++;
  state.inventory.nextEquipmentId = next + 1;
  const instance = { id: `gear-${next}`, itemId: id, enchantmentId: id, name: `${definition.name} Scroll`, slot: 'scroll', rarity: 'common', stats: {} };
  state.inventory.equipment.push(instance);
  return { ok: true, instance, message: `${buy ? 'Bought' : 'Inscribed'} ${instance.name}.` };
}

export function applyEnchantment(scrollId, gearId, state = GameState) {
  const scroll = state.inventory.equipment.find(item => item.id === scrollId && item.slot === 'scroll');
  const gear = state.inventory.equipment.find(item => item.id === gearId);
  const definition = ENCHANTMENT_BY_ID[scroll?.enchantmentId];
  if (!definition || !gear || gear.enchantmentId || !definition.slots.includes(gear.slot)) return { ok: false, message: 'Choose compatible gear without an enchantment.' };
  gear.enchantmentId = definition.id;
  for (const [stat, amount] of Object.entries(definition.stats)) gear.stats[stat] = (gear.stats[stat] ?? 0) + amount;
  state.inventory.equipment = state.inventory.equipment.filter(item => item.id !== scrollId);
  return { ok: true, message: `${gear.name} enchanted with ${definition.name}.` };
}

export function disenchantItem(id, state = GameState, random = Math.random) {
  const item = state.inventory.equipment.find(entry => entry.id === id && entry.slot !== 'scroll');
  const definition = ENCHANTMENT_BY_ID[item?.enchantmentId];
  if (!definition) return { ok: false, message: 'This item has no known enchantment.' };
  const pool = Object.entries(definition.ingredients).flatMap(([key, count]) => Array(count).fill(key));
  const refunds = {};
  const count = Math.floor(pool.length / 2);
  for (let i = 0; i < count; i++) {
    const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
    const [key] = pool.splice(index, 1);
    refunds[key] = (refunds[key] ?? 0) + 1;
    state.inventory.materials[key] = (state.inventory.materials[key] ?? 0) + 1;
  }
  for (const [stat, amount] of Object.entries(definition.stats)) {
    item.stats[stat] = (item.stats[stat] ?? 0) - amount;
    if (!item.stats[stat]) delete item.stats[stat];
  }
  delete item.enchantmentId;
  return { ok: true, refunds, message: `Removed ${definition.name}. Returned ${Object.entries(refunds).map(([key, amount]) => `${amount} ${getMaterialDefinition(key).name}`).join(', ')}.` };
}
