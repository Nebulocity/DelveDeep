import { ATTRIBUTE_STATS, CHANCE_STATS } from '../config/characterProgression.js';
import GameState from './GameState.js';
import { characterStats, rebuildCharacterStats } from './CharacterStats.js';
import { ENCHANTMENT_BY_ID } from '../data/enchantments.js';
import { getEquipmentDefinition, getMaterialDefinition, getPotionDefinition } from '../data/items.js';

export const EQUIPMENT_SLOTS = ['weapon', 'armor', 'accessory', 'potion'];
export const EQUIPMENT_SCHEMA_VERSION = 2;
const LEGACY_ITEM_IDS = {
  'field-blade': 'BLS01', 'trail-bow': 'PBR01', 'apprentice-focus': 'PST01',
  'pilgrim-staff': 'PST01', 'padded-vest': 'PV01', 'iron-guard': 'PV01'
};

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

export function grantEnchantmentScroll(itemId, state = GameState) {
  const definition = ENCHANTMENT_BY_ID[itemId];
  if (!definition) return null;
  const instance = {
    id: nextInstanceId(state),
    itemId,
    enchantmentId: itemId,
    name: `${definition.name} Scroll`,
    slot: 'scroll',
    rarity: 'uncommon',
    usableBy: ['All'],
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

export function sellMaterial(materialId, amount = 1, state = GameState) {
  const definition = getMaterialDefinition(materialId);
  const owned = state.inventory.materials?.[materialId] ?? 0;
  if (!definition || !Number.isSafeInteger(amount) || amount <= 0 || owned < amount) return { ok: false, message: 'You do not have enough of that material.' };
  const value = amount * (definition.sellPrice ?? 0);
  state.inventory.materials[materialId] -= amount;
  if (!state.inventory.materials[materialId]) delete state.inventory.materials[materialId];
  state.gold += value;
  return { ok: true, amount: value, message: `Sold ${amount} ${definition.name} for ${value} Gold.` };
}

export function equipmentOwner(instanceId, state = GameState) {
  return state.roster.find((hero) => EQUIPMENT_SLOTS.some((slot) => hero.equipment?.[slot] === instanceId));
}

export function canEquipItem(hero, item) {
  return hero && item && EQUIPMENT_SLOTS.includes(item.slot)
    && (item.slot === 'potion'
      ? Number.isInteger(item.charges) && item.charges > 0 && item.charges <= 3
        && (getPotionDefinition(item.itemId)?.effect.resource !== 'mana' || hero.maxMana > 0)
      : item.className === hero.className || item.usableBy?.includes('All') || item.usableBy?.includes(hero.className));
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
  const bonuses = {};
  for (const slot of EQUIPMENT_SLOTS) {
    if (slot === 'potion') continue;
    const item = equippedItem(hero, slot, state);
    for (const [stat, bonus] of Object.entries(item?.stats ?? {})) {
      if (Number.isFinite(bonus)) bonuses[stat] = (bonuses[stat] ?? 0) + bonus;
    }
  }
  const derived = hero.statProgressionVersion === 2;
  const result = derived ? rebuildCharacterStats(hero, bonuses) : characterStats(hero);
  for (const [stat, bonus] of Object.entries(bonuses)) {
    if (derived && [...ATTRIBUTE_STATS, ...CHANCE_STATS].includes(stat)) continue;
    result[stat] = (result[stat] ?? 0) + bonus;
    if (stat === 'healPower') result.spellHealing += bonus;
    if (stat === 'spellHealing' && derived) result.healPower += bonus;
  }
  return result;
}

export function equipmentStatsText(stats = {}) {
  const labels = { maxHp: 'HP', attackPower: 'Attack Power', spellDamage: 'Spell Damage', spellHealing: 'Spell Healing', healPower: 'Spell Healing', armor: 'Armor', maxMana: 'Mana', speed: 'Speed', dodge: 'Dodge', block: 'Block', hitChance: 'Hit', critChance: 'Crit', strength: 'STR', agility: 'AGI', intelligence: 'INT', wisdom: 'WIS' };
  return Object.entries(stats).filter(([, value]) => Number.isFinite(value)).map(([key, value]) => {
    const chance = ['dodge', 'block', 'hitChance', 'critChance'].includes(key);
    const display = Math.round((chance ? value * 100 : value) * 100) / 100;
    return `+${display}${chance ? '%' : ''} ${labels[key] ?? key}`;
  }).join('  / ');
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
  state.inventory.equipment = [1, EQUIPMENT_SCHEMA_VERSION].includes(savedInventory?.equipmentSchemaVersion)
    ? (Array.isArray(savedInventory.equipment) ? savedInventory.equipment : []).filter((item) => {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)
        || typeof item.name !== 'string' || ![...EQUIPMENT_SLOTS, 'scroll'].includes(item.slot)
        || (item.slot === 'scroll' ? !ENCHANTMENT_BY_ID[item.enchantmentId] : item.slot === 'potion'
          ? !Number.isInteger(item.charges) || item.charges < 1 || item.charges > 3
          : typeof item.className !== 'string' && !Array.isArray(item.usableBy))) return false;
      ids.add(item.id);
      return true;
    }).map((item) => ({
      id: item.id, name: item.slot === 'potion' ? getPotionDefinition(item.itemId)?.name ?? item.name : item.name, slot: item.slot,
      itemId: typeof item.itemId === 'string' ? LEGACY_ITEM_IDS[item.itemId] ?? item.itemId : undefined,
      rarity: typeof item.rarity === 'string' ? item.rarity : undefined,
      enchantmentId: ENCHANTMENT_BY_ID[item.enchantmentId] ? item.enchantmentId : undefined,
      className: item.className,
      usableBy: Array.isArray(item.usableBy) ? item.usableBy.filter((name) => typeof name === 'string') : undefined,
      charges: item.slot === 'potion' ? item.charges : undefined,
      stats: Object.fromEntries(Object.entries(item.stats ?? {}).filter(([, value]) => Number.isFinite(value)))
    })) : [];

  // Move the old focus's base bonus to Spell Damage while retaining enchantments.
  for (const item of state.inventory.equipment) {
    if (item.stats.armor > 0 && item.stats.armor < 1) item.stats.armor = 400 * item.stats.armor / (1 - item.stats.armor);
    if (item.itemId !== 'apprentice-focus' || Number.isFinite(item.stats.spellDamage)) continue;
    const bonus = Math.min(2, Math.max(0, item.stats.attackPower ?? 0));
    item.stats.spellDamage = bonus;
    item.stats.attackPower = (item.stats.attackPower ?? 0) - bonus;
    if (item.stats.attackPower === 0) delete item.stats.attackPower;
  }
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
