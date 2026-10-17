
 // This is a browser check for the game. Playwright drives the page while the visual QA
 // bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
 // process, so values cross that boundary as plain serializable data. Wait for observable
 // state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Filter keeps entries whose callback returns true. It builds a new list and leaves the
// original list in place. map builds one output entry for each input entry.
const scenes = (process.env.VISUAL_SCENES ?? 'TitleScene')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

const screenshotDir = path.resolve('output/qa/scenes');

// Some UI screens are implemented by a different underlying Phaser scene.
const sceneAliases = {
  AdventurersHallScene: 'RosterScene'
};

for (const sceneName of scenes) {
  test(`capture ${sceneName}`, async ({ page }, testInfo) => {
    const errors = [];
    const targetSceneName = sceneAliases[sceneName] ?? sceneName;

    // Capture unexpected browser errors.
    page.on('pageerror', (error) => errors.push(error.message));

    // Load Delve Deep with its development-only visual QA bridge.
    await page.goto('/?visualQa=1');

    await page.waitForFunction(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;

      return qa
        && qa.game.scene.getScene('TitleScene').sys.isActive();
    });

    // Activate the requested scene through the existing QA bridge.
    // The bridge may redirect older scene names to their current implementation.
    await page.evaluate(
      (name) => window.__DELVE_DEEP_VISUAL_QA__.activate(name),
      sceneName
    );

    // Wait for the actual Phaser scene to become active.
    await page.waitForFunction((name) => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const scene = qa.game.scene.getScene(name);

      return scene.sys.isActive()
        && scene.sys.settings.status === 5;
    }, targetSceneName);

    // Wait for the loading overlay, fonts, and browser rendering.
    await page.locator('#loading-screen').waitFor({
      state: 'hidden'
    });

    await page.evaluate(() => document.fonts.ready);

    await page.evaluate(() => new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    ));

    const canvas = page.locator('#game canvas');
    await expect(canvas).toBeVisible();

    // Inspect the actual active scene, not its optional alias.
    const metrics = await page.evaluate((name) => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const canvas = qa.game.canvas;
      const rect = canvas.getBoundingClientRect();
      const root = document.documentElement;

      return {
        canvas: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        },
        viewport: {
          width: innerWidth,
          height: innerHeight
        },
        domOverflow:
          root.scrollWidth > root.clientWidth ||
          root.scrollHeight > root.clientHeight,
        phaser: qa.inspect(name)
      };
    }, targetSceneName);

    // Verify that the UI fits inside the browser viewport.
    expect(errors).toEqual([]);
    expect(metrics.domOverflow).toBe(false);
    expect(metrics.canvas.width).toBeGreaterThan(0);
    expect(metrics.canvas.height).toBeGreaterThan(0);
    expect(metrics.canvas.x).toBeGreaterThanOrEqual(0);
    expect(metrics.canvas.y).toBeGreaterThanOrEqual(0);

    expect(
      metrics.canvas.x + metrics.canvas.width
    ).toBeLessThanOrEqual(metrics.viewport.width + 1);

    expect(
      metrics.canvas.y + metrics.canvas.height
    ).toBeLessThanOrEqual(metrics.viewport.height + 1);

    expect(metrics.phaser.active).toBe(true);

    // Preserve the requested screen name in generated file names.
    await mkdir(screenshotDir, { recursive: true });

    const screenshot = path.join(
      screenshotDir,
      `${sceneName}-${metrics.viewport.width}.png`
    );

    const report = path.join(
      screenshotDir,
      `${sceneName}-${metrics.viewport.width}.json`
    );

    await page.screenshot({ path: screenshot });

    await writeFile(
      report,
      JSON.stringify({
        requestedScene: sceneName,
        actualScene: targetSceneName,
        ...metrics
      }, null, 2)
    );

    await testInfo.attach(sceneName, {
      path: screenshot,
      contentType: 'image/png'
    });

    if (metrics.phaser.warnings.length) {
      console.warn(
        `${sceneName} Phaser bounds warnings:\n` +
        metrics.phaser.warnings.join('\n')
      );
    }
  });
}
