// Runedance mixes weapon strikes with locally summoned gemstone runes. All distances
// are arena units (100 per pace); durations and cooldowns are combat milliseconds.
const power = (text, potency, basis = 'Caster Spell Power', extra = {}) =>
  ({ text, potency, basis, unit: '% of power basis', cap: null, ...extra });
const bonus = (text, potency) => ({ text, potency, basis: 'None', unit: '% change', cap: null });
const none = power('None', 0, 'None');

// Each record uses the shared training/rank system. Fixed resource fractions improve
// through cooldowns instead of turning emergency runes into full resource refills.
function rune(slug, name, category, handler, primary, secondary = none, options = {}) {
  return {
    id: 'ability_v2_runedance_' + slug, name, className: 'Runedance', category, handler,
    primary, secondary, targetLabel: 'Self', castRange: 'Self', shape: 'Circle',
    anchor: 'Ground position', radius: 200, width: 0, maxTargets: 'All',
    duration: 6000, durationCap: 10000, secondaryDuration: 0, secondaryDurationCap: 0,
    cooldown: 18000, cooldownFloor: 9000, windup: 300, tickInterval: 0,
    damageType: 'spell', element: 'arcane', manaFraction: 0.05, healthFraction: 0,
    healthPayer: 'None', starterFor: [], secondaryArea: 'None',
    trigger: 'When useful and ready; respects player orders.',
    limits: 'One rune of each name per caster. Runes expire at wave end. Triggered damage cannot trigger other runes.',
    ...options
  };
}

export const RUNEDANCE_ABILITIES = [
  rune('amber_cadence', 'Amber Cadence', 'Assault', 'runeCadence',
    power('Strike one enemy for [x] physical damage.', 0.7, 'Caster Attack Power'),
    power('Leave an amber rune. Your next basic hit while within two paces detonates it for [y] magical damage to enemies nearby.', 0.45),
    { targetLabel: 'Single enemy', castRange: 'Weapon reach', damageType: 'physical', cooldown: 10000, cooldownFloor: 5000, starterFor: ['Runedance'] }),
  rune('fluorite_flourish', 'Fluorite Flourish', 'Assault', 'runeFlourish',
    power('Etch a fluorite rune through one enemy for [x] magical damage.', 0.85),
    power('Its lingering glyph deals [y] total magical damage over the duration to enemies within two paces.', 0.5),
    { targetLabel: 'Single enemy', castRange: 'Weapon reach', tickInterval: 1000, duration: 4000 }),
  rune('amethyst_traverse', 'Amethyst Traverse', 'Assault', 'runeTraverse',
    power('Step beside an enemy and strike for [x] magical damage. Hold orders prevent the step.', 0.8),
    power('Leave a rune at your departure point. The first enemy entering two paces detonates it for [y] magical damage nearby.', 0.6),
    { targetLabel: 'Single enemy', castRange: 300, cooldown: 16000, cooldownFloor: 8000 }),
  rune('topaz_finale', 'Topaz Finale', 'Assault', 'runeFinale',
    power('Form a topaz rune beside your blade and deal [x] physical damage to enemies within two paces.', 0.55, 'Caster Attack Power'),
    power('The rune immediately shatters for [y] magical damage to those enemies.', 0.7),
    { duration: 0, durationCap: 0, cooldown: 16000, cooldownFloor: 8000 }),
  rune('fluorite_step', 'Fluorite Step', 'Protect', 'runeMovement',
    bonus('Allies within two paces of the floating fluorite rune gain [x]% movement speed.', 0.2), none,
    { starterFor: ['Runedance'] }),
  rune('amber_tempo', 'Amber Tempo', 'Protect', 'runeSpeed',
    bonus('Allies within two paces of the floating amber rune gain [x]% action speed.', 0.15)),
  rune('amethyst_edge', 'Amethyst Edge', 'Protect', 'runeDamage',
    bonus('Allies within two paces of the floating amethyst rune deal [x]% more damage.', 0.12)),
  rune('topaz_shelter', 'Topaz Shelter', 'Protect', 'runeReduction',
    bonus('Allies within two paces of the floating topaz rune take [x]% less damage.', 0.08)),
  rune('mercy_glyph', 'Mercy Glyph', 'Prepare', 'runeMercy',
    power('When a living ally within two paces falls below 35% Health, consume the jade rune to restore [x] Health once.', 0.15, 'Recipient maximum Health', { fixedPotency: true }), none,
    { duration: 8000, cooldown: 24000, cooldownFloor: 12000, starterFor: ['Runedance'] }),
  rune('mirror_sigil', 'Mirror Sigil', 'Prepare', 'runeMirror',
    { text: 'When an enemy critically hits an ally within two paces, consume the silver rune to deal [x]% of the actual critical damage to every enemy nearby.', potency: 1, unit: '% of measured amount', basis: 'Measured critical damage', cap: null, fixedPotency: true }, none,
    { duration: 8000, cooldown: 24000, cooldownFloor: 12000 }),
  rune('snaring_verse', 'Snaring Verse', 'Prepare', 'runeSnare',
    power('The first enemy entering two paces of the violet rune shatters it for [x] magical damage to enemies nearby.', 0.65),
    bonus('Roots affected enemies for the secondary duration.', 0),
    { duration: 8000, secondaryDuration: 2000, secondaryDurationCap: 3500, cooldown: 22000, cooldownFloor: 11000 }),
  rune('refrain_of_return', 'Refrain of Return', 'Prepare', 'runeMana',
    power('The first ally below 70% Mana entering two paces consumes the blue rune to recover [x] Mana.', 0.08, 'Recipient maximum Mana', { fixedPotency: true }), none,
    { duration: 8000, cooldown: 24000, cooldownFloor: 12000 })
];
