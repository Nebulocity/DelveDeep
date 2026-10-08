// Shop actions share these rules for affordability, compatible gear, materials and owned
// items. Screens can show a price, but the action still checks current state when pressed.
// That second check keeps a stale UI from spending resources the player no longer has.

import GameState from './GameState.js';
import { EQUIPMENT_ITEMS, EQUIPMENT_BY_ID, getPotionDefinition, getMaterialDefinition } from '../data/items.js';
import { ENCHANTMENT_BY_ID } from '../data/enchantments.js';
import { grantEquipment, equipmentOwner, sellMaterial, sellPotionPack } from './Equipment.js';
import { CRAFTING_RECIPES } from '../data/items.js';

export const GEAR_STOCK = EQUIPMENT_ITEMS.filter(item => Number.isFinite(item.price) && item.price > 0);

// Calculate the Gold received for the owned item being sold.
export function saleValue(item) {
  if (item.slot === 'potion') {
    const definition = getPotionDefinition(item.itemId);

    // The condition before ? chooses the first value when true and the value after : when
    // false. Math.floor rounds toward the smaller whole number, so 3.8 becomes 3.
    return definition ? Math.floor(definition.price * 0.5 * item.charges / definition.uses) : 0;
  }

  if (item.slot === 'scroll') return Math.floor((ENCHANTMENT_BY_ID[item.enchantmentId]?.price ?? 0) * 0.3);
  const definition = EQUIPMENT_BY_ID[item.itemId];

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact. ?.
  // only follows this link when the value exists; a missing optional value gives
  // undefined.
  return definition?.sellPrice ?? Math.floor((definition?.price ?? 0) * 0.3);
}

// Build eligible sell-list entries from actual owned inventory. state is the game data to
// read or change; a default can point at shared GameState.
export function saleRows(state = GameState) {

  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside. map builds one output entry for each input entry, in the same order. The
  // callback's return value becomes that output entry. filter keeps entries whose callback
  // returns true. It builds a new list and leaves the original list in place.
  return [
    ...state.inventory.equipment.map(item => ({
      id: item.id,
      category: item.slot,
      name: item.name,
      description: equipmentOwner(item.id, state) ? `Equipped by ${equipmentOwner(item.id, state).name}. Unequip to sell.` : item.slot === 'potion' ? `${item.charges}/3 uses remaining` : 'One owned item',
      value: saleValue(item),
      enabled: !equipmentOwner(item.id, state),
      item
    })),
    ...Object.entries(state.inventory.materials ?? {}).filter(([, count]) => count > 0).map(([id, count]) => ({
      id,
      category: 'material',
      name: getMaterialDefinition(id)?.name ?? id,
      description: `Owned: ${count} | Sell one at a time`,
      value: getMaterialDefinition(id)?.sellPrice ?? 0,
      enabled: true
    }))
  ];
}

// Validate the selected owned copy, remove it and credit its sale price. state is the game
// data to read or change; a default can point at shared GameState.
export function sellOwnedItem(id, state = GameState) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const item = state.inventory.equipment.find(entry => entry.id === id);
  if (!item) return sellMaterial(id, 1, state);
  if (equipmentOwner(id, state)) return { ok: false, message: 'Unequip this item before selling it.' };

  if (item.slot === 'potion') return sellPotionPack(id, state);
  const value = saleValue(item);

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  state.inventory.equipment = state.inventory.equipment.filter(entry => entry.id !== id);
  state.gold += value;
  return { ok: true, message: `Sold ${item.name} for ${value} Gold.` };
}

// Check the current Gold balance before creating an owned copy of the catalog gear. state
// is the game data to read or change; a default can point at shared GameState.
export function buyGear(id, state = GameState) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const stock = GEAR_STOCK.find(entry => entry.id === id);
  if (!stock || state.gold < stock.price) return { ok: false, message: 'Not enough Gold or item unavailable.' };
  const instance = grantEquipment(id, state);
  const recipe = CRAFTING_RECIPES.find(entry => entry.output.itemId === id);

  if (recipe) {

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone.
    state.inventory.knownRecipes ??= [];
    if (!state.inventory.knownRecipes.includes(recipe.id)) state.inventory.knownRecipes.push(recipe.id);
  }
  state.gold -= stock.price;

  return { ok: true, instance, message: `Bought ${stock.name}.` };
}

