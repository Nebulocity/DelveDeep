// Real touch events retain Phaser's pointer across gestures, unlike moving a mouse
// between clicks. Cover the reported purchase after a drag ends over a shop button.

import { test, expect } from '@playwright/test';

test.use({ hasTouch: true, trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false } });

for (const width of [915, 1920]) {
  test(`Splint Armor touch purchases after scrolling at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 915 ? 412 : 1080 });
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('FacilityScene', { facility: 'Blacksmith' }));
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').sys.isActive());
    await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('FacilityScene');
      qa.state.gold = 50000;
      scene.selection = 'buy';
      scene.category = 'all';
      scene.render();
      scene.itemList.set(scene.itemList.container.getByName('shop-action-SAD01').y - 700);
    });

    const snapshot = () => page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('FacilityScene');
      const button = scene.itemList.container.getByName('shop-action-SAD01');
      return { gold: qa.state.gold, offset: scene.itemOffset, max: scene.itemList.max,
        copies: qa.state.inventory.equipment.filter(item => item.itemId === 'SAD01').length,
        x: button.x, y: button.y - scene.itemOffset };
    });
    const canvas = await page.locator('canvas').boundingBox();
    const session = await page.context().newCDPSession(page);
    const send = (type, x = 0, y = 0) => session.send('Input.dispatchTouchEvent', {
      type, touchPoints: type === 'touchEnd' ? [] : [{ id: 1,
        x: canvas.x + x * canvas.width / 2400, y: canvas.y + y * canvas.height / 1080 }]
    });
    const start = await snapshot();
    await Promise.all([send('touchStart', start.x, start.y),
      send('touchMove', start.x, start.y - 200), send('touchEnd')]);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    expect((await snapshot()).offset).toBe(start.offset + 200);
    expect((await snapshot()).gold).toBe(start.gold);

    for (let index = 0; index < 3; index++) {
      const before = await snapshot();
      expect(before.offset).toBeLessThan(before.max);

      // Queue the ordered touch messages together so slow rendering cannot stretch
      // a short tap into the separate 550 ms held-details gesture.
      await Promise.all([send('touchStart', before.x, before.y),
        send('touchMove', before.x, before.y + 2), send('touchEnd')]);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      const after = await snapshot();
      expect(after.gold).toBe(before.gold - 3600);
      expect(after.copies).toBe(before.copies + 1);
      expect(after.offset).toBe(before.offset);
    }
    await session.detach();
  });
}
