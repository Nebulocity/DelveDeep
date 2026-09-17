import GameState from './GameState.js';
import { EQUIPMENT_BY_ID, CRAFTING_MATERIALS, CRAFTING_RECIPES, sellPrice } from '../data/items.js';

export function ownedEquipment(state = GameState) {
  return state.inventory.equipment ?? [];
}

export function equipmentOwner(instanceId, state = GameState) {
  return state.roster.find((hero) => ['weapon', 'armor'].some((slot) => hero.equipment?.[slot] === instanceId));
}

export function equippedItem(hero, slot, state = GameState) {
  const instance = ownedEquipment(state).find((entry) => entry.id === hero.equipment?.[slot]);
  const item = EQUIPMENT_BY_ID[instance?.itemId];
  return item?.slot === slot && item.className === hero.className ? item : null;
}

// Derived stats are copies, never written back to the roster or saved stats.
export function getEquippedAdventurer(hero, state = GameState) {
  const result = { ...hero };
  for (const slot of ['weapon', 'armor']) {
    const item = equippedItem(hero, slot, state);
    for (const [stat, bonus] of Object.entries(item?.stats ?? {})) {
      result[stat] = (result[stat] ?? 0) + bonus;
    }
  }
  return result;
}

export function buyEquipment(itemId, state = GameState) {
  const item = EQUIPMENT_BY_ID[itemId];
  if (!item) return { ok: false, message: 'Item unavailable.' };
  if (state.gold < item.price) return { ok: false, message: 'Not enough gold.' };
  const instance = addEquipment(itemId, state);
  state.gold -= item.price;
  return { ok: true, message: `${item.name} purchased. Equip it in the Adventurer's Hall.`, instance };
}

function addEquipment(itemId, state) {
  state.inventory.equipment ??= [];
  let serial = Math.max(1, state.inventory.nextEquipmentId ?? 1);
  while (state.inventory.equipment.some((entry) => entry.id === `gear-${serial}`)) serial++;
  const instance = { id: `gear-${serial}`, itemId };
  state.inventory.nextEquipmentId = serial + 1;
  state.inventory.equipment.push(instance);
  return instance;
}

export function buyMaterial(materialId, state = GameState) {
  const material = CRAFTING_MATERIALS[materialId];
  if (!material) return { ok: false, message: 'Material unavailable.' };
  if (state.gold < material.price) return { ok: false, message: 'Not enough gold.' };
  state.inventory.materials ??= {};
  state.inventory.materials[materialId] = (state.inventory.materials[materialId] ?? 0) + 1;
  state.gold -= material.price;
  return { ok: true, message: `${material.name} purchased.` };
}

export function sellMaterial(materialId, state = GameState) {
  const material = CRAFTING_MATERIALS[materialId];
  if (!material || !(state.inventory.materials?.[materialId] > 0)) return { ok: false, message: 'Material is no longer owned.' };
  state.inventory.materials[materialId]--;
  state.gold += sellPrice(material);
  return { ok: true, message: `${material.name} sold for ${sellPrice(material)} gold.` };
}

export function craftingRequirements(recipe, state = GameState) {
  const ingredient = recipe.equipment ? ownedEquipment(state).find((entry) =>
    entry.itemId === recipe.equipment && !equipmentOwner(entry.id, state)) : null;
  const enoughMaterials = Object.entries(recipe.materials).every(([id, count]) => (state.inventory.materials?.[id] ?? 0) >= count);
  return { ingredient, canCraft: enoughMaterials && state.gold >= recipe.gold && (!recipe.equipment || Boolean(ingredient)) };
}

