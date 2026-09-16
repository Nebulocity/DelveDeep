import { forgottenCavernWaves, voidPortalWaves } from './enemies.js';

const finalWaves = {
  Easy: [
    { name: 'The Slime Sovereign', boss: true, enemies: [
      { type: 'slimeSovereign', arenaX: 700, arenaY: 790 }
    ] }
  ],
  Moderate: [
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
  Void: [
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

// This function creates independent wave data for the selected difficulty.
// Existing waves stay intact, with the new boss encounter at the end.
export function createEncounterWaves(delve = {}) {

  const difficulty = delve.type === 'void' ? 'Void' : delve.difficulty ?? 'Easy';
  const base = difficulty === 'Void' ? voidPortalWaves : forgottenCavernWaves;
  const waves = [...base, ...(finalWaves[difficulty] ?? finalWaves.Easy)];

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
  return waves.map((wave) => ({
    ...wave, enemies: wave.enemies.map((enemy) => ({ ...enemy }))
  }));
}
