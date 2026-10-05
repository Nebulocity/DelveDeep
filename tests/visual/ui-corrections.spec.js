import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
test(`requested map, shop and wooden dialog corrections at ${viewport.width}`, async ({ page }) => {
  await page.setViewportSize(viewport);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  const output = path.resolve('tests/visual/screenshots');
  await mkdir(output, { recursive: true });
  const capture = async (name) => { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); await page.screenshot({ path: path.join(output, `correction-${name}-${viewport.width}.png`) }); };
  await capture('pineshire');
  expect(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
    return scene.children.list.some(object => object.text === 'DEV TOOLS');
  })).toBe(true);
  for (const label of [true, false]) {
    const point = await page.evaluate((useLabel) => {
      const game = window.__DELVE_DEEP_VISUAL_QA__.game;
      const scene = game.scene.getScene('TitleScene');
      scene.cameras.main.stopFollow();
      const rect = game.canvas.getBoundingClientRect();
      const object = useLabel ? scene.children.list.find(object => object.text === 'Pineshire') : { x: scene.party.x, y: scene.party.y - 100 };
      return { x: rect.x + (object.x - scene.cameras.main.scrollX) * rect.width / game.scale.width,
        y: rect.y + (object.y - scene.cameras.main.scrollY) * rect.height / game.scale.height,
        scroll: scene.cameras.main.scrollX };
    }, label);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x - 100, point.y - 20, { steps: 5 });
    await page.mouse.up();
    const state = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
      return { scroll: scene.cameras.main.scrollX, travel: Boolean(scene.destination), modal: Boolean(scene.selectionDetailsClose) };
    });
    expect(state.scroll).toBeGreaterThan(point.scroll);
    expect(state.travel).toBe(false);
    expect(state.modal).toBe(false);
  }
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').showDevelopmentTools());
  await capture('dev-tools');
  await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
    scene.selectionDetailsClose();
    const caption = scene.children.list.find(object => object.text === 'HOW TO PLAY');
    const button = scene.children.list.find(object => object.input?.enabled && object.x === caption.x && object.y === caption.y);
    button.emit('pointerdown');
  });
  await capture('wooden-help');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').children.list.filter(object => object.name === 'wooden-panel').length)).toBeGreaterThan(0);
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('DelveSelectScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('DelveSelectScene').sys.isActive());
  await capture('slime-preview');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('DelveSelectScene').children.list.some(object => object.texture?.key === 'slime-cave-pixel-art'))).toBe(true);
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('FacilityScene', { facility: 'Enchanter' }));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').sys.isActive());
  await capture('enchanter');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').facility.choices.map(choice => choice.id))).toEqual(['buy', 'sell']);
  for (const choice of ['buy', 'sell']) {
    await page.evaluate(id => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
      scene.selection = id; scene.render();
    }, choice);
    await capture(`enchanter-${choice}`);
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').children.list.some(object => object.text?.includes('enchanted items')))).toBe(true);
  }
  await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
    scene.init({ title: 'Alchemist' }); scene.selection = 'brew'; scene.render();
  });
  await capture('potion-recipes');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').children.list.some(object => object.text?.includes('3 Health Potions')))).toBe(true);
  expect(errors).toEqual([]);
});
}
