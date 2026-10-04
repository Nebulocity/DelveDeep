import GameState from './GameState.js';
import { getEquipmentDefinition, getMaterialDefinition, getPotionDefinition } from '../data/items.js';

export const EQUIPMENT_SLOTS = ['weapon', 'armor', 'accessory', 'potion'];
export const EQUIPMENT_SCHEMA_VERSION = 1;

export function ownedEquipment(state = GameState) {
  return state.inventory.equipment ?? [];
}

function nextInstanceId(state) {
  const owned = ownedEquipment(state);
  let next = Number.isSafeInteger(state.inventory.nextEquipmentId) && state.inventory.nextEquipmentId > 0
    ? state.inventory.nextEquipmentId : 1;
  while (owned.some((entry) => entry.id === `gear-${next}`)) next += 1;
  state.inventory.nextEquipmentId = next + 1;
  return `gear-${next}`;
}

export function grantEquipment(itemId, state = GameState) {
  const definition = getEquipmentDefinition(itemId);
  if (!definition) return null;
  const instance = {
    id: nextInstanceId(state),
    itemId: definition.id,
    name: definition.name,
    slot: definition.slot,
    rarity: definition.rarity,
    usableBy: [...definition.usableBy],
    stats: { ...definition.stats }
  };
  state.inventory.equipment.push(instance);
  return instance;
}

export function grantPotionPack(itemId, state = GameState) {
  const definition = getPotionDefinition(itemId);
  if (!definition) return null;
  const instance = {
    id: nextInstanceId(state),
    itemId: definition.id,
    name: definition.name,
    slot: 'potion',
    rarity: definition.rarity,
    charges: definition.uses,
    stats: {}
  };
  state.inventory.equipment.push(instance);
  return instance;
}

export function buyPotionPack(itemId, state = GameState) {
  const definition = getPotionDefinition(itemId);
  if (!definition) return { ok: false, message: 'That potion is not stocked.' };
  if (state.gold < definition.price) return { ok: false, message: `You need ${definition.price} Gold for ${definition.name}.` };
  const instance = grantPotionPack(itemId, state);
  state.gold -= definition.price;
  return { ok: true, instance, message: `Bought ${definition.name} (${definition.uses} uses).` };
}

export function sellPotionPack(instanceId, state = GameState) {
  const item = ownedEquipment(state).find((entry) => entry.id === instanceId && entry.slot === 'potion');
  const definition = getPotionDefinition(item?.itemId);
  if (!item || !definition) return { ok: false, message: 'That potion pack is unavailable.' };
  if (equipmentOwner(instanceId, state)) return { ok: false, message: 'Unequip this potion pack before selling it.' };
  const value = Math.floor(definition.price * 0.5 * item.charges / definition.uses);
  state.inventory.equipment = state.inventory.equipment.filter((entry) => entry.id !== instanceId);
  state.gold += value;
  return { ok: true, amount: value, message: `Sold ${definition.name} for ${value} Gold.` };
}

export function grantMaterial(materialId, amount = 1, state = GameState) {
  if (!getMaterialDefinition(materialId) || !Number.isSafeInteger(amount) || amount <= 0) return false;
  const current = state.inventory.materials?.[materialId] ?? 0;
  if (!Number.isSafeInteger(current) || current < 0 || !Number.isSafeInteger(current + amount)) return false;
  state.inventory.materials ??= {};
  state.inventory.materials[materialId] = current + amount;
  return true;
}

export function equipmentOwner(instanceId, state = GameState) {
  return state.roster.find((hero) => EQUIPMENT_SLOTS.some((slot) => hero.equipment?.[slot] === instanceId));
}

export function canEquipItem(hero, item) {
  return hero && item && EQUIPMENT_SLOTS.includes(item.slot)
    && (item.slot === 'potion'
      ? Number.isInteger(item.charges) && item.charges > 0 && item.charges <= 3
        && (getPotionDefinition(item.itemId)?.effect.resource !== 'mana' || hero.maxMana > 0)
      : item.className === hero.className || item.usableBy?.includes(hero.className));
}

export function equippedItem(hero, slot, state = GameState) {
  if (!EQUIPMENT_SLOTS.includes(slot)) return null;
  const item = ownedEquipment(state).find((entry) => entry.id === hero.equipment?.[slot]);
  return item?.slot === slot && canEquipItem(hero, item) ? item : null;
}

