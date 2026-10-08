// Old identifiers are migration inputs only. Every restored owned item must use the
// current catalog's name, compatibility and bonuses, including its current enchantment.

import assert from 'node:assert/strict';
import { restoreEquipment } from '../game/Equipment.js';
import { getEquipmentDefinition } from '../data/items.js';
import { ENCHANTMENT_BY_ID, ENCHANTMENTS } from '../data/enchantments.js';

const state = { roster: [{ id:'mage',className:'Mage of the Umbral Veil' }], inventory:{} };
const saved = { equipmentSchemaVersion:1, nextEquipmentId:5, equipment:[
  { id:'focus',itemId:'apprentice-focus',name:'Retired Focus',slot:'weapon',usableBy:['Wrong Class'],
    stats:{attackPower:999,armor:0.9},enchantmentId:'minor-mending' },
  { id:'scroll',itemId:'minor-might',enchantmentId:'minor-might',name:'Retired Scroll',slot:'scroll',stats:{} },
  { id:'potion',itemId:'mending-potion',name:'Old Potion Name',slot:'potion',charges:2,stats:{attackPower:999} },
  { id:'unknown',itemId:'not-in-the-catalog',name:'Removed',slot:'weapon',usableBy:['All'],stats:{maxHp:999} },
  { id:'bad-potion',itemId:'mending-potion',name:'Invalid',slot:'potion',charges:4,stats:{} },
  { id:'focus',itemId:'BLS01',name:'Duplicate ID',slot:'weapon',usableBy:['All'],stats:{} }
] };
const roster = new Map([['mage',{equipment:{weapon:'focus',potion:'potion'}}]]);
restoreEquipment(saved,roster,state);
assert.equal(state.inventory.equipment.length,3);
const focus = state.inventory.equipment.find(item=>item.id==='focus');
const staff = getEquipmentDefinition('PST01');
assert.equal(focus.itemId,staff.id);
assert.equal(focus.name,staff.name);
assert.deepEqual(focus.usableBy,staff.usableBy);
assert.equal(focus.enchantmentId,'SCE003');
assert.deepEqual(focus.stats,{...staff.stats,wisdom:(staff.stats.wisdom??0)+5});
assert.equal(state.roster[0].equipment.weapon,'focus');
assert.equal(state.roster[0].equipment.potion,'potion');
assert.equal(state.inventory.equipment.find(item=>item.id==='potion').charges,2);
assert.deepEqual(state.inventory.equipment.find(item=>item.id==='potion').stats,{});
assert.equal(state.inventory.equipment.find(item=>item.id==='scroll').enchantmentId,'SCE001');
assert.equal(ENCHANTMENT_BY_ID['minor-mending'],undefined);
assert.equal(ENCHANTMENTS.length,5);

// The second load receives catalog IDs, not old identifiers. It must produce exactly
// the same bonuses and owned IDs, rather than stacking enchantment bonuses each time.
const first = structuredClone(state.inventory);
restoreEquipment(first,roster,state);
assert.deepEqual(state.inventory,first);

// Even current-format saves cannot resurrect obsolete numbers: catalog updates are
// authoritative. An unknown old enchantment is removed without inventing a replacement.
const changed = structuredClone(first);
changed.equipment[0].name = 'Stale Name';
changed.equipment[0].stats = {attackPower:999};
restoreEquipment(changed,roster,state);
assert.deepEqual(state.inventory,first);
changed.equipment[0].enchantmentId = 'unsupported-enchantment';
restoreEquipment(changed,roster,state);
assert.deepEqual(state.inventory.equipment[0].stats,staff.stats);
assert.equal(state.inventory.equipment[0].enchantmentId,undefined);
console.log('Catalog-only restoration, legacy ID translations, charges, ownership, invalid records and idempotence passed.');
