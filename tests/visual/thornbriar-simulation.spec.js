// Keep measurements local and ignored. Environment settings permit broad exploratory
// sweeps; the default suite is the maintained balance regression check.
import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { simulateThornbriar } from './thornbriarSimulation.js';

test('Thornbriar varied parties, actual farming and prepared bosses', async ({ page }) => {
  test.setTimeout(3600000);
  page.on('console', message => {
    if (message.text().startsWith('SIM ')) console.log(message.text());
  });
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'thornbriar-hollow' }));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyUnits?.length === 5);
  const options = JSON.parse(process.env.DELVE_SIM_OPTIONS ?? JSON.stringify({
    parties: 6, partySeedStride: 104729, seeds: [11, 22], stress: true, farmMs: 600000,
    candidates: [{ name: 'authored', tuning: {} }],
    scenarios: [
      { mode: 'farm', level: 5 }, { mode: 'farm', level: 7 }, { mode: 'farm', level: 10 },
      { mode: 'farm', level: 5, control: true },
      { mode: 'boss', level: 10, build: 'balanced' },
      { mode: 'boss', level: 10, build: 'specialized' },
      { mode: 'boss', level: 10, build: 'balanced', control: true, controlPolicy: 'belch' }
    ]
  }));
  const results = await simulateThornbriar(page, options);
  const groups = {};
  for (const run of results) {
    const key = JSON.stringify([run.candidate, run.category, run.scenario]);
    const group = groups[key] ??= { runs: 0, wins: 0, camps: 0, deaths: 0, farmClears: 0, lowestHp: 1, seconds: [] };
    group.runs++;
    group.wins += Number(run.outcome === 'victory');
    group.camps += Number(run.reachedCamp);
    group.deaths += run.deaths;
    const farm = run.waves.slice(9);
    group.farmClears += farm.length;
    group.lowestHp = Math.min(group.lowestHp, ...farm.map(wave => wave.lowestHp));
    group.seconds.push(...farm.map(wave => wave.seconds));
  }
  for (const group of Object.values(groups)) {
    group.averageFightSeconds = group.seconds.length ? group.seconds.reduce((a, b) => a + b, 0) / group.seconds.length : null;
    delete group.seconds;
  }
  await mkdir('output/qa/thornbriar-simulation', { recursive: true });
  const label = process.env.DELVE_SIM_LABEL ?? 'authored';
  await writeFile(`output/qa/thornbriar-simulation/${label}.json`, JSON.stringify({ options, groups, results }, null, 2));
  console.log(JSON.stringify(groups));
  if (process.env.DELVE_SIM_OPTIONS && process.env.DELVE_SIM_VALIDATE !== '1') return;

  // Supported parties define the target. Missing-role parties are reported separately
  // so their weaknesses cannot distort ordinary progression or boss win percentages.
  const supported = results.filter(run => ['one-healer', 'two-healers'].includes(run.category));
  const farms = supported.filter(run => run.scenario.mode === 'farm');
  for (const run of farms) {
    expect(run.reachedCamp).toBe(true);
    expect(run.deaths).toBe(0);
    expect(run.waves.slice(0, 9).map(wave => wave.wave)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(run.waves.length).toBeGreaterThan(12);
    expect(Math.min(...run.waves.slice(9).map(wave => wave.lowestHp))).toBeGreaterThan(0.25);
  }
  for (const run of supported.filter(run => run.scenario.mode === 'boss')) {
    expect(run.outcome).not.toBe('timeout');
    expect(run.fixture.heroes.every(hero => hero.loadout.length === 4)).toBe(true);
    expect(run.fixture.heroes.every(hero => hero.unspentSP === 0)).toBe(true);
  }

  // Broad outcome bounds protect the design intent while leaving room for different
  // party strengths. Intervention must improve the matched balanced builds substantially.
  const auto = supported.filter(run => run.scenario.mode === 'boss' && !run.scenario.control);
  if (auto.length) {
    const wins = auto.filter(run => run.outcome === 'victory').length / auto.length;
    expect(wins).toBeGreaterThanOrEqual(0.1);
    expect(wins).toBeLessThanOrEqual(0.35);
    expect(auto.reduce((total, run) => total + run.deaths, 0) / auto.length).toBeGreaterThan(2);
  }
  const assisted = supported.filter(run => run.scenario.mode === 'boss' && run.scenario.control);
  if (assisted.length) {
    const wins = assisted.filter(run => run.outcome === 'victory').length / assisted.length;
    expect(wins).toBeGreaterThanOrEqual(0.7);
    const balanced = auto.filter(run => run.scenario.build === 'balanced');
    if (balanced.length) expect(wins - balanced.filter(run => run.outcome === 'victory').length / balanced.length).toBeGreaterThan(0.4);
  }
});
