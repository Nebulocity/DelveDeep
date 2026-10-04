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
    { name: 'The Slime Sovereign', boss: true, enemies: [
      { type: 'slimeSovereign', arenaX: 700, arenaY: 790 }
    ] }
  ],
  Difficult: [
    { name: 'The Inner Guard', enemies: [
      { type: 'denGuard', arenaX: 480, arenaY: 770 },
      { type: 'denGuard', arenaX: 900, arenaY: 770 },
      { type: 'caveSlime', arenaX: 700, arenaY: 830 }
    ] },
    { name: 'The Den Colossus', boss: true, enemies: [
      { type: 'denColossus', arenaX: 700, arenaY: 820 },
      { type: 'denGuard', arenaX: 420, arenaY: 730 },
      { type: 'denGuard', arenaX: 980, arenaY: 730 }
    ] }
  ],
  Unknown: [
    { name: 'Beyond the Rift', enemies: [
      { type: 'riftSentinel', arenaX: 450, arenaY: 760 },
      { type: 'riftSentinel', arenaX: 950, arenaY: 760 },
      { type: 'voidStalker', arenaX: 700, arenaY: 830 }
    ] },
    { name: 'The Sovereign Guard', enemies: [
      { type: 'voidWarden', arenaX: 700, arenaY: 810 },
      { type: 'riftSentinel', arenaX: 420, arenaY: 740 },
      { type: 'riftSentinel', arenaX: 980, arenaY: 740 }
    ] },
    { name: 'The Abyssal Sovereign', boss: true, enemies: [
      { type: 'abyssalSovereign', arenaX: 700, arenaY: 830 },
      { type: 'riftSentinel', arenaX: 350, arenaY: 760 },
      { type: 'riftSentinel', arenaX: 1050, arenaY: 760 },
      { type: 'riftSentinel', arenaX: 700, arenaY: 620 }
    ] }
  ]
};

const slimeCaveWaves = [
  { name: 'Cave Slimes', caveSlimes: 2, d2: 1 },
  { name: 'The Slime Swarm', caveSlimes: 2, d2: 2 },
  { name: 'The Elder Puddle', caveSlimes: 2, d2: 2, elderSlimes: 1 },
  { name: 'The Elder Slimes', caveSlimes: 2, elderSlimes: 2 },
  { name: 'The Slime Horde', caveSlimes: 4, elderSlimes: 3 },
  { name: 'The Slime Sovereign', caveSlimes: 2, elderSlimes: 2, sovereigns: 1, boss: true }
];

const thornbriarWaves = [
  { name: 'Roadside Ambush', ruffians: { base: 4, dice: [2] } },
  { name: 'The Lashers', ruffians: { base: 2, dice: [2, 2] }, lashers: { dice: [2, 2] } },
  { name: 'Briar Hex', ruffians: { base: 2, dice: [2] }, lashers: { dice: [3] }, hedgeMages: 1 },
  { name: 'Thornbriar Patrol', ruffians: { base: 3, dice: [3] }, lashers: { base: 1, dice: [3] }, hedgeMages: 2 },
  { name: "Rongar's Guard", ruffians: { base: 5, dice: [3] }, lashers: { base: 2, dice: [3] }, hedgeMages: 3 },
  { name: 'Rongar the Crusher', ruffians: { base: 4 }, lashers: { base: 3 }, hedgeMages: 2, rongar: 1, boss: true }
];

const dolmarkWaves = [
  { name: 'Den Wardens', wardens: { base: 4, dice: [2] } },
  { name: 'The Warden Pack', wardens: { base: 4, dice: [2, 2] } },
  { name: 'The First Protector', wardens: { base: 2, dice: [2, 2] }, protectors: 1 },
  { name: 'The Den Guard', wardens: { base: 4 }, protectors: 2 },
  { name: 'The Forest Guard', wardens: { base: 4 }, protectors: 4 },
  { name: 'Silvanark the Forest Lord', wardens: { base: 3 }, protectors: 2, silvanark: 1, boss: true }
];