// Check and spend the scroll recipe requirements before granting an owned scroll. state is
// the game data to read or change; a default can point at shared GameState.
export function inscribeEnchantment(id, state = GameState, buy = false) {
  const definition = ENCHANTMENT_BY_ID[id];
  if (!definition) return { ok: false, message: 'Unknown enchantment.' };

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const recipe = CRAFTING_RECIPES.find(entry => entry.output.itemId === id);

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  if (!buy && recipe && !(state.inventory.knownRecipes ?? []).includes(recipe.id)) {
    return { ok: false, message: 'Buy this scroll once to learn its inscription recipe.' };
  }

  // The condition before ? chooses the first value when true and the value after : when
  // false. some stops with true as soon as one entry passes the check; an empty list gives
  // false. Object.entries turns own fields into [key, value] pairs so we can visit or
  // transform them.
  if (buy ? state.gold < definition.price : state.gold < definition.craftingFee
    || Object.entries(definition.ingredients).some(([key, count]) => (state.inventory.materials[key] ?? 0) < count)) {
    return { ok: false, message: buy ? 'Not enough Gold.' : state.gold < definition.craftingFee ? `Need ${definition.craftingFee} Gold for the crafting fee.` : 'Need more materials.' };
  }

  if (buy) state.gold -= definition.price;
  else {
    state.gold -= definition.craftingFee;
    for (const [key, count] of Object.entries(definition.ingredients)) {
    state.inventory.materials[key] -= count;
    if (!state.inventory.materials[key]) delete state.inventory.materials[key];
    }
  }

  let next = state.inventory.nextEquipmentId ?? 1;
  while (state.inventory.equipment.some(item => item.id === `gear-${next}`)) next++;
  state.inventory.nextEquipmentId = next + 1;
  const instance = { id: `gear-${next}`, itemId: id, enchantmentId: id, name: `${definition.name} Scroll`, slot: 'scroll', rarity: 'common', stats: {} };
  state.inventory.equipment.push(instance);

  if (buy) {
    if (recipe) {

      // ??= fills a missing value once. It leaves an existing value, including zero or
      // false, alone.
      state.inventory.knownRecipes ??= [];
      if (!state.inventory.knownRecipes.includes(recipe.id)) state.inventory.knownRecipes.push(recipe.id);
    }
  }

  return { ok: true, instance, message: `${buy ? 'Bought' : 'Inscribed'} ${instance.name}.` };
}

// Validate the owned scroll and gear compatibility before attaching its bonuses. state is
// the game data to read or change; a default can point at shared GameState.
export function applyEnchantment(scrollId, gearId, state = GameState) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const scroll = state.inventory.equipment.find(item => item.id === scrollId && item.slot === 'scroll');
  const gear = state.inventory.equipment.find(item => item.id === gearId);

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  const definition = ENCHANTMENT_BY_ID[scroll?.enchantmentId];
  if (!definition || !gear || gear.enchantmentId || !definition.slots.includes(gear.slot)) return { ok: false, message: 'Choose compatible gear without an enchantment.' };
  gear.enchantmentId = definition.id;

  // Object.entries turns own fields into [key, value] pairs so we can visit or transform
  // them.
  for (const [stat, amount] of Object.entries(definition.stats)) gear.stats[stat] = (gear.stats[stat] ?? 0) + amount;

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  state.inventory.equipment = state.inventory.equipment.filter(item => item.id !== scrollId);
  return { ok: true, message: `${gear.name} enchanted with ${definition.name}.` };
}

// Remove a known enchantment and grant the existing random half-material refund. state is
// the game data to read or change; a default can point at shared GameState.
export function disenchantItem(id, state = GameState, random = Math.random) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const item = state.inventory.equipment.find(entry => entry.id === id && entry.slot !== 'scroll');

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  const definition = ENCHANTMENT_BY_ID[item?.enchantmentId];
  if (!definition) return { ok: false, message: 'This item has no known enchantment.' };

  // flatMap builds callback results and flattens one array level. Returning [] removes an
  // entry; returning [value] keeps one result. Object.entries turns own fields into [key,
  // value] pairs so we can visit or transform them.
  const pool = Object.entries(definition.ingredients).flatMap(([key, count]) => Array(count).fill(key));
  const refunds = {};

  // Math.floor rounds toward the smaller whole number, so 3.8 becomes 3.
  const count = Math.floor(pool.length / 2);
  for (let i = 0; i < count; i++) {

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));

    // The brackets unpack entries by position; their order matters.
    const [key] = pool.splice(index, 1);

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    refunds[key] = (refunds[key] ?? 0) + 1;
    state.inventory.materials[key] = (state.inventory.materials[key] ?? 0) + 1;
  }

  for (const [stat, amount] of Object.entries(definition.stats)) {
    item.stats[stat] = (item.stats[stat] ?? 0) - amount;
    if (!item.stats[stat]) delete item.stats[stat];
  }
  delete item.enchantmentId;

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry.
  return { ok: true, refunds, message: `Removed ${definition.name}. Returned ${Object.entries(refunds).map(([key, amount]) => `${amount} ${getMaterialDefinition(key).name}`).join(', ')}.` };
}
