// Test all Pineshire progression and farm waves with visible-play stats during replay.
import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { simulateRegionalDelve } from './regionalDelveSimulation.js';

const profiles = [
  { delve: 'slime-cave', levels: [1, 3, 5] },
  { delve: 'thornbriar-hollow', levels: [5, 7, 10] },
  { delve: 'dolmark-den', levels: [10, 12, 15] },
  { delve: 'old-quarry', levels: [15, 17, 20] },
  { delve: 'sunken-watch', levels: [20, 23, 25] },
  { delve: 'murmuring-abyss', levels: [25, 26, 30], prepared: true }
];

for (const profile of profiles) {
  test(`${profile.delve} active progression and farm measurements`, async ({ page }) => {
    test.setTimeout(7200000);
    page.on('console', message => {
      if (message.text().startsWith('SIM ')) console.log(message.text());
    });
    await page.setViewportSize({ width: 915, height: 412 });
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.evaluate(delve => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve }), profile.delve);
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyUnits?.length === 5);
    const camps = profile.prepared ? [15, 33] : [undefined];
    const scenarios = camps.flatMap(campWave => [
      ...profile.levels.map(level => ({ mode: 'farm', level, prepared: profile.prepared, campWave })),
      { mode: 'farm', level: profile.prepared ? 26 : profile.levels[0], prepared: profile.prepared, campWave, control: true }
    ]);

    // Level 25 must still reach the early farm and continue progression with commands.
    // The later farm remains recommended at 26, so its entry-level check ends at camp.
    if (profile.prepared) {
      scenarios.splice(scenarios.findIndex(scenario => scenario.level === 25 && scenario.campWave === 33), 1,
        { mode: 'progress', level: 25, prepared: true, campWave: 33 });
      scenarios.push({ mode: 'farm', level: 25, prepared: true, campWave: 15, control: true },
        { mode: 'progress', level: 25, prepared: true, campWave: 33, control: true });
    }

    // Each preceding Delve adds one boss RP and one five-level character milestone.
    // Add the starting point for conservative entry budgets of 1/3/5/7/9/11 RP.
    const options = { delve: profile.delve, activeStats: true, activeLeadership: true,
      leaderBudget: 1 + profiles.indexOf(profile) * 2, parties: 6, partySeedStride: 104729,
      seeds: [11, 22], farmMs: Number(process.env.DELVE_ACTIVE_FARM_MS ?? 600000),
      candidates: [{ name: 'active-authored', tuning: {} }], scenarios };
    const results = await simulateRegionalDelve(page, options);
    await mkdir('output/qa/active-monsters/final', { recursive: true });
    await writeFile(`output/qa/active-monsters/final/${profile.delve}.json`, JSON.stringify({ options, results }, null, 2));

    // Balance outcomes are measurements, not a promise that all automatic parties win.
    // Catch a stuck simulation and require actual authored-wave clears in successful runs.
    expect(results.every(run => run.outcome !== 'timeout')).toBe(true);
    for (const run of results.filter(run => run.reachedCamp)) {
      const count = run.scenario.campWave ?? (profile.delve === 'slime-cave' ? 5
        : profile.delve === 'thornbriar-hollow' ? 9 : profile.delve === 'dolmark-den' ? 15 : 23);
      expect(run.waves.slice(0, count).map(wave => wave.wave)).toEqual(Array.from({ length: count }, (_, index) => index + 1));
      expect(run.waves.slice(count).every(wave => wave.wave === count)).toBe(true);
    }

    // Compare matching departure levels, rather than giving commands credit for a
    // stronger build. Require a viable commanded party and fewer actual casualties.
    const farmLevel = profile.prepared ? 26 : profile.levels[0];
    const matched = results.filter(run => run.scenario.mode === 'farm' && run.scenario.level === farmLevel);
    const assisted = matched.filter(run => run.scenario.control);
    const unattended = matched.filter(run => !run.scenario.control);
    const meanDeaths = runs => runs.reduce((sum, run) => sum + run.deaths, 0) / runs.length;
    expect(assisted.filter(run => run.reachedCamp).length / assisted.length).toBeGreaterThanOrEqual(0.75);
    expect(assisted.filter(run => run.outcome === 'farming').length / assisted.length).toBeGreaterThanOrEqual(0.75);
    expect(meanDeaths(unattended)).toBeGreaterThan(meanDeaths(assisted));
    expect(assisted.every(run => run.commands > 0 && run.fixture.tactics.spentRenownPoints <= options.leaderBudget
      && run.fixture.tactics.battleLoadout.length <= 5)).toBe(true);
  });
}
