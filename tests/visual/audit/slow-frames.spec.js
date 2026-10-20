import { test, expect } from './helpers.js';

test('paused combat confirmations remain responsive during sustained slow frames', async ({ page, audit }) => {
  await audit.boot();
  await audit.activate('BattleScene');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').pauseButton);
  await page.evaluate(() => {
    const q = window.__DELVE_DEEP_VISUAL_QA__, s = q.game.scene.getScene('BattleScene');
    if (!s.combatPaused) s.togglePause();
    // A repeated 300ms wall-clock gap reproduces UI starvation without GPU dependence.
    const slowFrame = () => { q.game.backgroundProgress.lastWallTime = Date.now() - 300; };
    q.game.events.on('prestep', slowFrame);
    s.events.once('shutdown', () => q.game.events.off('prestep', slowFrame));
    s.confirmRetreat();
  });
  await page.waitForTimeout(500);
  await audit.capture('BattleScene', 'slow-frame-confirmation');
  await audit.click('BattleScene', 'CANCEL');
  await expect.poll(() => page.evaluate(() => !!window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').selectionDetailsClose)).toBe(false);
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').combatPaused)).toBe(true);
  await audit.capture('BattleScene', 'slow-frame-cancelled');
});

test('active combat confirmations register input after repeated catch-up frames', async ({ page, audit }) => {
  await audit.boot();
  await audit.activate('BattleScene');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').enemies.some(e => !e.landing));
  await page.evaluate(() => {
    const q = window.__DELVE_DEEP_VISUAL_QA__, s = q.game.scene.getScene('BattleScene');
    const slowFrame = () => { q.game.backgroundProgress.lastWallTime = Date.now() - 300; };
    q.game.events.on('prestep', slowFrame);
    s.events.once('shutdown', () => q.game.events.off('prestep', slowFrame));
    s.confirmRetreat();
  });
  await page.waitForTimeout(500);
  await audit.capture('BattleScene', 'active-catch-up-confirmation');
  await audit.click('BattleScene', 'CANCEL');
  await expect.poll(() => page.evaluate(() => !!window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').selectionDetailsClose)).toBe(false);
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').combatPaused)).toBe(false);
  await audit.capture('BattleScene', 'active-catch-up-cancelled');
});
