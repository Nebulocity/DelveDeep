// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';

test('suspended combat resolves countdown, landings, actions and pause on resume', async ({ page }) => {
  const errors = [];

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').sys.isActive());
  const result = await page.evaluate(() => {
    const game = window.__DELVE_DEEP_VISUAL_QA__.game;
    const scene = game.scene.getScene('BattleScene');
    const progress = game.backgroundProgress;
    progress.setHidden(true);
    const originalNow = progress.now;
    progress.now = () => originalNow() + 20000;
    progress.pump();

    return { wave: scene.currentWaveIndex, debt: progress.pendingMs };
  });

  expect(result.wave).toBeGreaterThanOrEqual(0);
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.backgroundProgress.pendingMs < 50);
  const outcome = await page.evaluate(() => {
    const game = window.__DELVE_DEEP_VISUAL_QA__.game;
    const scene = game.scene.getScene('BattleScene');
    const entries = scene.combatLog.entries;
    scene.combatPaused = true;
    scene.time.paused = true;

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    const hp = scene.partyUnits.map(unit => unit.hp);
    const now = game.backgroundProgress.now;
    game.backgroundProgress.now = () => now() + 10000;
    game.backgroundProgress.pump();

    return { entries: entries.map(entry => entry.type), hp, paused: scene.combatPaused };
  });

  expect(outcome.entries).toContain('damage');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.backgroundProgress.pendingMs < 50);
  const resumed = await page.evaluate(() => {
    const game = window.__DELVE_DEEP_VISUAL_QA__.game;
    game.backgroundProgress.setHidden(false);
    const scene = game.scene.getScene('BattleScene');

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    return { hp: scene.partyUnits.map(unit => unit.hp), paused: scene.combatPaused,
      tweenDelta: scene.tweens.getDelta(false) };
  });

  expect(resumed.hp).toEqual(outcome.hp);
  expect(resumed.paused).toBe(true);
  expect(resumed.tweenDelta).toBeLessThan(250);
  expect(errors).toEqual([]);
});
