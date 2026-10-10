// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test } from '@playwright/test';
import { reviewHall } from './hall-flow.js';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`Hall equipment, training, navigation and saves at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await reviewHall(page, 'output/qa/screenshots', viewport.width);
  });
}
