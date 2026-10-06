import { test } from '@playwright/test';
import { reviewHall } from './hall-flow.js';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`Hall equipment, training, navigation and saves at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await reviewHall(page, 'tests/visual/screenshots', viewport.width);
  });
}
