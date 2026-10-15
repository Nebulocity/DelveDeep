// Check real eligibility, cascade fallthrough and reproducible idle chest rewards.
import assert from 'node:assert/strict';
import { EQUIPMENT_ITEMS, CATALOG_ITEMS, CRAFTING_RECIPES } from '../data/items.js';
import { EQUIPMENT_LOOT_TABLES } from '../data/equipmentCatalog.js';
import { equipmentLootPool, equipmentLootTable, rollEquipmentLoot, mergeEquipmentLoot } from '../game/EquipmentLoot.js';
import { everdeepChestPreview, startEverdeepRun } from '../game/Everdeep.js';
import { loadProfile } from '../game/GameStorage.js';
import adventurers from '../data/adventurers.js';
import GameState from '../game/GameState.js';

assert.equal(new Set(CATALOG_ITEMS.map(item => item.id)).size, CATALOG_ITEMS.length);
assert.equal(new Set(CRAFTING_RECIPES.map(item => item.id)).size, CRAFTING_RECIPES.length);
const options = { region: 'pineshire-reach', source: 'boss', location: 'murmuring-abyss' };
const rare = equipmentLootPool(options.region, options.source, options.location, 'rare');
assert.equal(rare.length, 13);
assert.equal(equipmentLootPool(options.region, 'wave', options.location, 'rare').length, 0);
assert.equal(equipmentLootPool(options.region, 'boss', 'slime-cave', 'rare').length, 0);
for (const source of ['wave', 'boss', 'everdeep']) {
  assert.ok(!equipmentLootPool(options.region, source, options.location, 'uncommon').some(item => /^(Starsteel|Starseed)/.test(item.name)));
}
for (let chest = 1; chest <= 6; chest++) {
  const table = equipmentLootTable({ source: 'everdeep', chest });
  assert.equal(table.rolls.rare, chest * 0.005);
  assert.equal(table.rolls.common, 1);
}
let draws = 0;
assert.equal(rollEquipmentLoot(options, () => { draws++; return 0; }).rarity, 'rare');
assert.equal(draws, 2, 'Only the successful tier and its item selection consume rolls.');
assert.equal(rollEquipmentLoot(options, () => 0.99999), null);
const noRare = EQUIPMENT_ITEMS.filter(item => item.rarity !== 'rare');
const sequence = [0.1, 0];
assert.equal(rollEquipmentLoot(options, () => sequence.shift(), noRare).rarity, 'uncommon');
assert.equal(sequence.length, 0, 'Empty Rare skips its roll rather than consuming it.');
assert.equal(rollEquipmentLoot({ ...options, region: 'unimplemented-region' }, () => 0), null);
assert.deepEqual(mergeEquipmentLoot([{ itemId: 'a', count: 2 }], [{ itemId: 'a', count: 1 }]), [{ itemId: 'a', count: 3 }]);

// Sum all possible outcomes independently of the implementation's random rolls.
for (const table of EQUIPMENT_LOOT_TABLES) {
  let remaining = 1;
  let awarded = 0;
  for (const [rarity, chance] of Object.entries(table.rolls)) {
    assert.ok(chance >= 0 && chance <= 1);
    if (!equipmentLootPool(table.region, table.source, table.location, rarity).length) continue;
    awarded += remaining * chance;
    remaining *= 1 - chance;
  }
  assert.ok(Math.abs(awarded + remaining - 1) < 1e-12);
  if (table.source === 'everdeep') assert.equal(remaining, 0);
}

globalThis.localStorage = { getItem: () => null, setItem() {} };
loadProfile(adventurers);
GameState.development.unlockAll = true;
GameState.gold = 1000;
const party = [GameState.roster.find(hero => hero.role === 'Tank'), GameState.roster.find(hero => hero.role === 'Healer'), ...GameState.roster.filter(hero => !['Tank', 'Healer'].includes(hero.role)).slice(0, 3)];
const run = startEverdeepRun(party.map(hero => hero.id), 1800000000000).run;
assert.equal(run.rewardTableVersion, 2);
run.earnedChestCount = 6;
for (let chest = 0; chest < 6; chest++) {
  assert.deepEqual(everdeepChestPreview(chest, GameState, run.id), everdeepChestPreview(chest, GameState, run.id));
  assert.equal(everdeepChestPreview(chest, GameState, run.id).itemLevel,
    EQUIPMENT_ITEMS.find(item => item.id === everdeepChestPreview(chest, GameState, run.id).equipmentId).minimumLevel);
  assert.ok(!/^(Starsteel|Starseed)/.test(EQUIPMENT_ITEMS.find(item => item.id === everdeepChestPreview(chest, GameState, run.id).equipmentId).name));
}
run.rewardTableVersion = 1;
assert.deepEqual(everdeepChestPreview(0, GameState, run.id), everdeepChestPreview(0, GameState, run.id));
console.log('Cascading tiers, empty pools, regional/source gates, rarity sums, chest increments and seeded save compatibility passed.');
