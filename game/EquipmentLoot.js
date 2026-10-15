// One party-wide cascade runs per reward opportunity. Empty tiers consume no roll,
// and returning null means this clear awards no equipment. Materials use separate rolls.
import { EQUIPMENT_ITEMS } from '../data/items.js';
import { EQUIPMENT_LOOT_TABLES } from '../data/equipmentCatalog.js';
import { grantEquipment } from './Equipment.js';

export const EQUIPMENT_LOOT_RARITIES = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
const regionId = 'pineshire-reach';

// Explicit regional/source membership prevents next-region gear leaking into idle loot.
// A location of '*' allows any Delve in that item's region, after the region/source checks.
export function equipmentLootPool(region, source, location, rarity, items = EQUIPMENT_ITEMS) {
  return items.filter(item => ['weapon', 'armor', 'accessory'].includes(item.slot)
    && item.rarity === rarity && item.lootRegions?.includes(region)
    && item.lootSources?.includes(source)
    && (source === 'everdeep' || item.lootLocations?.includes(location)
      || item.lootLocations?.includes('*')));
}

// chest is one-based, matching the workbook's six milestones rather than array indices.
export function equipmentLootTable({ region = regionId, source, location, chest = 1 }) {
  return EQUIPMENT_LOOT_TABLES.find(table => table.region === region && table.source === source
    && (source === 'everdeep' ? chest >= table.firstChest && chest <= table.lastChest : table.location === location));
}

// The caller supplies its seeded random source. Only the successful tier draws an item.
export function rollEquipmentLoot(options, random = Math.random, items = EQUIPMENT_ITEMS) {
  const table = equipmentLootTable(options);
  if (!table) return null;
  for (const rarity of EQUIPMENT_LOOT_RARITIES) {
    const chance = table.rolls[rarity] ?? 0;
    if (chance <= 0) continue;
    const pool = equipmentLootPool(table.region, table.source, table.location, rarity, items);
    if (!pool.length || random() >= chance) continue;
    return pool[Math.floor(random() * pool.length)];
  }
  return null;
}

// Grant ownership before the caller saves the checkpoint and inventory together.
export function awardEquipmentLoot(delve, source, random = Math.random) {
  const definition = rollEquipmentLoot({ region: delve?.regionId ?? regionId, source, location: delve?.id }, random);
  if (!definition) return [];
  const instance = grantEquipment(definition.id);
  return instance ? [{ itemId: definition.id, name: definition.name, count: 1, rarity: definition.rarity }] : [];
}

// Summaries group identical rewards without merging the separate owned inventory copies.
export function mergeEquipmentLoot(previous = [], incoming = []) {
  const totals = new Map(previous.map(item => [item.itemId, { ...item }]));
  for (const item of incoming) {
    const current = totals.get(item.itemId);
    totals.set(item.itemId, { ...item, count: (current?.count ?? 0) + (item.count ?? 1) });
  }
  return [...totals.values()];
}