const verdantTearWaves = [
  { name: 'Grass at the Threshold', enemies: [
    { type: 'voidStalker', arenaX: 440, arenaY: 770 },
    { type: 'voidStalker', arenaX: 940, arenaY: 770 },
    { type: 'riftSentinel', arenaX: 700, arenaY: 820 }
  ] },
  { name: 'The Tear Widens', enemies: [
    { type: 'voidWarden', arenaX: 700, arenaY: 800 },
    { type: 'voidStalker', arenaX: 420, arenaY: 750 },
    { type: 'voidStalker', arenaX: 980, arenaY: 750 }
  ] },
  { name: 'A Shadow Takes Shape', enemies: [
    { type: 'abyssalMaw', arenaX: 700, arenaY: 810 },
    { type: 'riftSentinel', arenaX: 400, arenaY: 750 },
    { type: 'riftSentinel', arenaX: 1000, arenaY: 750 }
  ] },
  { name: 'The Unfinished Sovereign', boss: true, enemies: [
    { type: 'abyssalSovereign', arenaX: 700, arenaY: 830 },
    { type: 'riftSentinel', arenaX: 430, arenaY: 760 },
    { type: 'riftSentinel', arenaX: 970, arenaY: 760 }
  ] }
];


function buildSlimeCaveWaves(random) {
  return slimeCaveWaves.map(({ name, caveSlimes, d2 = 0, elderSlimes = 0, sovereigns = 0, boss = false }) => {
    const slimeCount = rollCount({ base: caveSlimes, dice: Array(d2).fill(2) }, random);
    const types = [
      ...Array(sovereigns).fill('slimeSovereign'),
      ...Array(elderSlimes).fill('elderSlime'),
      ...Array(slimeCount).fill('caveSlime')
    ];
    return {
      name, boss,
      enemies: types.map((type, index) => ({
        type, arenaX: 350 + (index % 4) * 235, arenaY: 760 + Math.floor(index / 4) * 75
      }))
    };
  });
}

function buildThornbriarWaves(random) {
  return thornbriarWaves.map(({ name, ruffians, lashers, hedgeMages = 0, rongar = 0, boss = false }) => {
    const ruffianCount = rollCount(ruffians, random);
    const lasherCount = rollCount(lashers, random);
    const types = [
      ...Array(rongar).fill('rongarTheCrusher'),
      ...Array(hedgeMages).fill('hedgeMage'),
      ...Array(lasherCount).fill('lasher'),
      ...Array(ruffianCount).fill('ruffian')
    ];
    return {
      name, boss,
      enemies: types.map((type, index) => ({
        type, arenaX: 350 + (index % 4) * 235, arenaY: 760 + Math.floor(index / 4) * 75
      }))
    };
  });
}

function buildDolmarkWaves(random) {
  return dolmarkWaves.map(({ name, wardens, protectors = 0, silvanark = 0, boss = false }) => {
    const types = [
      ...Array(silvanark).fill('silvanarkTheForestLord'),
      ...Array(protectors).fill('denProtector'),
      ...Array(rollCount(wardens, random)).fill('denWarden')
    ];
    return {
      name, boss,
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
  const waves = delve.id === 'slime-cave'
    ? buildSlimeCaveWaves(random)
    : delve.id === 'thornbriar-hollow'
      ? buildThornbriarWaves(random)
      : delve.id === 'dolmark-den'
        ? buildDolmarkWaves(random)
        : delve.id === 'verdant-tear'
          ? verdantTearWaves
          : [...difficultyWaves, ...finale];

  // Preserve the fifth-depth guardian rule before the final boss so the
  // difficulty's advertised boss group still closes the encounter.
  if ((delve.depth ?? 1) % 5 === 0) {
    waves.splice(waves.length - 1, 0, {
      name: 'Void-Key Guardian', boss: true, milestoneBoss: true,
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
