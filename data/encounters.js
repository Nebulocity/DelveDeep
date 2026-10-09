// Encounter templates connect authored environments and waves to Delve entries. A reused
// template keeps its environment's floor boundary and art. The world entry can still have
// its own clear record and checkpoint.

import { forgottenCavernWaves, voidPortalWaves } from './enemies.js';

export const encounterWaveCounts = Object.freeze({
  Easy: 6,
  Difficult: 10,
  Tough: 16,
  'Very Tough': 24,
  'Incredibly Tough': 34,
  Impossible: 50
});

export const encounterEnemyCounts = Object.freeze({
  Easy: 3,
  Difficult: 4,
  Tough: 5,
  'Very Tough': 6,
  'Incredibly Tough': 7,
  Impossible: 8,
  Unknown: 3
});

// Roll a whole-number count in the requested bounds using the supplied random source.
function rollCount({ base = 0, dice = [] } = {}, random) {

  // reduce carries an accumulated result from one entry to the next. The callback returns
  // the accumulator for the next step; the final argument supplies its starting value.
  return base + dice.reduce((total, sides) => total + 1 + Math.floor(random() * sides), 0);
}

// Apply the difficulty's ordinary-wave enemy count while retaining authored boss groups.
function standardizeWaveEnemies(enemies, targetCount) {

  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside.
  const reduced = [...enemies];
  while (reduced.length > targetCount) {

    // reduce carries an accumulated result from one entry to the next. The callback
    // returns the accumulator for the next step; the final argument supplies its starting
    // value. A Map pairs a key with a value. Unlike an array index, the key can be an ID
    // or an object; get/set read and write that same key.
    const counts = reduced.reduce((totals, enemy) =>
      totals.set(enemy.type, (totals.get(enemy.type) ?? 0) + 1), new Map());
    let removeIndex = reduced.length - 1;

    for (let index = reduced.length - 2; index > 0; index--) {
      if (counts.get(reduced[index].type) > counts.get(reduced[removeIndex].type)) removeIndex = index;
    }
    reduced.splice(removeIndex, 1);
  }

  for (let index = reduced.length; index < targetCount; index++) {

    // % gives the remainder. With a nonnegative index and positive list length, it wraps
    // the index back to the start of the list.
    const source = enemies[(index - enemies.length) % enemies.length];

    // Math.floor rounds toward the smaller whole number, so 3.8 becomes 3.
    reduced.push({ ...source, arenaX: 350 + (index % 4) * 235,
      arenaY: 760 + Math.floor(index / 4) * 75 });
  }

  return reduced;
}

const finalWaves = {
  Easy: [
    { boss: true, enemies: [
      { type: 'slimeSovereign', arenaX: 700, arenaY: 790 }
    ] }
  ],
  Difficult: [
    { enemies: [
      { type: 'denGuard', arenaX: 480, arenaY: 770 },
      { type: 'denGuard', arenaX: 900, arenaY: 770 },
      { type: 'caveSlime', arenaX: 700, arenaY: 830 }
    ] },

    { boss: true, enemies: [
      { type: 'denColossus', arenaX: 700, arenaY: 820 },
      { type: 'denGuard', arenaX: 420, arenaY: 730 },
      { type: 'denGuard', arenaX: 980, arenaY: 730 }
    ] }
  ],

  Unknown: [
    { enemies: [
      { type: 'riftSentinel', arenaX: 450, arenaY: 760 },
      { type: 'riftSentinel', arenaX: 950, arenaY: 760 },
      { type: 'voidStalker', arenaX: 700, arenaY: 830 }
    ] },

    { enemies: [
      { type: 'voidWarden', arenaX: 700, arenaY: 810 },
      { type: 'riftSentinel', arenaX: 420, arenaY: 740 },
      { type: 'riftSentinel', arenaX: 980, arenaY: 740 }
    ] },

    { boss: true, enemies: [
      { type: 'abyssalSovereign', arenaX: 700, arenaY: 830 },
      { type: 'riftSentinel', arenaX: 350, arenaY: 760 },
      { type: 'riftSentinel', arenaX: 1050, arenaY: 760 },
      { type: 'riftSentinel', arenaX: 700, arenaY: 620 }
    ] }
  ]
};

