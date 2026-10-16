// Runedancer mixes weapon strikes with locally summoned gemstone runes. All distances
// are arena units (100 per pace); durations and cooldowns are combat milliseconds.
const power = (text, potency, basis = 'Caster Spell Power', extra = {}) =>
  ({ text, potency, basis, unit: '% of power basis', cap: null, ...extra });
const bonus = (text, potency) => ({ text, potency, basis: 'None', unit: '% change', cap: null });
const none = power('None', 0, 'None');

// Each record uses the shared training/rank system. Fixed resource fractions improve
// through cooldowns instead of turning emergency runes into full resource refills.
function rune(slug, name, category, handler, primary, secondary = none, options = {}) {

  // IDs and handler names keep their original spelling so learned ranks, equipped
  // skills and recorded battles survive a change to the visible gemstone names.
  return {
    id: 'ability_v2_runedance_' + slug, name, className: 'Runedancer', category, handler,
    primary, secondary, targetLabel: 'Self', castRange: 'Self', shape: 'Circle',
    anchor: 'Ground position', radius: 200, width: 0, maxTargets: 'All',
    duration: 6000, durationCap: 10000, secondaryDuration: 0, secondaryDurationCap: 0,
    cooldown: 18000, cooldownFloor: 9000, windup: 300, tickInterval: 0,
    damageType: 'spell', element: 'arcane', manaFraction: 0.05, healthFraction: 0,
    healthPayer: 'None', starterFor: [], secondaryArea: 'None',
    trigger: 'When useful and ready; respects player orders.',
    limits: 'One Rune of each name per caster. Runes expire at wave end. Triggered damage cannot trigger other Runes.',
    ...options
  };
}

export const RUNEDANCER_ABILITIES = [

  // Assault Runes.  Garnet for basic, Ruby for more advanced.
  rune('amber_cadence', 'Garnet Stride', 'Assault', 'runeCadence',
    power('Strike one enemy for [x] physical damage.', 0.7, 'Caster Attack Power'),
    power('Leave a Garnet Rune. Your next basic hit while within two paces detonates it for [y] magical damage to enemies nearby.', 0.45),
    { targetLabel: 'Single enemy', castRange: 'Weapon reach', damageType: 'physical', cooldown: 10000, cooldownFloor: 5000, starterFor: ['Runedancer'] }),

  rune('fluorite_flourish', 'Garnet Flourish', 'Assault', 'runeFlourish',
    power('Etch a Garnet Rune through one enemy for [x] magical damage.', 0.85),
    power('Its lingering glyph deals [y] total magical damage over the duration to enemies within two paces.', 0.5),
    { targetLabel: 'Single enemy', castRange: 'Weapon reach', tickInterval: 1000, duration: 4000 }),
  
  rune('amethyst_traverse', 'Garnet Spring', 'Assault', 'runeTraverse',
    power('Step beside an enemy and strike for [x] magical damage. Hold orders prevent the step.', 0.8),
    power('Leave a Garnet Rune at your departure point. The first enemy entering two paces detonates it for [y] magical damage nearby.', 0.6),
    { targetLabel: 'Single enemy', castRange: 300, cooldown: 16000, cooldownFloor: 8000 }),

  rune('topaz_finale', 'Ruby Finale', 'Assault', 'runeFinale',
    power('Form a Ruby Rune beside your blade and deal [x] physical damage to enemies within two paces.', 0.55, 'Caster Attack Power'),
    power('The rune immediately shatters for [y] magical damage to those enemies.', 0.7),
    { duration: 0, durationCap: 0, cooldown: 16000, cooldownFloor: 8000 }),

  // Protect Runes.  Aquamarine for basic, Sapphire for more advanced
  rune('fluorite_step', 'Aquamarine Drift', 'Protect', 'runeMovement',
    bonus('Allies within two paces of the floating Aquamarine Rune gain [x]% movement speed.', 0.2), none,
    { starterFor: ['Runedancer'] }),
    
  rune('amber_tempo', 'Aquamarine Chassé', 'Protect', 'runeSpeed',
    bonus('Allies within two paces of the floating Aquamarine Rune gain [x]% action speed.', 0.15)),

  rune('amethyst_edge', 'Aquamarine Glide', 'Protect', 'runeDamage',
    bonus('Allies within two paces of the floating Aquamarine Rune deal [x]% more damage.', 0.12)),
  
  rune('topaz_shelter', 'Sapphire Reprise', 'Protect', 'runeReduction',
    bonus('Allies within two paces of the floating Sapphire Rune take [x]% less damage.', 0.08)),
  
  // Prepare Runes.  Fluorite for basic, Amethyst for more advanced.
  rune('mercy_glyph', 'Fluorite Sway', 'Prepare', 'runeMercy',
    power('Places a Fluorite Rune that, when a living ally within two paces falls below 35% Health, consume the rune to restore [x] Health once.', 0.15, 'Recipient maximum Health', { fixedPotency: true }), none,
    { duration: 8000, cooldown: 24000, cooldownFloor: 12000, starterFor: ['Runedancer'] }),
  
  rune('mirror_sigil', 'Fluorite Pivot', 'Prepare', 'runeMirror',
    { text: 'Places a Fluorite Rune that, when an enemy critically hits an ally within two paces, consume the rune to deal [x]% of the actual critical damage to every enemy nearby.', potency: 1, unit: '% of measured amount', basis: 'Measured critical damage', cap: null, fixedPotency: true }, none,
    { duration: 8000, cooldown: 24000, cooldownFloor: 12000 }),

  rune('snaring_verse', 'Fluorite Rise', 'Prepare', 'runeSnare',
    power('Places a Fluorite Rune that shatters when an enemy gets close, dealing [x] magical damage to enemies nearby.', 0.65),
    bonus('Roots affected enemies for the secondary duration.', 0),
    { duration: 8000, secondaryDuration: 2000, secondaryDurationCap: 3500, cooldown: 22000, cooldownFloor: 11000 }),

  rune('refrain_of_return', 'Amethyst Refrain', 'Prepare', 'runeMana',
    power('The first ally below 70% Mana entering two paces consumes the Amethyst Rune to recover [x] Mana.', 0.08, 'Recipient maximum Mana', { fixedPotency: true }), none,
    { duration: 8000, cooldown: 24000, cooldownFloor: 12000 })
];
