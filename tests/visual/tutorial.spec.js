import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`gameplay tutorial navigation and playback at ${viewport.width}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.routeWebSocket('**/*', () => {});
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    const click = async (x, y) => {
      const box = await page.locator('#game canvas').boundingBox();
      await page.mouse.click(box.x + x * box.width / 2400, box.y + y * box.height / 1080);
    };
    const ready = () => page.waitForFunction(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
      const video = scene.children.list.find(object => object.name === 'tutorial-video');
      return video?.frameReady && video.video.currentTime > 0.1;
    });
    const count = () => page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').children.list
      .find(object => /^\d of 5$/.test(object.text))?.text);
    await click(640, 1015);
    await ready();
    await mkdir('tests/visual/screenshots', { recursive: true });
    for (let i = 0; i < 5; i++) {
      expect(await count()).toBe(`${i + 1} of 5`);
      await ready();
      expect(await page.evaluate(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
        return scene.children.list.filter(object => object.depth > 10000 && object.type === 'Text').every(object => {
          const bounds = object.getBounds();
          return bounds.left >= 60 && bounds.right <= 2340 && bounds.top >= 30 && bounds.bottom <= 1050;
        });
      })).toBe(true);
      await page.screenshot({ path: `tests/visual/screenshots/tutorial-${viewport.width}-${i + 1}.png` });
      if (i < 4) await click(1950, 944);
    }
    await click(1950, 944);
    expect(await count()).toBe('5 of 5');
    await click(450, 944);
    await ready();
    expect(await count()).toBe('4 of 5');
    await click(950, 944);
    const pausedTime = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').children.list
      .find(object => object.name === 'tutorial-video').video.currentTime);
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').children.list
      .find(object => object.name === 'tutorial-video').video.currentTime)).toBeCloseTo(pausedTime, 1);
    await click(1450, 944);
    await ready();
    await click(2165, 87);
    expect(await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
      return Boolean(scene.selectionDetailsClose) || scene.children.list.some(object => object.name === 'tutorial-video');
    })).toBe(false);
    await click(640, 1015);
    await ready();
    expect(await count()).toBe('1 of 5');
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('TownScene'));
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TownScene').sys.isActive());
    expect(await page.evaluate(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').selectionDetailsClose))).toBe(false);
    expect(errors).toEqual([]);
  });
}
