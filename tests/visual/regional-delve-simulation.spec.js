// Run actual combat for the later Pineshire encounters, including both Abyss camps.
// Exploratory options and detailed reports stay local under the ignored output folder.
import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { simulateRegionalDelve } from './regionalDelveSimulation.js';

const profiles = [
  { delve: 'old-quarry', bossType: 'depthsSovereign', entry: 15, middle: 17, cap: 20, response: "Mountain's Wrath" },
  { delve: 'sunken-watch', bossType: 'earthsinker', entry: 20, middle: 23, cap: 25, response: 'Boulder Splash' },
  { delve: 'murmuring-abyss', bossType: 'abyssalSovereign', entry: 25, middle: 26, cap: 30 }
];

for (const profile of profiles) {
  test(`${profile.delve} progression, actual farms and prepared bosses`, async ({ page }) => {
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
    const prepared = profile.delve === 'murmuring-abyss';
    const scenarios = prepared ? [
      { mode: 'progress', level: 25, prepared: true, campWave: 33 },
      { mode: 'farm', level: 25, prepared: true, campWave: 15 },
      ...[15, 33].flatMap(campWave => [
        { mode: 'farm', level: 26, prepared: true, campWave },
        { mode: 'farm', level: 26, prepared: true, campWave, control: true },
        { mode: 'farm', level: 30, prepared: true, campWave }
      ])
    ] : [
      ...[profile.entry, profile.middle, profile.cap].map(level => ({ mode: 'farm', level })),
      { mode: 'farm', level: profile.entry, control: true }
    ];
    scenarios.push(
      { mode: 'boss', level: profile.cap, prepared, build: 'balanced' },
      { mode: 'boss', level: profile.cap, prepared, build: 'specialized' },
      { mode: 'boss', level: profile.cap, prepared, build: 'balanced', control: true, controlPolicy: profile.response }
    );
    const options = { ...profile, parties: 6, partySeedStride: 104729, seeds: [11, 22],
      farmMs: 600000, candidates: [{ name: 'authored', tuning: {} }], scenarios };
    const results = await simulateRegionalDelve(page, options);
    await mkdir('output/qa/regional-simulation', { recursive: true });
    await writeFile(`output/qa/regional-simulation/${profile.delve}-regression.json`, JSON.stringify({ options, results }, null, 2));

    // Each progression sequence carries its real resources into farming. Completed and
    // unfinished fights both count toward the Health margin, before wave recovery.
    for (const run of results.filter(run => run.scenario.mode !== 'boss')) {
      const count = run.scenario.campWave ?? 23;
      expect(run.reachedCamp).toBe(true);
      expect(run.deaths).toBe(0);
      expect(run.waves.slice(0, count).map(wave => wave.wave)).toEqual(Array.from({ length: count }, (_, index) => index + 1));
      if (run.scenario.mode === 'farm') {
        const farms = run.waves.slice(count);
        expect(farms.length).toBeGreaterThan(2);
        expect(Math.min(...farms.map(wave => wave.lowestHp), ...(run.ongoing ? [run.ongoing.lowestHp] : []))).toBeGreaterThan(0.25);
        expect(farms.every(wave => wave.wave === count)).toBe(true);
      }
    }

    // Full preparation must remain legal when training prices, gear gates or tactic
    // costs change. Four equipped slots and a fully spent SP budget are recorded per hero.
    for (const run of results.filter(run => run.scenario.mode === 'boss' || prepared)) {
      expect(run.fixture.heroes.every(hero => hero.loadout.length === 4 && hero.unspentSP === 0)).toBe(true);
      if (prepared) {
        expect(run.fixture.tactics.spentRenownPoints).toBeLessThanOrEqual(11);
        expect(run.fixture.tactics.battleLoadout.length).toBeLessThanOrEqual(5);
        expect(run.fixture.tactics.unlockedAbilities.length).toBeGreaterThanOrEqual(5);
        expect(run.fixture.gear.every(item => item.enchantmentId)).toBe(true);
      }
    }
    const bosses = results.filter(run => run.scenario.mode === 'boss');
    expect(bosses.every(run => run.outcome !== 'timeout')).toBe(true);
    const auto = bosses.filter(run => !run.scenario.control);
    const assisted = bosses.filter(run => run.scenario.control);
    const winRate = runs => runs.filter(run => run.outcome === 'victory').length / runs.length;

    // Broad bounds catch a forgiving boss or an impossible encounter. Leadership must
    // improve the same balanced builds, without requiring every composition to win.
    expect(winRate(auto)).toBeGreaterThanOrEqual(0.1);
    expect(winRate(auto)).toBeLessThanOrEqual(0.35);
    expect(auto.reduce((sum, run) => sum + run.deaths, 0) / auto.length).toBeGreaterThan(2);
    expect(winRate(assisted)).toBeGreaterThanOrEqual(0.7);
    expect(winRate(assisted) - winRate(auto.filter(run => run.scenario.build === 'balanced'))).toBeGreaterThan(0.4);
  });
}
