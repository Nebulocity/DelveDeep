// Classes start with one class action and their selected generic skills.
// These skills are free at level 1; Spellward is learned separately at level 8.
const physical = name => `ability_v2_generic_physical_${name}`;
const magical = name => `ability_v2_generic_magical_${name}`;
const own = (className, name) => `ability_v2_${className}_${name}`;

export const CLASS_STARTER_KITS = Object.freeze({
  Runedancer: [own('runedance', 'amber_cadence'), magical('smite')],
  Gladiator: [own('gladiator', 'defiant_roar'), physical('intervene'), physical('lacerate')],
  Oathwarden: [own('oathwarden', 'judgement'), physical('intervene'), physical('lacerate')],
  Dawnwarden: [own('dawnwarden', 'dawn_s_shelter'), physical('interpose'), magical('smite')],
  Barbarian: [own('barbarian', 'intimidating_blow'), physical('cleave'), physical('combat_footwork')],
  Scoundrel: [own('scoundrel', 'sneak_attack'), physical('lacerate'), physical('combat_footwork')],
  Barmaid: [own('barmaid', 'bottle_smash'), physical('cleave'), physical('combat_footwork')],
  Ranger: [own('ranger', 'piercing_shot'), physical('lacerate'), physical('ready_weapon')],
  Umbramancer: [own('umbramancer', 'shadow_bolt'), magical('smite'), magical('arcane_focus')],
  Spellbinder: [own('spellbinder', 'magic_missile'), magical('smite'), magical('arcane_focus')],
  Arcanist: [own('arcanist', 'radiant_spear'), magical('smite'), magical('arcane_focus')],
  Dawnpriest: [own('dawnpriest', 'holy_light'), magical('rejuvenation_aura')],
  Grovekeeper: [own('grovekeeper', 'nature_s_touch'), magical('rejuvenation_aura')],
  Sanguinist: [own('sanguinist', 'blood_mend'), magical('rejuvenation_aura')]
});
