import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { simulateBattles } from './battleSimulation.js';

test('Slime Cave has safe pre-boss progression and lethal unattended boss pressure', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 915, height: 412 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyUnits?.length === 5);
  const results = await simulateBattles(page, {
    seeds: Array.from({ length: 40 }, (_, index) => index + 1), waves: [0],
    candidates: [{ name: 'authored-slimes', stats: {} }]
  });
  await fs.mkdir('project-backup/slime-review', { recursive: true });
  await fs.writeFile('project-backup/slime-review/authored-results.json', JSON.stringify(results, null, 2));
  const waves = results.flatMap(run => run.waves);
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  for (const run of results) {
    expect(run.outcome).not.toBe('timeout');
    expect(run.waves).toHaveLength(6);
    expect(run.waves.filter(wave => wave.wave < 6).every(wave => wave.deaths === 0)).toBe(true);
    expect(run.waves.find(wave => wave.wave === 6).deaths).toBeGreaterThanOrEqual(2);
    expect(run.waves.find(wave => wave.wave === 3).end - run.waves.find(wave => wave.wave === 3).start).toBeGreaterThan(8);
  }
  const medium = waves.filter(wave => wave.wave === 3);
  const hard = waves.filter(wave => wave.wave === 5);
  expect(average(hard.map(wave => wave.end - wave.start))).toBeGreaterThan(average(medium.map(wave => wave.end - wave.start)));
  expect(average(hard.map(wave => wave.damage))).toBeGreaterThan(average(medium.map(wave => wave.damage)));
  expect(errors).toEqual([]);
});
