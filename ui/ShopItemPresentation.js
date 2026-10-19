import GameState from '../game/GameState.js';
import { equipmentOwner } from '../game/Equipment.js';
import { equipmentDetails } from '../game/EquipmentDescriptions.js';
import { ITEM_RARITIES, CRAFTING_RECIPES, getCatalogItemDefinition, getMaterialDefinition, getPotionDefinition } from '../data/items.js';
import { ENCHANTMENT_BY_ID } from '../data/enchantments.js';
import { canCraft } from '../game/Crafting.js';
import { SERVICE_ICONS } from './TownServiceTheme.js';

// This is display data only. Actions still call the existing transaction functions,
// which recheck resources and ownership before changing anything.
export function shopItemPresentation(scene, row, choice) {
  const state = GameState;
  const recipe = CRAFTING_RECIPES.find(entry => entry.id === row.id);
  const owned = row.item ?? state.inventory.equipment.find(item => item.id === row.id);
  const itemId = owned?.itemId ?? recipe?.output.itemId ?? row.itemId ?? row.id;
  const definition = getCatalogItemDefinition(itemId) ?? getPotionDefinition(itemId)
    ?? getMaterialDefinition(itemId) ?? ENCHANTMENT_BY_ID[itemId];
  const item = owned ?? definition;
  const rarity = ITEM_RARITIES[owned?.rarity ?? definition?.rarity ?? 'common'];
  const equipment = item && ['weapon', 'armor', 'accessory', 'potion'].includes(item.slot)
    ? equipmentDetails(item) : null;
  const owner = owned ? equipmentOwner(owned.id, state) : null;
  const count = row.category === 'material' ? state.inventory.materials[itemId] ?? 0
    : state.inventory.equipment.filter(entry => entry.itemId === itemId).length;
  const lines = [];
  if (equipment) lines.push(equipment.description);
  else if (definition?.description) lines.push(definition.description);
  if (!equipment || row.description !== definition?.description) lines.push(row.detailsDescription ?? row.description);
  if (equipment?.usableBy?.length) lines.push(`Usable by: ${equipment.usableBy.join(', ')}`);
  lines.push(`Owned: ${count}${owner ? `\nEquipped by ${owner.name}` : ''}`);
  const ingredients = recipe?.ingredients ?? (choice.id === 'inscribe' ? ENCHANTMENT_BY_ID[itemId]?.ingredients : null);
  if (ingredients) {
    lines.push('Materials required (owned / required):');
    for (const [id, required] of Object.entries(ingredients)) {
      lines.push(`${getMaterialDefinition(id)?.name ?? id}: ${state.inventory.materials[id] ?? 0} / ${required}`);
    }
  }
  let unavailable = '';
  if (!row.enabled) {
    if (recipe && ['craft', 'brew'].includes(choice.id)) unavailable = canCraft(recipe.id).message;
    else if (choice.id === 'buy') unavailable = `You need ${definition?.price ?? 0} Gold. You have ${state.gold} Gold.`;
    else if (choice.id === 'inscribe') {
      const fee = ENCHANTMENT_BY_ID[itemId]?.craftingFee ?? 0;
      const missing = Object.entries(ingredients ?? {}).filter(([id, required]) => (state.inventory.materials[id] ?? 0) < required);
      unavailable = state.gold < fee ? `You need ${fee} Gold for inscription. You have ${state.gold} Gold.`
        : `Need ${missing.map(([id, required]) => `${required - (state.inventory.materials[id] ?? 0)} ${getMaterialDefinition(id)?.name ?? id}`).join(', ')}.`;
    } else unavailable = 'This action is currently unavailable.';
  }
  const potion = row.category === 'potion' ? getPotionDefinition(itemId) : null;
  const icon = potion?.effect?.resource === 'mana' ? 'shop-mana-potion'
    : SERVICE_ICONS[row.category] ?? 'town-hub-items';
  return { icon, rarity, count, unavailable,
    details: { title: row.name, description: [...new Set(lines.filter(Boolean))].join('\n\n'), align: 'left',
      usableBy: equipment?.usableBy, shopTheme: { text: '#fff1d2' } } };
}
