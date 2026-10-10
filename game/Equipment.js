// A catalog item describes a kind of gear. An inventory instance is one owned copy with
// its own stable ID. Two copies can share itemId while having different instance IDs.
// Equipped slots refer to owned copies. Stat copies and save migrations keep character
// bonuses from changing the original item catalog or being added twice.

import { ATTRIBUTE_STATS, CHANCE_STATS } from '../config/characterProgression.js';
import GameState from './GameState.js';
import { characterStats, rebuildCharacterStats } from './CharacterStats.js';
import { ENCHANTMENT_BY_ID, LEGACY_ENCHANTMENT_IDS } from '../data/enchantments.js';
import { getEquipmentDefinition, getMaterialDefinition, getPotionDefinition } from '../data/items.js';

export const EQUIPMENT_SLOTS = ['weapon', 'armor', 'accessory', 'potion'];
export const EQUIPMENT_SCHEMA_VERSION = 2;
const LEGACY_ITEM_IDS = {
  'field-blade': 'BLS01', 'trail-bow': 'PBR01', 'apprentice-focus': 'PST01',
  'pilgrim-staff': 'PST01', 'padded-vest': 'PV01', 'iron-guard': 'PV01'
};

// Return the owned gear copies in this state, creating a missing inventory list if needed.
// state is the game data to read or change; a default can point at shared GameState.
export function ownedEquipment(state = GameState) {

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  return state.inventory.equipment ?? [];
}

// Allocate an owned-item ID and advance the saved counter so separate copies stay
// distinct. state is the game data to read or change; a default can point at shared
// GameState.
function nextInstanceId(state) {
  const owned = ownedEquipment(state);

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  let next = Number.isSafeInteger(state.inventory.nextEquipmentId) && state.inventory.nextEquipmentId > 0
    ? state.inventory.nextEquipmentId : 1;

  // some stops with true as soon as one entry passes the check; an empty list gives false.
  while (owned.some((entry) => entry.id === `gear-${next}`)) next += 1;
  state.inventory.nextEquipmentId = next + 1;
  return `gear-${next}`;
}

// Copy the catalog definition into a new owned gear instance with its own ID. state is the
// game data to read or change; a default can point at shared GameState.
export function grantEquipment(itemId, state = GameState) {

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  const definition = getEquipmentDefinition(itemId);
  if (!definition) return null;

  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside.
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

// Create an owned potion pack with its catalog effect and remaining charge count. state is
// the game data to read or change; a default can point at shared GameState.
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

// Create an owned scroll linked to its reusable enchantment definition. state is the game
// data to read or change; a default can point at shared GameState.
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

// Check Gold, charge the price and grant a potion pack through the shared inventory path.
// state is the game data to read or change; a default can point at shared GameState.
export function buyPotionPack(itemId, state = GameState) {
  const definition = getPotionDefinition(itemId);
  if (!definition) return { ok: false, message: 'That potion is not stocked.' };
  if (state.gold < definition.price) return { ok: false, message: `You need ${definition.price} Gold for ${definition.name}.` };
  const instance = grantPotionPack(itemId, state);
  state.gold -= definition.price;

  return { ok: true, instance, message: `Bought ${definition.name} (${definition.uses} uses).` };
}

// Remove the owned potion pack and apply its sale value. state is the game data to read or
// change; a default can point at shared GameState.
export function sellPotionPack(instanceId, state = GameState) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const item = ownedEquipment(state).find((entry) => entry.id === instanceId && entry.slot === 'potion');

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  const definition = getPotionDefinition(item?.itemId);
  if (!item || !definition) return { ok: false, message: 'That potion pack is unavailable.' };
  if (equipmentOwner(instanceId, state)) return { ok: false, message: 'Unequip this potion pack before selling it.' };

  // Math.floor rounds toward the smaller whole number, so 3.8 becomes 3.
  const value = Math.floor(definition.price * 0.5 * item.charges / definition.uses);

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  state.inventory.equipment = state.inventory.equipment.filter((entry) => entry.id !== instanceId);
  state.gold += value;
  return { ok: true, amount: value, message: `Sold ${definition.name} for ${value} Gold.` };
}

