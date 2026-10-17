
import { test } from '@playwright/test';

test.use({
  viewport: { width: 960, height: 540 }
});

test('Delve Deep UI catalog', async ({ page }) => {
  const screenshots = 'screenshots/ui-catalog';
  let step = 0;

  async function capture(label) {
    step++;

    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${screenshots}/${String(step).padStart(3, '0')}-${label}.png`,
      animations: 'disabled'
    });
  }

  await page.goto('http://localhost:5173/');
  await capture('world-map');

  // Open Pineshire
  await page.locator('canvas').click({
    position: { x: 501, y: 202 }
  });
  await capture('pineshire');

  // Open Adventurer's Hall
  await page.locator('canvas').click({
    position: { x: 317, y: 173 }
  });
  await capture('adventurers-hall');

  // Select adventurer
  await page.locator('canvas').click({
    position: { x: 173, y: 240 }
  });
  await capture('adventurer-selected');

  // Open item interaction
  await page.locator('canvas').click({
    position: { x: 91, y: 332 }
  });
  await capture('item-interaction');

  // Open item details
  await page.locator('canvas').click({
    position: { x: 528, y: 201 }
  });
  await capture('item-details');
});
