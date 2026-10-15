// Equipment inspection reads the catalog for flavor and restrictions, and the owned
// copy for bonuses so enchantments appear without changing the saved item format.
import { unifiedSpellBonuses } from './SpellPower.js';
import { getCatalogItemDefinition, getPotionDefinition, itemMinimumLevel, ITEM_RARITIES } from '../data/items.js';
import { CLASS_PROGRESSION, CHANCE_STATS, progressionResources } from '../config/characterProgression.js';

const labels = { strength: 'Strength', agility: 'Agility', constitution: 'Constitution',
  intellect: 'Intellect', wisdom: 'Wisdom', block: 'Block', dodge: 'Dodge',
  hitChance: 'Hit Chance', critChance: 'Crit Chance', attackPower: 'Attack Power',
  spellPower: 'Spell Power', maxHp: 'Health',
  maxMana: 'Mana', armor: 'Armor', speed: 'Speed', critMultiplier: 'Crit Multiplier' };
const number = value => Number(value.toFixed(2));

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
    `Minimum level: ${Number.isFinite(level) ? level : 'Not yet available'}${rarity ? ` (${rarity})` : ''}`];
  if (potion) lines.push(`${item.charges ?? potion.uses}/${potion.uses} uses. ${potion.description}`);

  // Show the owned item's direct bonuses only. Character stat screens still apply attribute conversions.
  const stats = item.stats ?? definition?.stats ?? {};
  for (const [stat, amount] of Object.entries(unifiedSpellBonuses(stats))) {
    if (!Number.isFinite(amount) || amount === 0) continue;
    const chance = CHANCE_STATS.includes(stat);
    lines.push(`${amount > 0 ? '+' : ''}${number(amount * (chance ? 100 : 1))}${chance ? '%' : ''} ${labels[stat] ?? stat}`);
  }
  return { title: item.name, description: lines.join('\n'), align: 'left', panelWidth: 1500,
    enchantmentId: item.enchantmentId ?? null, usableBy: classes };
}
