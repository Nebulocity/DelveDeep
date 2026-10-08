// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// filter keeps entries whose callback returns true. It builds a new list and leaves the
// original list in place. map builds one output entry for each input entry, in the same
// order. The callback's return value becomes that output entry. ?? uses the fallback only
// for null or undefined. A real zero or false stays intact.
const scenes = (process.env.VISUAL_SCENES ?? 'TitleScene').split(',').map((name) => name.trim()).filter(Boolean);
const screenshotDir = path.resolve('tests/visual/screenshots');

for (const sceneName of scenes) {
  test(`capture ${sceneName}`, async ({ page }, testInfo) => {
    const errors = [];

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__
      && window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').sys.isActive());
    await page.evaluate((name) => window.__DELVE_DEEP_VISUAL_QA__.activate(name), sceneName);
    await page.waitForFunction((name) => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      return qa.game.scene.getScene(name).sys.isActive()
        && qa.game.scene.getScene(name).sys.settings.status === 5;
    }, sceneName);

    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const canvas = page.locator('#game canvas');
    await expect(canvas).toBeVisible();
    const metrics = await page.evaluate((name) => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const canvas = qa.game.canvas;
      const rect = canvas.getBoundingClientRect();
      const root = document.documentElement;

      return {
        canvas: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        viewport: { width: innerWidth, height: innerHeight },
        domOverflow: root.scrollWidth > root.clientWidth || root.scrollHeight > root.clientHeight,
        phaser: qa.inspect(name)
      };
    }, sceneName);

    expect(errors).toEqual([]);
    expect(metrics.domOverflow).toBe(false);
    expect(metrics.canvas.width).toBeGreaterThan(0);
    expect(metrics.canvas.height).toBeGreaterThan(0);
    expect(metrics.canvas.x).toBeGreaterThanOrEqual(0);
    expect(metrics.canvas.y).toBeGreaterThanOrEqual(0);
    expect(metrics.canvas.x + metrics.canvas.width).toBeLessThanOrEqual(metrics.viewport.width + 1);

    expect(metrics.canvas.y + metrics.canvas.height).toBeLessThanOrEqual(metrics.viewport.height + 1);
    expect(metrics.phaser.active).toBe(true);

    await mkdir(screenshotDir, { recursive: true });
    const screenshot = path.join(screenshotDir, `${sceneName}.png`);
    await page.screenshot({ path: screenshot });
    await writeFile(path.join(screenshotDir, `${sceneName}.json`), JSON.stringify(metrics, null, 2));
    await testInfo.attach(sceneName, { path: screenshot, contentType: 'image/png' });

    if (metrics.phaser.warnings.length) {
      console.warn(`${sceneName} Phaser bounds warnings:\n${metrics.phaser.warnings.join('\n')}`);
    }
  });
}
