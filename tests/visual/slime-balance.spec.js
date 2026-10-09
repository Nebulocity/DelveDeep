// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { simulateBattles } from './battleSimulation.js';

test('Slime Cave has safe pre-boss progression and lethal unattended boss pressure', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 915, height: 412 });
  const errors = [];

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
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

  await fs.mkdir('output/qa/slime-review', { recursive: true });
  await fs.writeFile('output/qa/slime-review/authored-results.json', JSON.stringify(results, null, 2));

  // flatMap builds callback results and flattens one array level. Returning [] removes an
  // entry; returning [value] keeps one result.
  const waves = results.flatMap(run => run.waves);
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  for (const run of results) {
    expect(run.outcome).not.toBe('timeout');
    expect(run.waves).toHaveLength(6);

    // every requires all entries to pass the check; an empty list gives true. filter keeps
    // entries whose callback returns true. It builds a new list and leaves the original
    // list in place.
    expect(run.waves.filter(wave => wave.wave < 6).every(wave => wave.deaths === 0)).toBe(true);

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    expect(run.waves.find(wave => wave.wave === 6).deaths).toBeGreaterThanOrEqual(2);
    expect(run.waves.find(wave => wave.wave === 3).end - run.waves.find(wave => wave.wave === 3).start).toBeGreaterThan(8);
  }

  const medium = waves.filter(wave => wave.wave === 3);
  const hard = waves.filter(wave => wave.wave === 5);

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry.
  expect(average(hard.map(wave => wave.end - wave.start))).toBeGreaterThan(average(medium.map(wave => wave.end - wave.start)));
  expect(average(hard.map(wave => wave.damage))).toBeGreaterThan(average(medium.map(wave => wave.damage)));
  expect(errors).toEqual([]);
});
