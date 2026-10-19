import { test, expect } from './helpers.js';

test('moving encounter cast shortcuts retain their visual hit area and press position', async ({ page, audit }) => {
  await audit.boot();
  await audit.activate('BattleScene');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').enemies.some(enemy => !enemy.landing));
  await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    if (!s.combatPaused) s.togglePause();
    const enemy = s.enemies.find(enemy => !enemy.landing);
    // A controlled enemy cast freezes its identity and remaining time for this UI check.
    enemy.pendingAction = { name: 'QA cast', startAt: s.time.now, duration: 10000, id: 'qa-cast' };
    s.encounterPanel.update();
  });
  const before = await audit.capture('BattleScene', 'cast-shortcut-before');
  const control = before.objects.find(o => o.worldBounds?.x > 2000 && o.worldBounds.width > 200
    && o.worldBounds.height === 90 && o.enabled && o.visible);
  expect(control, 'A visible enemy cast shortcut').toBeTruthy();
  expect(control.probes.every(probe => probe.hitsSelf), 'Cast hit area follows its relocated visual face').toBe(true);
  const point = control.probes[0];
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').commandMode)).toBe('INTERRUPT');
  await audit.capture('BattleScene', 'cast-shortcut-armed');
});