const slimeCaveWaves = [
  { caveSlimes: 2, d2: 1 },
  { caveSlimes: 2, d2: 2 },
  { caveSlimes: 2, d2: 2, elderSlimes: 1 },
  { caveSlimes: 2, elderSlimes: 2 },

  { caveSlimes: 4, elderSlimes: 3 },
  { caveSlimes: 2, elderSlimes: 2, sovereigns: 1, boss: true }
];

const thornbriarWaves = [
  { ruffians: { base: 4, dice: [2] } },
  { ruffians: { base: 2, dice: [2, 2] }, lashers: { dice: [2, 2] } },
  { ruffians: { base: 2, dice: [2] }, lashers: { dice: [3] }, hedgeMages: 1 },
  { ruffians: { base: 3, dice: [3] }, lashers: { base: 1, dice: [3] }, hedgeMages: 2 },

  { ruffians: { base: 5, dice: [3] }, lashers: { base: 2, dice: [3] }, hedgeMages: 3 },
  { ruffians: { base: 4 }, lashers: { base: 3 }, hedgeMages: 2, rongar: 1, boss: true }
];

const dolmarkWaves = [
  { wardens: { base: 4, dice: [2] } },
  { wardens: { base: 4, dice: [2, 2] } },
  { wardens: { base: 2, dice: [2, 2] }, protectors: 1 },
  { wardens: { base: 4 }, protectors: 2 },

  { wardens: { base: 4 }, protectors: 4 },
  { wardens: { base: 3 }, protectors: 2, silvanark: 1, boss: true }
];

const verdantTearWaves = [
  { enemies: [
    { type: 'voidStalker', arenaX: 440, arenaY: 770 },
    { type: 'voidStalker', arenaX: 940, arenaY: 770 },
    { type: 'riftSentinel', arenaX: 700, arenaY: 820 }
  ] },

  { enemies: [
    { type: 'voidWarden', arenaX: 700, arenaY: 800 },
    { type: 'voidStalker', arenaX: 420, arenaY: 750 },
    { type: 'voidStalker', arenaX: 980, arenaY: 750 }
  ] },

  { enemies: [
    { type: 'abyssalMaw', arenaX: 700, arenaY: 810 },
    { type: 'riftSentinel', arenaX: 400, arenaY: 750 },
    { type: 'riftSentinel', arenaX: 1000, arenaY: 750 }
  ] },

  { boss: true, enemies: [
    { type: 'abyssalSovereign', arenaX: 700, arenaY: 830 },
    { type: 'riftSentinel', arenaX: 430, arenaY: 760 },
    { type: 'riftSentinel', arenaX: 970, arenaY: 760 }
  ] }
];

// Keep the Abyss at six waves with its existing difficulty count and final boss rules.
// Only this encounter replaces placeholder creatures with the supplied void roster.
const murmuringAbyssWaves = [
  { enemies: [
    { type: 'voidCrawler', arenaX: 360, arenaY: 770 },
    { type: 'voidCrawler', arenaX: 650, arenaY: 800 },
    { type: 'voidWisp', arenaX: 520, arenaY: 845 }
  ] },
  { enemies: [
    { type: 'voidStalker', arenaX: 500, arenaY: 790 },
    { type: 'voidCrawler', arenaX: 310, arenaY: 750 },
    { type: 'voidWisp', arenaX: 710, arenaY: 750 }
  ] },
  { boss: true, enemies: [
    { type: 'voidKeeperGuardian', arenaX: 520, arenaY: 810 },
    { type: 'voidStalker', arenaX: 300, arenaY: 745 },
    { type: 'voidWisp', arenaX: 735, arenaY: 745 }
  ] },
  { enemies: [
    { type: 'voidKeeper', arenaX: 700, arenaY: 830 },
    { type: 'voidCrawler', arenaX: 450, arenaY: 760 },
    { type: 'voidStalker', arenaX: 950, arenaY: 760 }
  ] },
  { enemies: [
    { type: 'voidKeeper', arenaX: 700, arenaY: 810 },
    { type: 'voidStalker', arenaX: 420, arenaY: 740 },
    { type: 'voidWisp', arenaX: 980, arenaY: 740 }
  ] },
  { boss: true, enemies: [
    { type: 'abyssalSovereign', arenaX: 700, arenaY: 830 },
    { type: 'voidKeeper', arenaX: 350, arenaY: 760 },
    { type: 'voidStalker', arenaX: 1050, arenaY: 760 },
    { type: 'voidWisp', arenaX: 700, arenaY: 620 }
  ] }
];


