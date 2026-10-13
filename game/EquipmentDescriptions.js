// Equipment inspection reads the catalog for flavor and restrictions, and the owned
// copy for bonuses so enchantments appear without changing the saved item format.
import { getCatalogItemDefinition, getPotionDefinition, itemMinimumLevel, ITEM_RARITIES } from '../data/items.js';
import { ATTRIBUTE_STATS, CLASS_PROGRESSION, CHANCE_STATS, progressionResources } from '../config/characterProgression.js';
import { equipmentStatsText } from './Equipment.js';

const labels = { strength: 'Strength', agility: 'Agility', constitution: 'Constitution',
  intellect: 'Intellect', wisdom: 'Wisdom', block: 'Block', dodge: 'Dodge',
  hitChance: 'Hit Chance', critChance: 'Crit Chance', attackPower: 'AP',
  spellDamage: 'Spell Damage', spellHealing: 'Spell Healing', maxHp: 'Health',
  maxMana: 'Mana', armor: 'Armor' };
const number = value => Number(value.toFixed(2));

// Derive each attribute's secondary gains through the same calculations used by combat.
// Chance differences are percentage points, so multiply their fractions by 100.
function attributeGains(stat, amount, className, level) {
  const before = progressionResources(className, level);
  const after = progressionResources(className, level, { [stat]: amount });
  if (!before || !after) return '';
  return ['block', 'dodge', 'hitChance', 'critChance', 'attackPower', 'spellDamage',
    'spellHealing', 'maxHp', 'maxMana', 'armor'].flatMap(key => {
    const chance = CHANCE_STATS.includes(key);
    const gain = number((after[key] - before[key]) * (chance ? 100 : 1));
    return gain ? [`${gain > 0 ? '+' : ''}${gain}${chance ? '%' : ''} ${labels[key]}`] : [];
  }).join(', ');
}

// Keep compact card summaries separate from full, scrollable item inspection.
export function equipmentDetails(item, hero) {
  const definition = getCatalogItemDefinition(item.itemId ?? item.id);
  const potion = item.slot === 'potion' ? getPotionDefinition(item.itemId ?? item.id) : null;
  let classes = definition?.usableBy ?? item.usableBy ?? [item.className ?? 'All'];

  // Mana packs require a class with a Mana resource; Health packs suit every class.
  if (potion?.effect.resource === 'mana') {
    classes = Object.keys(CLASS_PROGRESSION).filter(name => progressionResources(name, 1).maxMana > 0);
  }
  const level = itemMinimumLevel(item);
  const rarity = ITEM_RARITIES[definition?.rarity ?? item.rarity]?.label;
  const lines = [definition?.description ?? item.description ?? 'An adventurer\'s equipment.',
    `Classes: ${classes.includes('All') ? 'All classes' : classes.join(', ')}`,
    `Minimum level: ${Number.isFinite(level) ? level : 'Not yet available'}${rarity ? ` (${rarity})` : ''}`];
  if (potion) lines.push(`${item.charges ?? potion.uses}/${potion.uses} uses. ${potion.description}`);

  // Without a selected character, group identical conversions across compatible classes.
  // For a selected hero use their current level, including its natural chance caps.
  const names = hero ? [hero.className] : classes.includes('All') ? Object.keys(CLASS_PROGRESSION) : classes;
  const stats = item.stats ?? definition?.stats ?? {};
  for (const [stat, amount] of Object.entries(stats)) {
    if (!Number.isFinite(amount) || amount === 0) continue;
    let text = equipmentStatsText({ [stat]: amount });
    if (ATTRIBUTE_STATS.includes(stat)) {
      const groups = new Map();
      for (const name of names) {
        const gains = attributeGains(stat, amount, name, hero?.level ?? 1);
        if (gains) groups.set(gains, [...(groups.get(gains) ?? []), name]);
      }
      text = `+${number(amount)} ${labels[stat]}`;
      const gains = [...groups].map(([value, group]) => groups.size > 1 ? `${group.join(', ')}: ${value}` : value);
      if (gains.length) text += ` (${gains.join('; ')})`;
    }
    lines.push(text);
  }
  if (Object.keys(stats).some(stat => ATTRIBUTE_STATS.includes(stat))) {
    lines.push(`Attribute gains at level ${hero?.level ?? 1}, before other equipment; chance caps apply.`);
  }
  return { title: item.name, description: lines.join('\n'), align: 'left', panelWidth: 1500,
    enchantmentId: item.enchantmentId ?? null };
}
