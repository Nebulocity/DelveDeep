// Exercise actual idle combat with the agreed level-5 starter party, without gear or
// leader commands. Repeated farming must stay safe after the healer spends its mana.
import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('level-5 starters survive Thornbriar progression and sustained idle farming', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'thornbriar-hollow' }));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyUnits?.length === 5);

  const results = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const { default: adventurers } = await import('/data/adventurers.js');
    const { rebuildCharacterStats } = await import('/game/CharacterStats.js');
    const { restoreAdventurerAbilities } = await import('/game/AdventurerAbilities.js');
    const { advanceIdleBattle, resumeIdleBattle } = await import('/combat/IdleBattle.js');
    const names = ['Caramon', 'Flint', 'Tika', 'Tanis', 'Goldmoon'];
    const runs = [];

    // Disable wall-clock pumping so only the seeded 50 ms idle steps advance combat.
    clearInterval(qa.game.backgroundProgress.timer);
    qa.game.loop.stop();
    const originalInfo = console.info;
    console.info = () => {};
    qa.game.backgroundProgress.isReplaying = true;
    try {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
        const previous = qa.game.scene.getScene('BattleScene');
        resumeIdleBattle(previous);
        delete previous.spawnWave;
        delete previous.update;
        delete previous.completeWave;
        qa.game.scene.stop('BattleScene');
        qa.state.roster = names.map(name => {
          const hero = rebuildCharacterStats({ ...structuredClone(adventurers.find(hero => hero.name === name)), level: 5, xp: 0, equipment: {} });
          return restoreAdventurerAbilities(hero, null);
        });
        qa.state.inventory.equipment = [];
        qa.state.activeParty = structuredClone(qa.state.roster);
        qa.state.delveCheckpoints = {};
        qa.state.run.entry = 'progress';
        qa.game.scene.start('BattleScene');
        const scene = qa.game.scene.getScene('BattleScene');
        scene.combatRngState = seed;
        for (const preference of scene.tactics.preferences.values()) preference.side = seed % 2 ? -1 : 1;
        scene.combatLog.persist = () => {};
        scene.isLeaderAbilityReady = () => false;
        const waves = [];
        let waveStats;
        const start = scene.spawnWave.bind(scene);

        // Record each fight before between-wave recovery raises injured allies to 50%.
        scene.spawnWave = index => {
          waveStats = { wave: index + 1, start: scene.time.now, lowestHp: 1, damage: 0, healing: 0, partySkills: 0, enemySkills: 0 };
          start(index);
        };
        const update = scene.update.bind(scene);
        scene.update = (time, delta) => {
          update(time, delta);
          if (waveStats && !scene.waveTransitioning) {
            waveStats.lowestHp = Math.min(waveStats.lowestHp, ...scene.partyUnits.map(unit => unit.hp / unit.maxHp));
          }
        };
        scene.combatLog.onEntry = entry => {
          if (!waveStats) return;
          if (entry.type === 'damage' && entry.targetSide === 'party') waveStats.damage += entry.amount;
          if (entry.type === 'healing' && entry.targetSide === 'party') waveStats.healing += entry.amount;
          if (entry.type === 'action' && entry.ability && !['Attack', 'Mend'].includes(entry.ability)) {
            if (names.includes(entry.actor)) waveStats.partySkills += 1;
            else waveStats.enemySkills += 1;
          }
        };
        const complete = scene.completeWave.bind(scene);
        scene.completeWave = () => {
          if (!scene.waveTransitioning && waveStats) {
            waves.push({ ...waveStats, seconds: (scene.time.now - waveStats.start) / 1000 });
          }
          complete();
        };

        // First walk through all nine ordinary waves with resources carried forward.
        advanceIdleBattle(scene, 600000, () => 0);
        const reachedCamp = qa.state.run.entry === 'camp';
        if (reachedCamp) {
          qa.state.run.entry = 'farm';
          scene.startWave(scene.bossWaveIndex - 1);

          // One simulated hour retains normal healing, mana, rewards and return phases.
          advanceIdleBattle(scene, 3600000, () => 0);
        }
        runs.push({ seed, reachedCamp, deaths: scene.combatLog.record.summary.partyDeaths,
          waves, party: scene.partyUnits.map(unit => ({ name: unit.name, hp: unit.hp, mana: unit.mana, alive: unit.alive })) });
      }
    } finally {
      console.info = originalInfo;
      qa.game.backgroundProgress.isReplaying = false;
    }
    return runs;
  });

  await mkdir('output/qa/thornbriar-balance', { recursive: true });
  await writeFile('output/qa/thornbriar-balance/results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map(run => ({ seed: run.seed, camp: run.reachedCamp, deaths: run.deaths,
    clears: run.waves.length, first: run.waves.slice(0, 9), last: run.waves.at(-1) }))));
  for (const run of results) {
    expect(run.reachedCamp).toBe(true);
    expect(run.deaths).toBe(0);
    expect(run.party.every(unit => unit.alive)).toBe(true);
    expect(run.waves.length).toBeGreaterThan(35);
    expect(run.waves.some(wave => wave.partySkills > 0)).toBe(true);
    expect(run.waves.some(wave => wave.enemySkills > 0)).toBe(true);

    // A moderate farm fight should need sustained attacks and healing, while leaving
    // a health margin. These broad bounds catch both lethal and trivial balance changes.
    expect(run.waves.slice(0, 9).map(wave => wave.wave)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const farm = run.waves.slice(9);
    const average = key => farm.reduce((total, wave) => total + wave[key], 0) / farm.length;
    expect(average('seconds')).toBeGreaterThan(20);
    expect(average('seconds')).toBeLessThan(55);
    expect(average('damage')).toBeGreaterThan(500);
    expect(Math.min(...farm.map(wave => wave.lowestHp))).toBeGreaterThan(0.4);
  }
});