// Build the ordered Slime Cave groups from its weak, tough and boss enemy definitions.
function buildSlimeCaveWaves(random) {

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry.
  return slimeCaveWaves.map(({ caveSlimes, d2 = 0, elderSlimes = 0, sovereigns = 0, boss = false }) => {

    // Restore the earlier dice-based authored counts. Difficulty normalization below
    // still trims ordinary Easy waves to three monsters before they enter combat.
    const slimeCount = rollCount({ base: caveSlimes, dice: Array(d2).fill(2) }, random);

    // ... expands these entries into the new list or call. It does not deep-copy the
    // objects inside.
    const types = [
      ...Array(sovereigns).fill('slimeSovereign'),
      ...Array(elderSlimes).fill('elderSlime'),
      ...Array(slimeCount).fill('caveSlime')
    ];

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    return {
      boss,
      enemies: types.map((type, index) => ({
        type, arenaX: 350 + (index % 4) * 235, arenaY: 760 + Math.floor(index / 4) * 75
      }))
    };
  });
}

// Build the bandit camp groups while keeping the authored boss finale.
function buildThornbriarWaves(random) {

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry.
  return thornbriarWaves.map(({ ruffians, lashers, hedgeMages = 0, rongar = 0, boss = false }) => {
    const ruffianCount = rollCount(ruffians, random);
    const lasherCount = rollCount(lashers, random);

    // ... expands these entries into the new list or call. It does not deep-copy the
    // objects inside.
    const types = [
      ...Array(rongar).fill('rongarTheCrusher'),
      ...Array(hedgeMages).fill('hedgeMage'),
      ...Array(lasherCount).fill('lasher'),
      ...Array(ruffianCount).fill('ruffian')
    ];

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    return {
      boss,
      enemies: types.map((type, index) => ({
        type, arenaX: 350 + (index % 4) * 235, arenaY: 760 + Math.floor(index / 4) * 75
      }))
    };
  });
}

// Build the den groups while keeping the authored boss finale.
function buildDolmarkWaves(random) {

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry.
  return dolmarkWaves.map(({ wardens, protectors = 0, silvanark = 0, boss = false }) => {

    // ... expands these entries into the new list or call. It does not deep-copy the
    // objects inside.
    const types = [
      ...Array(silvanark).fill('silvanarkTheForestLord'),
      ...Array(protectors).fill('denProtector'),
      ...Array(rollCount(wardens, random)).fill('denWarden')
    ];

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    return {
      boss,
      enemies: types.map((type, index) => ({
        type, arenaX: 350 + (index % 4) * 235, arenaY: 760 + Math.floor(index / 4) * 75
      }))
    };
  });
}






// Keep Sunken Watch's existing wave progression while replacing the bandit identities.
// The inherited arena positions are logical game units, not sprite-sheet pixels.
function buildSunkenWatchWaves(random) {
  const roster = { ruffian: 'sunkenWatcher', lasher: 'deepTongue',
    hedgeMage: 'drownedKnell', rongarTheCrusher: 'earthsinker' };

  // Copy each wave and spawn before changing its type so Thornbriar keeps its own data.
  return buildThornbriarWaves(random).map(wave => ({
    ...wave,
    enemies: wave.enemies.map(enemy => ({ ...enemy, type: roster[enemy.type] }))
  }));
}

