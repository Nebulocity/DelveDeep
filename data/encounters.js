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

function rollCount({ base = 0, dice = [] } = {}, random) {
  return base + dice.reduce((total, sides) => total + 1 + Math.floor(random() * sides), 0);
}

function standardizeWaveEnemies(enemies, targetCount) {
  const reduced = [...enemies];
  while (reduced.length > targetCount) {
    const counts = reduced.reduce((totals, enemy) =>
      totals.set(enemy.type, (totals.get(enemy.type) ?? 0) + 1), new Map());
    let removeIndex = reduced.length - 1;
    for (let index = reduced.length - 2; index > 0; index--) {
      if (counts.get(reduced[index].type) > counts.get(reduced[removeIndex].type)) removeIndex = index;
    }
    reduced.splice(removeIndex, 1);
  }
  for (let index = reduced.length; index < targetCount; index++) {
    const source = enemies[(index - enemies.length) % enemies.length];
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


function buildSlimeCaveWaves(random) {
  return slimeCaveWaves.map(({ caveSlimes, d2 = 0, elderSlimes = 0, sovereigns = 0, boss = false }) => {
    const slimeCount = rollCount({ base: caveSlimes, dice: Array(d2).fill(2) }, random);
    const types = [
      ...Array(sovereigns).fill('slimeSovereign'),
      ...Array(elderSlimes).fill('elderSlime'),
      ...Array(slimeCount).fill('caveSlime')
    ];
    return {
      boss,
      enemies: types.map((type, index) => ({
        type, arenaX: 350 + (index % 4) * 235, arenaY: 760 + Math.floor(index / 4) * 75
      }))
    };
  });
}

function buildThornbriarWaves(random) {
  return thornbriarWaves.map(({ ruffians, lashers, hedgeMages = 0, rongar = 0, boss = false }) => {
    const ruffianCount = rollCount(ruffians, random);
    const lasherCount = rollCount(lashers, random);
    const types = [
      ...Array(rongar).fill('rongarTheCrusher'),
      ...Array(hedgeMages).fill('hedgeMage'),
      ...Array(lasherCount).fill('lasher'),
      ...Array(ruffianCount).fill('ruffian')
    ];
    return {
      boss,
      enemies: types.map((type, index) => ({
        type, arenaX: 350 + (index % 4) * 235, arenaY: 760 + Math.floor(index / 4) * 75
      }))
    };
  });
}

function buildDolmarkWaves(random) {
  return dolmarkWaves.map(({ wardens, protectors = 0, silvanark = 0, boss = false }) => {
    const types = [
      ...Array(silvanark).fill('silvanarkTheForestLord'),
      ...Array(protectors).fill('denProtector'),
      ...Array(rollCount(wardens, random)).fill('denWarden')
    ];
    return {
      boss,
      enemies: types.map((type, index) => ({
        type, arenaX: 350 + (index % 4) * 235, arenaY: 760 + Math.floor(index / 4) * 75
      }))
    };
  });
}





// This function creates independent wave data for the selected delve.
// Slime Cave, Thornbriar, and Dolmark have authored waves; other delves use difficulty waves.
export function createEncounterWaves(delve = {}, arenaWidth = 1400, random = Math.random) {

  const isVoid = delve.type === 'void';
  const difficulty = isVoid ? 'Unknown' : delve.difficulty ?? 'Easy';
  const base = isVoid ? voidPortalWaves : forgottenCavernWaves;
  const finale = isVoid ? finalWaves.Unknown
    : difficulty === 'Easy' ? finalWaves.Easy : finalWaves.Difficult;
  const targetCount = isVoid ? base.length + finale.length
    : encounterWaveCounts[difficulty] ?? encounterWaveCounts.Easy;
  const repeatable = base.filter(wave => !wave.boss);
  const openingCount = targetCount - finale.length;
  const difficultyWaves = Array.from({ length: openingCount }, (_, index) =>
    index < base.length ? base[index] : repeatable[(index - base.length) % repeatable.length]);
  const encounterId = delve.encounterId ?? delve.id;
  const waves = encounterId === 'slime-cave'
    ? buildSlimeCaveWaves(random)
    : encounterId === 'thornbriar-hollow'
      ? buildThornbriarWaves(random)
      : encounterId === 'dolmark-den'
        ? buildDolmarkWaves(random)
        : encounterId === 'verdant-tear'
          ? verdantTearWaves
          : [...difficultyWaves, ...finale];

  // Preserve the fifth-depth guardian rule before the final boss so the
  // difficulty's advertised boss group still closes the encounter.
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
  return waves.map((wave) => ({
    ...wave, enemies: (wave.boss
      ? standardizeWaveEnemies(wave.enemies, Math.max(1, Math.round(wave.enemies.length * 0.8)))
      : standardizeWaveEnemies(wave.enemies, encounterEnemyCounts[difficulty] ?? encounterEnemyCounts.Easy))
      .map((enemy) => ({ ...enemy, arenaX: enemy.arenaX + centerOffset }))
  }));
}
