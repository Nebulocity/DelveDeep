import { test, expect } from '@playwright/test';

// Press the real canvas control so release activation and shared saved state are covered.
test('BGM controls share and save their preference across preparation and battle', async ({ page }) => {
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  let enabled = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.development.musicEnabled === true);
  for (const name of ['DelveSelectScene', 'PartySelectScene', 'DungeonScene', 'BattleScene']) {
    await page.evaluate(name => window.__DELVE_DEEP_VISUAL_QA__.activate(name), name);
    await page.waitForFunction(name => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(name);
      return scene.sys.isActive() && scene.bgmToggle?.button.active;
    }, name);
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    const control = await page.evaluate(name => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const scene = qa.game.scene.getScene(name);
      const { button, text } = scene.bgmToggle;
      const bounds = button.getBounds();
      const label = text.getBounds();
      const canvas = qa.game.canvas.getBoundingClientRect();
      return {
        label: text.text,
        fits: label.left >= bounds.left && label.right <= bounds.right && label.top >= bounds.top && label.bottom <= bounds.bottom,
        overlaps: scene.children.list.filter(object => object !== button && object.input?.enabled && object.getBounds).some(object => {
          const other = object.getBounds();
          // The battlefield's full-screen input surface intentionally lies beneath HUD buttons.
          return object.depth >= button.depth && other.left < bounds.right && other.right > bounds.left && other.top < bounds.bottom && other.bottom > bounds.top;
        }),
        x: canvas.x + button.x * canvas.width / qa.game.scale.width,
        y: canvas.y + button.y * canvas.height / qa.game.scale.height
      };
    }, name);
    expect(control.label).toBe(enabled ? 'BGM ON' : 'BGM OFF');
    expect(control.fits).toBe(true);
    expect(control.overlaps).toBe(false);
    await page.mouse.move(control.x, control.y);
    await page.mouse.down();
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.development.musicEnabled === true)).toBe(enabled);
    await page.mouse.up();
    enabled = !enabled;
    await expect.poll(() => page.evaluate(name => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(name).bgmToggle.text.text, name)).toBe(enabled ? 'BGM ON' : 'BGM OFF');
  }

  // Persist ON rather than the default OFF so reload must restore the saved preference.
  if (!enabled) {
    const point = await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const button = qa.game.scene.getScene('BattleScene').bgmToggle.button;
      const canvas = qa.game.canvas.getBoundingClientRect();
      return { x: canvas.x + button.x * canvas.width / qa.game.scale.width,
        y: canvas.y + button.y * canvas.height / qa.game.scale.height };
    });
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.development.musicEnabled)).toBe(true);
    enabled = true;
  }
  await page.reload();

  // A saved battle can resume on reload, so wait for whichever playable scene restores.
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScenes(true).some(scene => scene.scene.key !== 'BootScene'));
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('TitleScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').sys.isActive());
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.development.musicEnabled === true)).toBe(enabled);
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').showDevelopmentTools());
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').children.list.some(object => object.text === 'BGM'))).toBe(true);
  await page.screenshot({ path: 'output/qa/scenes/Bgm-DevTools.png' });
});

