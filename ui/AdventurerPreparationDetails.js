import { ENCHANTMENT_BY_ID } from '../data/enchantments.js';
import { getEquippedAdventurer, equippedItem } from '../game/Equipment.js';
import { abilitySummary } from '../game/AbilityDescriptions.js';
import { battleAbilities } from '../game/AdventurerAbilities.js';

export function adventurerPreparationDetails(hero) {
  const stats = getEquippedAdventurer(hero);

  const skills = Object.values(battleAbilities(hero)).map(ability => abilitySummary(stats, ability));

  return {
    title: hero.name, className: hero.className, classHeader: `${hero.shortName ?? hero.className} · Level ${hero.level}`, align: 'left',
    mapCharacterId: hero.id,
    description: `${hero.className} | ${hero.role} | Level ${hero.level}\n\nHealth: ${Math.round(stats.maxHp)} | Mana: ${Math.round(stats.maxMana ?? 0)} | Armor: ${Math.round(stats.armor ?? 0)}\nAttack Power: ${Math.round(stats.attackPower)} | Spell Power: ${Math.round(stats.spellPower ?? Math.max(stats.spellDamage ?? 0, stats.spellHealing ?? 0))}\nSpeed: ${Math.round(stats.speed ?? 100)} | Dodge: ${Math.round((stats.dodge ?? 0) * 100)}% | Crit: ${Math.round((stats.critChance ?? 0) * 100)}%\n\nEquipped Skills\n${skills.length ? skills.join('\n\n') : 'No skills equipped.'}`,
    gear: ['weapon', 'armor', 'accessory', 'potion'].map(slot => {
      const item = equippedItem(hero, slot);

      return { slot, name: item?.name ?? 'Empty slot', enchantmentId: item?.enchantmentId ?? null,
        enchantmentName: item?.enchantmentId ? ENCHANTMENT_BY_ID[item.enchantmentId]?.name?.replace(/^Scroll of /, '') : null,
        summary: item?.slot === 'potion' ? `${item.charges}/3 potions` : '' };
    })
  };
}

