export const ENCHANTMENTS = [
  { id: 'minor-might', name: 'Minor Might', slots: ['weapon'], stats: { attackPower: 1 }, ingredients: { essence: 2, iron: 2 }, price: 80, description: '+1 Attack on a weapon.' },
  { id: 'minor-mending', name: 'Minor Mending', slots: ['weapon'], stats: { healPower: 1 }, ingredients: { essence: 2, herb: 2 }, price: 80, description: '+1 Healing on a weapon.' },
  { id: 'minor-vigor', name: 'Minor Vigor', slots: ['armor', 'accessory'], stats: { maxHp: 6 }, ingredients: { essence: 2, cloth: 2 }, price: 80, description: '+6 HP on armor or an accessory.' }
];
export const ENCHANTMENT_BY_ID = Object.fromEntries(ENCHANTMENTS.map(entry => [entry.id, entry]));