// Add this material count to shared inventory rather than to an individual hero. state is
// the game data to read or change; a default can point at shared GameState.
export function grantMaterial(materialId, amount = 1, state = GameState) {
  if (!getMaterialDefinition(materialId) || !Number.isSafeInteger(amount) || amount <= 0) return false;

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact. ?.
  // only follows this link when the value exists; a missing optional value gives
  // undefined.
  const current = state.inventory.materials?.[materialId] ?? 0;
  if (!Number.isSafeInteger(current) || current < 0 || !Number.isSafeInteger(current + amount)) return false;

  // ??= fills a missing value once. It leaves an existing value, including zero or false,
  // alone.
  state.inventory.materials ??= {};
  state.inventory.materials[materialId] = current + amount;
  return true;
}

// Check the owned count, remove the sold material and credit its Gold value. state is the
// game data to read or change; a default can point at shared GameState.
export function sellMaterial(materialId, amount = 1, state = GameState) {
  const definition = getMaterialDefinition(materialId);

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact. ?.
  // only follows this link when the value exists; a missing optional value gives
  // undefined.
  const owned = state.inventory.materials?.[materialId] ?? 0;
  if (!definition || !Number.isSafeInteger(amount) || amount <= 0 || owned < amount) return { ok: false, message: 'You do not have enough of that material.' };
  const value = amount * (definition.sellPrice ?? 0);
  state.inventory.materials[materialId] -= amount;

  if (!state.inventory.materials[materialId]) delete state.inventory.materials[materialId];
  state.gold += value;
  return { ok: true, amount: value, message: `Sold ${amount} ${definition.name} for ${value} Gold.` };
}

// Find the character currently referring to this owned gear instance. state is the game
// data to read or change; a default can point at shared GameState.
export function equipmentOwner(instanceId, state = GameState) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  return state.roster.find((hero) => EQUIPMENT_SLOTS.some((slot) => hero.equipment?.[slot] === instanceId));
}

// Check slot and class compatibility for this particular character and item. hero is the
// roster record, rather than the artwork that displays that character.
export function canEquipItem(hero, item) {

  // The condition before ? chooses the first value when true and the value after : when
  // false. ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  return hero && item && EQUIPMENT_SLOTS.includes(item.slot)
    && (item.slot === 'potion'
      ? Number.isInteger(item.charges) && item.charges > 0 && item.charges <= 3
        && (getPotionDefinition(item.itemId)?.effect.resource !== 'mana' || hero.maxMana > 0)
      : item.className === hero.className || item.usableBy?.includes('All') || item.usableBy?.includes(hero.className));
}

// Follow a character's slot reference to the actual owned item copy. hero is the roster
// record, rather than the artwork that displays that character. state is the game data to
// read or change; a default can point at shared GameState.
export function equippedItem(hero, slot, state = GameState) {
  if (!EQUIPMENT_SLOTS.includes(slot)) return null;

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const item = ownedEquipment(state).find((entry) => entry.id === hero.equipment?.[slot]);

  // The condition before ? chooses the first value when true and the value after : when
  // false. ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  return item?.slot === slot && canEquipItem(hero, item) ? item : null;
}

// Use one charge from the character's equipped potion pack, respecting remaining uses.
// state is the game data to read or change; a default can point at shared GameState.
export function consumePotionCharge(heroId, state = GameState) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const hero = state.roster.find((entry) => entry.id === heroId);
  const item = hero && equippedItem(hero, 'potion', state);
  if (!item || !getPotionDefinition(item.itemId)) return false;
  item.charges -= 1;

  if (item.charges === 0) {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    state.inventory.equipment = state.inventory.equipment.filter((entry) => entry.id !== item.id);
    hero.equipment.potion = null;
  }

  return true;
}

