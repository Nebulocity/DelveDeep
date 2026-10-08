// These are plain-language descriptions for held stat details. They explain the
// player-facing values; the actual growth and combat formulas live in the stat
// configuration and game helpers.

export const STAT_DESCRIPTIONS = {
  Level: 'Character level determines stat growth and skill training requirements. Adventurer XP advances the next level.',
  Health: 'The damage an adventurer can take before falling. Healing and Health Potions restore lost Health up to this maximum.',
  Mana: 'The resource used by mana-based skills. Mana regeneration and Mana Potions restore it up to this maximum.',
  Armor: 'Reduces incoming physical damage. It does not reduce spell damage.',
  Dodge: 'The chance to avoid incoming damage from physical hits.',
  Block: 'The chance to mitigate incoming damage against physical hits.',
  Speed: 'Determines attack cooldowns and windups.',
  Strength: 'Increases attack power for all classes, and Block Chance for tanks.',
  Agility: 'Increases crit and hit chance, as well as Attack Power for Scoundrels and Rangers.',
  Constitution: "Increases a character's maximum Health and Armor.",
  Intellect: "Increases a character's maximum Mana, as well as damage done by Spells and mana-based Abilities.",
  Wisdom: "Increases a character's maximum Mana, as well as healing done by Spells and mana-based Abilities.",
  'Hit Chance': 'Determines the chance a character will hit an enemy. Stronger enemies are harder to hit.',
  'Crit Chance': 'The shared critical chance for all attacks, spells, and healing.',
  'Crit Multiplier': 'The multiplier applied by a critical attack, spell, or heal. For example, 1.3x means 130% of normal damage or healing before mitigation.',
  'Attack Power': 'Determines basic attack damage and physical skill potency.',
  'Spell Damage': 'Determines damaging spell potency.',
  'Spell Healing': 'Determines healing spell potency.',
  Happiness: 'Affects Gold prices for skill training. Happier adventurers pay less.',
  'Delves Cleared': 'The number of completed Delves credited to this adventurer.',
  'Skill points': 'Spent with Gold to learn or train skills. Higher ranks cost more skill points.'
};