export function craftEquipment(recipeId, state = GameState) {
  const recipe = CRAFTING_RECIPES.find((entry) => entry.id === recipeId);
  if (!recipe) return { ok: false, message: 'Recipe unavailable.' };
  const { ingredient, canCraft } = craftingRequirements(recipe, state);
  if (!canCraft) return { ok: false, message: 'Need the listed materials, gold, and unequipped ingredient.' };
  // Validate everything before spending anything. Equipped copies are never consumed.
  for (const [id, count] of Object.entries(recipe.materials)) state.inventory.materials[id] -= count;
  if (ingredient) state.inventory.equipment = ownedEquipment(state).filter((entry) => entry.id !== ingredient.id);
  state.gold -= recipe.gold;
  const instance = addEquipment(recipe.itemId, state);
  return { ok: true, instance, message: `${EQUIPMENT_BY_ID[recipe.itemId].name} crafted. Ingredients consumed.` };
}

export function sellEquipment(instanceId, state = GameState) {
  const index = ownedEquipment(state).findIndex((entry) => entry.id === instanceId);
  if (index < 0) return { ok: false, message: 'Item is no longer owned.' };
  if (equipmentOwner(instanceId, state)) return { ok: false, message: 'Unequip this item before selling it.' };
  const item = EQUIPMENT_BY_ID[state.inventory.equipment[index].itemId];
  if (!item) return { ok: false, message: 'Item unavailable.' };
  state.inventory.equipment.splice(index, 1);
  state.gold += sellPrice(item);
  return { ok: true, message: `${item.name} sold for ${sellPrice(item)} gold.` };
}

export function equipItem(heroId, instanceId, state = GameState) {
  const hero = state.roster.find((entry) => entry.id === heroId);
  const instance = ownedEquipment(state).find((entry) => entry.id === instanceId);
  const item = EQUIPMENT_BY_ID[instance?.itemId];
  if (!hero || !item || item.className !== hero.className) return { ok: false, message: 'This character cannot use that item.' };
  const owner = equipmentOwner(instanceId, state);
  if (owner && owner.id !== heroId) return { ok: false, message: `Unequip this item from ${owner.name} first.` };
  hero.equipment ??= { weapon: null, armor: null };
  hero.equipment[item.slot] = instanceId;
  return { ok: true, message: `${hero.name} equipped ${item.name}.` };
}

export function unequipItem(heroId, slot, state = GameState) {
  const hero = state.roster.find((entry) => entry.id === heroId);
  if (!hero || !['weapon', 'armor'].includes(slot) || !hero.equipment?.[slot]) return { ok: false, message: 'That slot is empty.' };
  hero.equipment[slot] = null;
  return { ok: true, message: `${hero.name}'s ${slot} returned to equipment storage.` };
}

// Old profiles get empty slots. Invalid or duplicate instance references are
// discarded so a single item can never grant bonuses to two adventurers.
export function restoreEquipment(savedInventory, savedRoster, state = GameState) {
  const ids = new Set();
  state.inventory.equipment = (Array.isArray(savedInventory?.equipment) ? savedInventory.equipment : [])
    .filter((entry) => {
      if (!entry || typeof entry.id !== 'string' || !EQUIPMENT_BY_ID[entry.itemId] || ids.has(entry.id)) return false;
      ids.add(entry.id);
      return true;
    }).map(({ id, itemId }) => ({ id, itemId }));
  state.inventory.nextEquipmentId = Number.isSafeInteger(savedInventory?.nextEquipmentId)
    ? Math.max(1, savedInventory.nextEquipmentId) : 1;
  state.inventory.materials = Object.fromEntries(Object.entries(savedInventory?.materials ?? {})
    .filter(([, count]) => Number.isSafeInteger(count) && count >= 0));
  const assigned = new Set();
  for (const hero of state.roster) {
    hero.equipment = { weapon: null, armor: null };
    for (const slot of ['weapon', 'armor']) {
      const id = savedRoster.get(hero.id)?.equipment?.[slot];
      const instance = state.inventory.equipment.find((entry) => entry.id === id);
      const item = EQUIPMENT_BY_ID[instance?.itemId];
      if (item?.slot !== slot || item.className !== hero.className || assigned.has(id)) continue;
      hero.equipment[slot] = id;
      assigned.add(id);
    }
  }
}