// Preserve Quarry's six-wave progression and inherited arena coordinates. The Reaver
// joins the later waves; ordering keeps it visible after Easy's three-enemy limit.
function buildOldQuarryWaves(random) {
  const roster = { denWarden: 'quarryWorm', denProtector: 'quarryBehemoth',
    silvanarkTheForestLord: 'depthsSovereign' };
  return buildDolmarkWaves(random).map((wave, index) => {
    const spawns = wave.enemies.map(enemy => ({ ...enemy, type: roster[enemy.type] }));
    if (index >= 3) spawns[wave.boss ? 1 : 0].type = 'quarryReaver';
    return { ...wave, enemies: spawns };
  });
}

// This helper creates independent wave data for the selected delve. Slime Cave,
// Thornbriar, Dolmark, Quarry and Sunken Watch have authored waves; others use difficulty waves.
export function createEncounterWaves(delve = {}, arenaWidth = 1400, random = Math.random) {

  const isVoid = delve.type === 'void';

  // The condition before ? chooses the first value when true and the value after : when
  // false. ?? uses the fallback only for null or undefined. A real zero or false stays
  // intact.
  const difficulty = isVoid ? 'Unknown' : delve.difficulty ?? 'Easy';
  const base = isVoid ? voidPortalWaves : forgottenCavernWaves;
  const finale = isVoid ? finalWaves.Unknown
    : difficulty === 'Easy' ? finalWaves.Easy : finalWaves.Difficult;
  const targetCount = isVoid ? base.length + finale.length
    : encounterWaveCounts[difficulty] ?? encounterWaveCounts.Easy;

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  const repeatable = base.filter(wave => !wave.boss);
  const openingCount = targetCount - finale.length;
  const difficultyWaves = Array.from({ length: openingCount }, (_, index) =>
    index < base.length ? base[index] : repeatable[(index - base.length) % repeatable.length]);

  // Older Sunken Watch saves stored Thornbriar as their template. Its persistent map ID
  // now selects the new roster while keeping clears, checkpoints and camp progress.
  const encounterId = delve.id === 'verge-delves' ? 'sunken-watch'
    : delve.id === 'march-west-delves' ? 'old-quarry' : delve.encounterId ?? delve.id;

  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside.
  const waves = encounterId === 'slime-cave'
    ? buildSlimeCaveWaves(random)
    : encounterId === 'thornbriar-hollow'
      ? buildThornbriarWaves(random)
      : encounterId === 'sunken-watch'
        ? buildSunkenWatchWaves(random)
        : encounterId === 'old-quarry'
          ? buildOldQuarryWaves(random)
          : encounterId === 'dolmark-den'
            ? buildDolmarkWaves(random)
            : encounterId === 'verdant-tear'
              ? verdantTearWaves
              : encounterId === 'murmuring-abyss'
                ? murmuringAbyssWaves
                : [...difficultyWaves, ...finale];

  // Preserve the fifth-depth guardian rule before the final boss so the difficulty's
  // advertised boss group still closes the encounter.
  if ((delve.depth ?? 1) % 5 === 0) {
    waves.splice(waves.length - 1, 0, {
      boss: true, milestoneBoss: true,
      enemies: [
        { type: 'elderSlime', arenaX: 700, arenaY: 790 },
        { type: 'stoneCrawler', arenaX: 450, arenaY: 760 },
        { type: 'stoneCrawler', arenaX: 950, arenaY: 760 }
      ]
    });
  }

  const centerOffset = (arenaWidth - 1400) / 2;

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry.
  return waves.map((wave) => ({
    ...wave, enemies: (wave.boss
      ? standardizeWaveEnemies(wave.enemies, Math.max(1, Math.round(wave.enemies.length * 0.8)))
      : standardizeWaveEnemies(wave.enemies, encounterEnemyCounts[difficulty] ?? encounterEnemyCounts.Easy))
      .map((enemy) => ({ ...enemy, arenaX: enemy.arenaX + centerOffset }))
  }));
}