// Build a combat-ready character with current gear bonuses applied once. hero is the
// roster record, rather than the artwork that displays that character. state is the game
// data to read or change; a default can point at shared GameState.
export function getEquippedAdventurer(hero, state = GameState) {
  const bonuses = {};
  for (const slot of EQUIPMENT_SLOTS) {
    if (slot === 'potion') continue;
    const item = equippedItem(hero, slot, state);

    // Object.entries turns own fields into [key, value] pairs so we can visit or transform
    // them. ?? uses the fallback only for null or undefined. A real zero or false stays
    // intact. ?. only follows this link when the value exists; a missing optional value
    // gives undefined.
    for (const [stat, bonus] of Object.entries(item?.stats ?? {})) {
      if (Number.isFinite(bonus)) bonuses[stat] = (bonuses[stat] ?? 0) + bonus;
    }
  }

  const derived = hero.statProgressionVersion === 2;

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const result = derived ? rebuildCharacterStats(hero, bonuses) : characterStats(hero);
  for (const [stat, bonus] of Object.entries(bonuses)) {

    // ... expands these entries into the new list or call. It does not deep-copy the
    // objects inside.
    if (derived && [...ATTRIBUTE_STATS, ...CHANCE_STATS].includes(stat)) continue;
    result[stat] = (result[stat] ?? 0) + bonus;
    if (stat === 'healPower') result.spellHealing += bonus;

    if (stat === 'spellHealing' && derived) result.healPower += bonus;
  }

  return result;
}

// Format the item's stat bonuses into readable lines for inspection.
export function equipmentStatsText(stats = {}) {
  const labels = {
    maxHp: 'HP',
    attackPower: 'Attack Power',
    spellDamage: 'Spell Damage',
    spellHealing: 'Spell Healing',
    healPower: 'Spell Healing',
    armor: 'Armor',
    maxMana: 'Mana',
    speed: 'Speed',
    dodge: 'Dodge',
    block: 'Block',
    hitChance: 'Hit',
    critChance: 'Crit',
    strength: 'STR',
    agility: 'AGI',
    intelligence: 'INT',
    wisdom: 'WIS'
  };

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry. filter keeps entries whose callback returns
  // true. It builds a new list and leaves the original list in place. Object.entries turns
  // own fields into [key, value] pairs so we can visit or transform them.
  return Object.entries(stats).filter(([, value]) => Number.isFinite(value)).map(([key, value]) => {
    const chance = ['dodge', 'block', 'hitChance', 'critChance'].includes(key);

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const display = Math.round((chance ? value * 100 : value) * 100) / 100;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    return `+${display}${chance ? '%' : ''} ${labels[key] ?? key}`;
  }).join('  / ');
}

// Validate ownership and compatibility before assigning the owned copy to the chosen slot.
// state is the game data to read or change; a default can point at shared GameState.
export function equipItem(heroId, instanceId, state = GameState) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const hero = state.roster.find((entry) => entry.id === heroId);
  const item = ownedEquipment(state).find((entry) => entry.id === instanceId);
  if (!canEquipItem(hero, item)) return { ok: false, message: 'This character cannot use that equipment.' };
  const owner = equipmentOwner(instanceId, state);

  if (owner && owner.id !== heroId) return { ok: false, message: `Unequip this item from ${owner.name} first.` };

  // ??= fills a missing value once. It leaves an existing value, including zero or false,
  // alone.
  hero.equipment ??= { weapon: null, armor: null, accessory: null, potion: null };
  hero.equipment[item.slot] = instanceId;
  return { ok: true, message: `${hero.name} equipped ${item.name}.` };
}

// Clear the slot reference while keeping the actual item in inventory. state is the game
// data to read or change; a default can point at shared GameState.
export function unequipItem(heroId, slot, state = GameState) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const hero = state.roster.find((entry) => entry.id === heroId);

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  if (!hero || !EQUIPMENT_SLOTS.includes(slot) || !hero.equipment?.[slot]) return { ok: false, message: 'That slot is empty.' };
  hero.equipment[slot] = null;
  return { ok: true, message: `${hero.name}'s ${slot} returned to equipment storage.` };
}

