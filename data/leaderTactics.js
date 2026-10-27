// Each row is an authored tactic. Effects share the existing combat modifier and
// recovery systems; durations and cooldowns are combat milliseconds.
const buff = (changes, seconds, scope = 'party') => ({ kind: 'buff', changes, duration: seconds * 1000, scope });
const heal = (fraction, scope = 'party', count) => ({ kind: 'heal', fraction, scope, count });
const mana = (fraction, scope = 'mana', count) => ({ kind: 'mana', fraction, scope, count });
const cleanse = (count, scope = 'party') => ({ kind: 'cleanse', count, scope });
const strike = (school, potency, targets = 1, scope = 'party') => ({ kind: 'strike', school, potency, targets, scope });
const refresh = (fraction, category = null) => ({ kind: 'refresh', fraction, category, scope: 'party' });
const supplies = count => ({ kind: 'supplies', count, scope: 'party' });
const rise = (fraction, count) => ({ kind: 'revive', fraction, count, scope: 'fallen' });
const tactic = (id, name, shortName, rarity, cost, effects, cooldown = 60000) => ({
  id, name, shortName, rarity, cost, effects,
  ...(cooldown === null ? { oncePerEncounter: true } : { cooldown })
});

const assault = [
  // Six Common, four Uncommon, four Rare, two Epic and one Legendary.
  tactic('pressForward', 'Press Forward!', 'PRESS ON', 'common', 1, [buff({ attack: 0.08 }, 8, 'physical')], 45000),
  tactic('sparksTogether', 'Sparks Together!', 'SPARKS', 'common', 1, [buff({ spell: 0.08 }, 8, 'mages')], 45000),
  tactic('sureVolley', 'Sure Volley!', 'VOLLEY', 'common', 2, [strike('melee', 1.2, 1, 'physical')], 45000),
  tactic('cinderSignal', 'Cinder Signal!', 'CINDER', 'common', 2, [strike('spell', 0.75, 3, 'magical')], 45000),
  tactic('exposeWeakness', 'Expose Weakness!', 'EXPOSE', 'common', 2, [buff({ hit: 0.08, crit: 0.03 }, 8)], 45000),
  tactic('huntersFinish', 'Hunters Finish!', 'FINISH', 'common', 3, [strike('melee', 2, 1, 'physical')], 60000),
  tactic('ironCadence', 'Iron Cadence!', 'CADENCE', 'uncommon', 4, [buff({ attack: 0.15, hit: 0.05 }, 10, 'physical')]),
  tactic('emberConcord', 'Ember Concord!', 'CONCORD', 'uncommon', 4, [buff({ spell: 0.15, crit: 0.03 }, 10, 'mages')]),
  tactic('crossfire', 'Crossfire!', 'CROSSFIRE', 'uncommon', 5, [strike('melee', 1.5, 3, 'physical')], 75000),
  tactic('starfallSignal', 'Starfall Signal!', 'STARFALL', 'uncommon', 6, [strike('spell', 1.4, 4, 'magical')], 90000),
  tactic('breakTheirLine', 'Break Their Line!', 'BREAK LINE', 'rare', 8, [strike('melee', 2.5, 2, 'physical')], 90000),
  tactic('nightglassVolley', 'Nightglass Volley!', 'NIGHTGLASS', 'rare', 9, [strike('spell', 2, 4, 'magical')], 120000),
  tactic('warhornOfHighmere', 'Warhorn of Highmere!', 'WARHORN', 'rare', 9, [buff({ damage: 0.2, hit: 0.08 }, 12)], 120000),
  tactic('seizeTheOpening', 'Seize the Opening!', 'OPENING', 'rare', 10, [strike('melee', 3, 1, 'physical'), buff({ damage: 0.15 }, 8)], 120000),
  tactic('thunderOfTheCrags', 'Thunder of the Crags!', 'THUNDER', 'epic', 15, [strike('melee', 4, 3, 'physical'), buff({ attack: 0.2 }, 10, 'physical')], null),
  tactic('twilightConvergence', 'Twilight Convergence!', 'TWILIGHT', 'epic', 15, [strike('spell', 3, 5, 'magical'), buff({ spell: 0.2 }, 10, 'mages')], null),
  tactic('theLastWarhorn', 'The Last Warhorn!', 'LAST HORN', 'legendary', 50, [strike('strongest', 5, 5), buff({ damage: 0.3, hit: 0.1 }, 15)], null)
];
const protect = [
  // Six Common, six Uncommon, four Rare, two Epic and one Legendary.
  tactic('closeRanks', 'Close Ranks!', 'RANKS', 'common', 1, [buff({ armor: 0.25 }, 10)], 45000),
  tactic('watchYourStep', 'Watch Your Step!', 'SIDESTEP', 'common', 1, [buff({ dodge: 0.04 }, 8)], 45000),
  tactic('wardingCall', 'Warding Call!', 'WARD CALL', 'common', 2, [buff({ spellReduction: -0.2 }, 8)], 45000),
  tactic('guardTheWounded', 'Guard the Wounded!', 'GUARD', 'common', 2, [buff({ reduction: -0.4 }, 8, 'wounded')], 45000),
  tactic('plantYourFeet', 'Plant Your Feet!', 'PLANT FEET', 'common', 2, [buff({ armor: 0.35, block: 0.08 }, 10, 'tanks')], 45000),
  tactic('safePassage', 'Safe Passage!', 'PASSAGE', 'common', 3, [buff({ reduction: -0.15, movement: 0.2 }, 8)], 60000),
  tactic('oakheartFormation', 'Oakheart Formation!', 'OAKHEART', 'uncommon', 4, [buff({ armor: 0.5 }, 12)]),
  tactic('veilOfLanterns', 'Veil of Lanterns!', 'LANTERNS', 'uncommon', 4, [buff({ spellReduction: -0.3 }, 10)]),
  tactic('rescueCord', 'Rescue Cord!', 'RESCUE', 'uncommon', 5, [heal(0.15, 'wounded', 1), buff({ reduction: -0.45 }, 10, 'wounded')], 75000),
  tactic('shieldkeepersOath', 'Shieldkeepers Oath!', 'SHIELD OATH', 'uncommon', 5, [buff({ block: 0.12, reduction: -0.2 }, 10, 'tanks')], 75000),
  tactic('scatterTheShadows', 'Scatter the Shadows!', 'SCATTER', 'uncommon', 5, [buff({ dodge: 0.08, movement: 0.15 }, 10)], 75000),
  tactic('standTogether', 'Stand Together!', 'STAND', 'uncommon', 6, [buff({ reduction: -0.3 }, 12)], 90000),
  tactic('rampartOfPineshire', 'Rampart of Pineshire!', 'RAMPART', 'rare', 8, [buff({ armor: 0.65, reduction: -0.15 }, 12)], 90000),
  tactic('stormglassShelter', 'Stormglass Shelter!', 'STORMGLASS', 'rare', 9, [buff({ spellReduction: -0.45, dodge: 0.05 }, 12)], 120000),
  tactic('holdUntilDawn', 'Hold Until Dawn!', 'HOLD DAWN', 'rare', 9, [buff({ reduction: -0.4 }, 12)], 120000),
  tactic('breakTheSiege', 'Break the Siege!', 'BREAK SIEGE', 'rare', 10, [cleanse(1), buff({ reduction: -0.3, movement: 0.25 }, 12)], 120000),
  tactic('watchThatNeverFalls', 'Watch That Never Falls!', 'LAST WATCH', 'epic', 15, [buff({ reduction: -0.55 }, 12), heal(0.2)], null),
  tactic('highmereSanctuary', 'Highmere Sanctuary!', 'SANCTUARY', 'epic', 15, [cleanse(2), buff({ reduction: -0.35, spellReduction: -0.3 }, 15)], null),
  tactic('oathAgainstOblivion', 'Oath Against Oblivion!', 'GREAT OATH', 'legendary', 50, [cleanse(5), heal(0.4), buff({ reduction: -0.7 }, 15)], null)
];
const restore = [
  // Five Common, five Uncommon, three Rare, two Epic and one Legendary.
  tactic('fieldBandage', 'Field Bandage!', 'BANDAGE', 'common', 1, [heal(0.3, 'wounded', 1)], 30000),
  tactic('clearThought', 'Clear Thought!', 'CLARITY', 'common', 1, [mana(0.25, 'lowestMana', 1)], 45000),
  tactic('shakeItOff', 'Shake It Off!', 'SHAKE OFF', 'common', 2, [cleanse(1)], 60000),
  tactic('shareTheWaterskin', 'Share the Waterskin!', 'WATERSKIN', 'common', 2, [heal(0.12), mana(0.1)], 60000),
  tactic('catchYourBreath', 'Catch Your Breath!', 'BREATHE', 'common', 3, [heal(0.4, 'wounded', 2)], 60000),
  tactic('mendersCircle', 'Menders Circle!', 'MENDERS', 'uncommon', 4, [heal(0.35)], 75000),
  tactic('silverSpring', 'Silver Spring!', 'SPRING', 'uncommon', 4, [mana(0.35)], 90000),
  tactic('cleanseTheWound', 'Cleanse the Wound!', 'CLEANSE', 'uncommon', 5, [cleanse(1), heal(0.2)], 90000),
  tactic('hearthsideRespite', 'Hearthside Respite!', 'RESPITE', 'uncommon', 5, [heal(0.25), mana(0.25)], 90000),
  tactic('guideThemHome', 'Guide Them Home!', 'GUIDE HOME', 'uncommon', 6, [rise(0.4, 2)], null),
  tactic('wellsOfThornbriar', 'Wells of Thornbriar!', 'WELLS', 'rare', 8, [heal(0.5), mana(0.3)], 120000),
  tactic('washAwayTheNight', 'Wash Away the Night!', 'WASH NIGHT', 'rare', 9, [cleanse(3), heal(0.4)], 120000),
  tactic('rekindleTheCompany', 'Rekindle the Company!', 'REKINDLE', 'rare', 10, [rise(0.6, 2), heal(0.2)], null),
  tactic('theSecondSun', 'The Second Sun!', 'SECOND SUN', 'epic', 15, [rise(0.75, 3), heal(0.4), mana(0.4)], null),
  tactic('springOfTheDeep', 'Spring of the Deep!', 'DEEP SPRING', 'epic', 15, [cleanse(3), heal(1), mana(1)], null),
  tactic('dawnWithoutEnd', 'Dawn Without End!', 'ETERNAL DAWN', 'legendary', 50, [rise(1), heal(1), mana(1), cleanse(5), buff({ reduction: -0.25 }, 15)], null)
];
const prepare = [
  // Two Common, six Uncommon, four Rare, two Epic and one Legendary.
  tactic('checkYourGrip', 'Check Your Grip!', 'GRIP', 'common', 1, [buff({ hit: 0.06 }, 15)], 45000),
  tactic('steadyBreathing', 'Steady Breathing!', 'STEADY', 'common', 2, [buff({ speed: 0.08 }, 12)], 60000),
  tactic('scoutsBriefing', 'Scouts Briefing!', 'BRIEFING', 'uncommon', 4, [buff({ hit: 0.08, movement: 0.15 }, 15)]),
  tactic('sharpenThePlan', 'Sharpen the Plan!', 'SHARPEN', 'uncommon', 4, [buff({ crit: 0.06 }, 12)]),
  tactic('measuredTempo', 'Measured Tempo!', 'TEMPO', 'uncommon', 5, [buff({ speed: 0.15 }, 12)], 75000),
  tactic('spareFlasks', 'Spare Flasks!', 'FLASKS', 'uncommon', 5, [supplies(1), heal(0.2)], null),
  tactic('reviewTheForms', 'Review the Forms!', 'FORMS', 'uncommon', 5, [refresh(0.3, 'Assault')], 90000),
  tactic('wardensDrill', 'Wardens Drill!', 'DRILL', 'uncommon', 6, [refresh(0.35, 'Protect'), buff({ armor: 0.25 }, 10)], 90000),
  tactic('theNextOpening', 'The Next Opening!', 'NEXT OPEN', 'rare', 8, [refresh(0.4), buff({ hit: 0.08 }, 10)], 120000),
  tactic('cragwatchSignals', 'Cragwatch Signals!', 'SIGNALS', 'rare', 9, [buff({ speed: 0.2, movement: 0.2 }, 15)], 120000),
  tactic('readTheEnemy', 'Read the Enemy!', 'READ ENEMY', 'rare', 9, [buff({ crit: 0.1, hit: 0.1 }, 15)], 120000),
  tactic('reserveSatchels', 'Reserve Satchels!', 'SATCHELS', 'rare', 10, [supplies(2), mana(0.2)], null),
  tactic('perfectRehearsal', 'Perfect Rehearsal!', 'REHEARSAL', 'epic', 15, [refresh(0.75), buff({ speed: 0.2, hit: 0.1 }, 15)], null),
  tactic('quartermastersPromise', 'Quartermasters Promise!', 'PROMISE', 'epic', 15, [supplies(3), cleanse(2), mana(0.4)], null),
  tactic('thePlanBeyondDawn', 'The Plan Beyond Dawn!', 'MASTER PLAN', 'legendary', 50, [refresh(1), supplies(3), buff({ speed: 0.3, crit: 0.1, hit: 0.1 }, 20)], null)
];

export const ADDITIONAL_LEADER_TACTICS = Object.entries({ Assault: assault, Protect: protect, Restore: restore, Prepare: prepare })
  .flatMap(([category, entries]) => entries.map(entry => ({ ...entry, category,
    branch: { Assault: 'Command', Protect: 'Survival', Restore: 'Morale', Prepare: 'Preparation' }[category] })));

// Attackers contribute their current equipped power. Keep previews and execution on
// this same calculation; defense, accuracy and critical hits resolve afterward.
export function coordinatedTacticDamage(ability, attackers) {
  const spell = ability.id === 'lunarAssault';
  return Math.round(attackers.reduce((sum, unit) => sum + (spell
    ? unit.spellPower ?? unit.spellDamage ?? 0 : unit.attackPower ?? 0), 0) * ability.damageMultiplier);
}
