// These are starting roster definitions, not live combat units. Stable IDs link saves,
// portraits and starter gear. The game rebuilds progression and equipment bonuses from
// these definitions instead of permanently changing the catalog.

import { createAdventurer } from './classes.js';

const adventurers = [
  createAdventurer('dalamar', 'Dalamar', 'Mage of the Umbral Veil'),
  createAdventurer('palin', 'Palin', 'Mage of the Luminous Archive'),
  createAdventurer('caramon-gladiator', 'Caramon', 'Gladiator', {
    maxHp: 168,
    attackPower: 15,
    moveSpeed: 158,
    critChance: 0.12,
    happiness: 74
  }),

  createAdventurer('sturm', 'Sturm', 'Oathwarden', {
    maxHp: 190,
    attackPower: 8,
    moveSpeed: 132,
    armor: 0.26,
    critChance: 0.06,
    happiness: 70
  }),

  createAdventurer('laurana', 'Laurana', 'Dawnwarden', {
    color: 0xfacc15,
    maxHp: 176,
    attackPower: 10,
    moveSpeed: 142,
    critChance: 0.11,
    happiness: 78
  }),

  createAdventurer('riverwind', 'Riverwind', 'Barbarian', {
    maxHp: 138,
    attackPower: 17,
    moveSpeed: 178,
    critChance: 0.18,
    happiness: 75
  }),

  createAdventurer('flint', 'Flint', 'Barbarian', {
    color: 0x9a3412,
    maxHp: 149,
    attackPower: 15,
    moveSpeed: 156,
    critChance: 0.13,
    happiness: 72
  }),

  createAdventurer('tasslehoff', 'Tasslehoff', 'Scoundrel', {
    maxHp: 89,
    attackPower: 14,
    moveSpeed: 215,
    critChance: 100.00,
    happiness: 84
  }),

  createAdventurer('tika', 'Tika', 'Barmaid', {
    color: 0xc026d3,
    maxHp: 97,
    attackPower: 12,
    moveSpeed: 208,
    critChance: 0.22,
    happiness: 76
  }),

  createAdventurer('tanis', 'Tanis', 'Ranger', {
    maxHp: 108,
    attackPower: 16,
    moveSpeed: 171,
    critChance: 0.20,
    happiness: 77
  }),

  createAdventurer('raistlin', 'Raistlin', 'Mage of the Crimson Spire', {
    maxHp: 72,
    attackPower: 19,
    moveSpeed: 124,
    critChance: 0.22,
    happiness: 66
  }),

  createAdventurer('goldmoon', 'Goldmoon', 'Cleric of the Verdant Covenant', {
    maxHp: 116,
    healPower: 18,
    moveSpeed: 150,
    critChance: 0.12,
    happiness: 82
  }),

  createAdventurer('mishakal', 'Mishakal', 'Cleric of the Everbright', {
    maxHp: 97,
    healPower: 24,
    moveSpeed: 132,
    critChance: 0.16,
    happiness: 79
  }),

  createAdventurer('fistandantilus', 'Fistandantilus', 'Cleric of the Sanguine Song', {
    maxHp: 126,
    attackPower: 10,
    healPower: 26,
    moveSpeed: 144,
    critChance: 0.12,
    happiness: 68
  })
];

export default adventurers;
