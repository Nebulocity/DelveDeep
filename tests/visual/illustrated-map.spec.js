import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const screenshotDir = path.resolve('tests/visual/screenshots');
const ready = async (page, scene = 'TitleScene') => {
  await page.waitForFunction((name) => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene(name).sys.isActive(), scene);
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
};
const frames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function focusLabel(page, text) {
  await page.evaluate((name) => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
    const label = scene.children.list.find((object) => object.type === 'Text' && object.text.endsWith(name));
    scene.cameras.main.stopFollow();
    scene.cameras.main.centerOn(label.x, label.y + 200);
  }, text);
  await frames(page);
  return page.evaluate((name) => {
    const game = window.__DELVE_DEEP_VISUAL_QA__.game;
    const scene = game.scene.getScene('TitleScene');
    const label = scene.children.list.find((object) => object.type === 'Text' && object.text.endsWith(name));
    const rect = game.canvas.getBoundingClientRect();
    return { x: rect.x + (label.x - scene.cameras.main.scrollX) * rect.width / game.scale.width,
      y: rect.y + (label.y - scene.cameras.main.scrollY) * rect.height / game.scale.height };
  }, text);
}

for (const viewport of [{ width: 1920, height: 1080 }, { width: 915, height: 412 }]) {
  test(`Pineshire final map travel and locks at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await ready(page);
    await mkdir(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, `pineshire-start-${viewport.width}.png`) });
    expect(await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
      return scene.children.list.some((object) => object.texture?.key === 'world-pineshire-final');
    })).toBe(true);

    let point = await focusLabel(page, 'Thornbriar Hollow');
    await page.mouse.click(point.x, point.y);
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').destination)).toBe(null);
    await page.screenshot({ path: path.join(screenshotDir, `pineshire-locked-${viewport.width}.png`) });

    point = await focusLabel(page, 'The Slime Cave');
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.waitForFunction(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').selectionDetailsClose));
    await page.mouse.up();
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').destination)).toBe(null);
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').selectionDetailsClose());
    point = await focusLabel(page, 'The Slime Cave');
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').activeEdge);
    await page.waitForFunction(() => {
      const raw = JSON.parse(localStorage.getItem('delveDeep.profile.v2'));
      return raw?.world?.travel?.destinationId === 'slime-cave';
    });
    await page.reload();
    await ready(page);
    await ready(page, 'DelveSelectScene');
    expect(await page.evaluate(async () => (await import('/game/GameState.js')).default.currentDelve.id)).toBe('slime-cave');

    await page.evaluate(async () => {
      const state = (await import('/game/GameState.js')).default;
      const map = await import('/data/worldMap.js');
      state.world.clearedDelves = [...map.ORDINARY_DELVES];
      state.world.currentLocation = 'verge-delves';
      state.world.travel = null;
      window.__DELVE_DEEP_VISUAL_QA__.activate('TitleScene');
    });
    await ready(page);
    point = await focusLabel(page, 'The Everdeep');
    await page.screenshot({ path: path.join(screenshotDir, `pineshire-branch-${viewport.width}.png`) });
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').children.list.some((object) => object.text === 'LOCKED'))).toBe(false);
    await page.mouse.click(point.x, point.y);
    await ready(page, 'EverdeepScene');
    expect(errors).toEqual([]);
  });
}