// Restore owned copies from current catalog definitions. Saved IDs and potion charges
// describe ownership, while names, compatibility and bonuses come from today's catalog.
// Legacy names are translated only on this load path, never accepted as new shop stock.
export function restoreEquipment(savedInventory, savedRoster, state = GameState) {

  // A Set keeps each value once. has checks membership without searching a list for
  // duplicate entries.
  const ids = new Set();

  // The condition before ? chooses the first value when true and the value after : when
  // false. ?. only follows this link when the value exists; a missing optional value gives
  // undefined. map builds one output entry for each input entry, in the same order. The
  // callback's return value becomes that output entry.
  state.inventory.equipment = [1, EQUIPMENT_SCHEMA_VERSION].includes(savedInventory?.equipmentSchemaVersion)
    ? (Array.isArray(savedInventory.equipment) ? savedInventory.equipment : []).filter((item) => {

      // ... expands these entries into the new list or call. It does not deep-copy the
      // objects inside. The condition before ? chooses the first value when true and the
      // value after : when false.
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)
        || typeof item.name !== 'string' || ![...EQUIPMENT_SLOTS, 'scroll'].includes(item.slot)
        || (item.slot === 'scroll' ? !ENCHANTMENT_BY_ID[LEGACY_ENCHANTMENT_IDS[item.enchantmentId] ?? item.enchantmentId] : item.slot === 'potion'
          ? !Number.isInteger(item.charges) || item.charges < 1 || item.charges > 3
          : typeof item.className !== 'string' && !Array.isArray(item.usableBy))) return false;
      ids.add(item.id);

      return true;
    }).map((item) => {
      const itemId = LEGACY_ITEM_IDS[item.itemId] ?? item.itemId;
      const enchantmentId = LEGACY_ENCHANTMENT_IDS[item.enchantmentId] ?? item.enchantmentId;
      const enchantment = ENCHANTMENT_BY_ID[enchantmentId];

      // Potion charges are the one changing resource on the item itself. Restore the
      // remaining uses, but refresh its name and effect identity from the current pack.
      if (item.slot === 'potion') {
        const definition = getPotionDefinition(itemId);
        return definition ? { id: item.id, itemId, name: definition.name, slot: 'potion',
          rarity: definition.rarity, charges: item.charges, stats: {} } : null;
      }

      // A legacy scroll becomes its replacement catalog scroll. Unsupported definitions
      // cannot carry retired prices, effects or bonuses into the playable inventory.
      if (item.slot === 'scroll') {
        return enchantment ? { id: item.id, itemId: enchantment.id, enchantmentId: enchantment.id,
          name: `${enchantment.name} Scroll`, slot: 'scroll', rarity: 'uncommon', stats: {} } : null;
      }

      const definition = getEquipmentDefinition(itemId);
      if (!definition || definition.slot !== item.slot) return null;
      const stats = { ...definition.stats };
      const compatibleEnchantment = enchantment?.slots.includes(definition.slot) ? enchantment : null;

      // Rebuild base bonuses, then add the known current enchantment once. Reading the
      // old saved stat total here would retain retired item data or double an enchantment
      // every time the same save is loaded. The owned instance ID stays unchanged.
      if (compatibleEnchantment) {
        for (const [stat, amount] of Object.entries(compatibleEnchantment.stats)) stats[stat] = (stats[stat] ?? 0) + amount;
      }
      return { id: item.id, itemId, name: definition.name, slot: definition.slot,
        rarity: definition.rarity, usableBy: [...definition.usableBy], stats,
        ...(compatibleEnchantment ? { enchantmentId: compatibleEnchantment.id } : {}) };
    }).filter(Boolean) : [];

  state.inventory.equipmentSchemaVersion = EQUIPMENT_SCHEMA_VERSION;
  state.inventory.nextEquipmentId = Number.isSafeInteger(savedInventory?.nextEquipmentId) && savedInventory.nextEquipmentId > 0
    ? savedInventory.nextEquipmentId : 1;
  const assigned = new Set();

  for (const hero of state.roster) {
    hero.equipment = { weapon: null, armor: null, accessory: null, potion: null };
    for (const slot of EQUIPMENT_SLOTS) {
      const id = savedRoster.get(hero.id)?.equipment?.[slot];

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const item = state.inventory.equipment.find((entry) => entry.id === id);
      if (!item || item.slot !== slot || !canEquipItem(hero, item) || assigned.has(id)) continue;
      hero.equipment[slot] = id;
      assigned.add(id);
    }
  }
}