export function consumePotionCharge(heroId, state = GameState) {
  const hero = state.roster.find((entry) => entry.id === heroId);
  const item = hero && equippedItem(hero, 'potion', state);
  if (!item || !getPotionDefinition(item.itemId)) return false;
  item.charges -= 1;
  if (item.charges === 0) {
    state.inventory.equipment = state.inventory.equipment.filter((entry) => entry.id !== item.id);
    hero.equipment.potion = null;
  }
  return true;
}

export function getEquippedAdventurer(hero, state = GameState) {
  const result = { ...hero };
  for (const slot of EQUIPMENT_SLOTS) {
    if (slot === 'potion') continue;
    const item = equippedItem(hero, slot, state);
    for (const [stat, bonus] of Object.entries(item?.stats ?? {})) {
      if (Number.isFinite(bonus)) result[stat] = (result[stat] ?? 0) + bonus;
    }
  }
  return result;
}

export function equipmentStatsText(stats = {}) {
  const labels = { maxHp: 'HP', attackPower: 'Attack', healPower: 'Healing', armor: 'Armor' };
  return Object.entries(stats).filter(([, value]) => Number.isFinite(value)).map(([key, value]) =>
    key === 'armor' ? `+${Math.round(value * 100)}% Armor` : `+${value} ${labels[key] ?? key}`
  ).join('  / ');
}

export function equipItem(heroId, instanceId, state = GameState) {
  const hero = state.roster.find((entry) => entry.id === heroId);
  const item = ownedEquipment(state).find((entry) => entry.id === instanceId);
  if (!canEquipItem(hero, item)) return { ok: false, message: 'This character cannot use that equipment.' };
  const owner = equipmentOwner(instanceId, state);
  if (owner && owner.id !== heroId) return { ok: false, message: `Unequip this item from ${owner.name} first.` };
  hero.equipment ??= { weapon: null, armor: null, accessory: null, potion: null };
  hero.equipment[item.slot] = instanceId;
  return { ok: true, message: `${hero.name} equipped ${item.name}.` };
}

export function unequipItem(heroId, slot, state = GameState) {
  const hero = state.roster.find((entry) => entry.id === heroId);
  if (!hero || !EQUIPMENT_SLOTS.includes(slot) || !hero.equipment?.[slot]) return { ok: false, message: 'That slot is empty.' };
  hero.equipment[slot] = null;
  return { ok: true, message: `${hero.name}'s ${slot} returned to equipment storage.` };
}

// Only the new empty-catalog schema can restore equipment. Old item IDs are discarded.
export function restoreEquipment(savedInventory, savedRoster, state = GameState) {
  const ids = new Set();
  state.inventory.equipment = savedInventory?.equipmentSchemaVersion === EQUIPMENT_SCHEMA_VERSION
    ? (Array.isArray(savedInventory.equipment) ? savedInventory.equipment : []).filter((item) => {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)
        || typeof item.name !== 'string' || !EQUIPMENT_SLOTS.includes(item.slot)
        || (item.slot === 'potion'
          ? !Number.isInteger(item.charges) || item.charges < 1 || item.charges > 3
          : typeof item.className !== 'string' && !Array.isArray(item.usableBy))) return false;
      ids.add(item.id);
      return true;
    }).map((item) => ({
      id: item.id, name: item.slot === 'potion' ? getPotionDefinition(item.itemId)?.name ?? item.name : item.name, slot: item.slot,
      itemId: typeof item.itemId === 'string' ? item.itemId : undefined,
      rarity: typeof item.rarity === 'string' ? item.rarity : undefined,
      className: item.className,
      usableBy: Array.isArray(item.usableBy) ? item.usableBy.filter((name) => typeof name === 'string') : undefined,
      charges: item.slot === 'potion' ? item.charges : undefined,
      stats: Object.fromEntries(Object.entries(item.stats ?? {}).filter(([, value]) => Number.isFinite(value)))
    })) : [];
  state.inventory.equipmentSchemaVersion = EQUIPMENT_SCHEMA_VERSION;
  state.inventory.nextEquipmentId = Number.isSafeInteger(savedInventory?.nextEquipmentId) && savedInventory.nextEquipmentId > 0
    ? savedInventory.nextEquipmentId : 1;
  const assigned = new Set();
  for (const hero of state.roster) {
    hero.equipment = { weapon: null, armor: null, accessory: null, potion: null };
    for (const slot of EQUIPMENT_SLOTS) {
      const id = savedRoster.get(hero.id)?.equipment?.[slot];
      const item = state.inventory.equipment.find((entry) => entry.id === id);
      if (!item || item.slot !== slot || !canEquipItem(hero, item) || assigned.has(id)) continue;
      hero.equipment[slot] = id;
      assigned.add(id);
    }
  }
}
