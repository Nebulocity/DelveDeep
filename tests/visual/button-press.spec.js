// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';

test.use({ hasTouch: true });

test('battle and camp buttons stay depressed until mouse or touch release', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  const errors = [];

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').pauseButton);
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });

  const pause = await page.evaluate(() => {
    const game = window.__DELVE_DEEP_VISUAL_QA__.game;
    const scene = game.scene.getScene('BattleScene');
    const button = scene.pauseButton;
    const canvas = game.canvas.getBoundingClientRect();

    return { y: button.y, labelY: scene.pauseButtonText.y,
      x: canvas.x + button.x * canvas.width / game.scale.width,
      screenY: canvas.y + (button.y - button.height / 2 + 6) * canvas.height / game.scale.height };
  });

  const state = () => page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return { y: scene.pauseButton.pressVisuals[0].y, labelY: scene.pauseButtonText.y, paused: scene.combatPaused };
  });
  const initial = await state();
  await page.screenshot({ path: 'output/qa/carved-stone/battle-initial.png' });
  await page.mouse.move(pause.x, pause.screenY);

  await page.mouse.down();
  await expect.poll(async () => (await state()).y).toBeCloseTo(pause.y + 5);
  await page.waitForTimeout(650);
  expect((await state()).paused).toBe(initial.paused);
  expect((await state()).labelY).toBeCloseTo(pause.labelY + 5);
  await page.mouse.up();
  await expect.poll(async () => (await state()).y).toBeCloseTo(pause.y);

  expect((await state()).paused).toBe(!initial.paused);

  await page.screenshot({ path: 'output/qa/carved-stone/battle-phone.png' });

  await page.mouse.down();
  await expect.poll(async () => (await state()).y).toBeCloseTo(pause.y + 5);
  await page.mouse.move(450, 200);
  await page.mouse.up();
  await expect.poll(async () => (await state()).y).toBeCloseTo(pause.y);
  expect((await state()).paused).toBe(!initial.paused);

  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').showDelveCamp());
  const camp = await page.evaluate(() => {
    const game = window.__DELVE_DEEP_VISUAL_QA__.game;
    const scene = game.scene.getScene('BattleScene');

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const label = scene.children.list.find(object => object.text === 'FACE THE BOSS');
    const button = scene.children.list.find(object => object.input?.enabled && object.x === label.x && object.y === 599);
    window.__pressTestButton = button;
    const canvas = game.canvas.getBoundingClientRect();

    return { y: button.y, x: canvas.x + button.x * canvas.width / game.scale.width,
      screenY: canvas.y + button.y * canvas.height / game.scale.height };
  });

  const session = await page.context().newCDPSession(page);
  await page.screenshot({ path: 'output/qa/carved-stone/camp-phone.png' });
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: camp.x, y: camp.screenY }] });
  await expect.poll(() => page.evaluate(() => window.__pressTestButton.pressVisuals[0].y)).toBeCloseTo(camp.y + 5);
  await page.waitForTimeout(650);
  expect(await page.evaluate(() => window.__pressTestButton.active)).toBe(true);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await expect.poll(() => page.evaluate(() => window.__pressTestButton.active)).toBe(false);
  expect(errors).toEqual([]);
});
