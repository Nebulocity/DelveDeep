import { test, expect } from './helpers.js';
import { readFileSync, readdirSync } from 'node:fs';

// Source discovery defines the test matrix; runtime registration is checked against it.
const config = readFileSync('config/gameConfig.js', 'utf8');
export const scenes = [...config.matchAll(/import (\w+Scene) from/g)].map(match => match[1]).filter(name => name !== 'BootScene');

test('registered scene and source inventory agree', async ({ page, audit }) => {
  await audit.boot();
  expect((await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.scenes)).sort()).toEqual([...scenes].sort());
  const files = readdirSync('scenes').filter(name => name.endsWith('Scene.js'));
  const unregistered = files.filter(name => !scenes.includes(name.slice(0, -3)) && name !== 'BootScene.js');
  expect(unregistered, 'Scene files omitted from runtime registration').toEqual([]);
});

for (const scene of scenes) {
  test(`inventory ${scene}`, async ({ page, audit }) => {
    await audit.boot();
    await audit.activate(scene);
    if (scene === 'BattleScene') {
      await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyHud?.length === 5);
      await page.evaluate(() => { const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene'); if (!s.combatPaused) s.togglePause(); });
    }
    const data = await audit.capture(scene);
    expect(data.active).toBe(true);
    expect(data.domOverflow).toBe(false);
    expect(data.objects.length).toBeGreaterThan(0);
    expect(data.canvas.x).toBeGreaterThanOrEqual(-1);
    expect(data.canvas.y).toBeGreaterThanOrEqual(-1);
    expect(data.canvas.x + data.canvas.width).toBeLessThanOrEqual(data.viewport.width + 1);
    expect(data.canvas.y + data.canvas.height).toBeLessThanOrEqual(data.viewport.height + 1);
    for (const object of data.objects.filter(o => o.visible && o.enabled && o.browserBounds)) {
      expect(Object.values(object.browserBounds).every(Number.isFinite), object.label).toBe(true);
    }
    if (!['TitleScene', 'BattleScene'].includes(scene)) {
      for (const text of data.texts.filter(text => !text.masked && text.bounds)) {
        expect(text.bounds.x, text.text).toBeGreaterThanOrEqual(-2);
        expect(text.bounds.y, text.text).toBeGreaterThanOrEqual(-2);
        expect(text.bounds.x + text.bounds.width, text.text).toBeLessThanOrEqual(2402);
        expect(text.bounds.y + text.bounds.height, text.text).toBeLessThanOrEqual(1082);
      }
    }
  });
}
