// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
test(`requested map, shop and wooden dialog corrections at ${viewport.width}`, async ({ page }) => {
  await page.setViewportSize(viewport);
  const errors = [];

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  const output = path.resolve('tests/visual/screenshots');
  await mkdir(output, { recursive: true });
  const capture = async (name) => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: path.join(output, `correction-${name}-${viewport.width}.png`) });
  };

  await capture('pineshire');
  expect(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    return scene.children.list.some(object => object.text === 'DEV TOOLS');
  })).toBe(true);

  for (const label of [true, false]) {
    const point = await page.evaluate((useLabel) => {
      const game = window.__DELVE_DEEP_VISUAL_QA__.game;
      const scene = game.scene.getScene('TitleScene');
      scene.cameras.main.stopFollow();
      const rect = game.canvas.getBoundingClientRect();

      // The condition before ? chooses the first value when true and the value after :
      // when false. find returns the first matching entry, or undefined when none matches.
      // Check for that missing result before using its fields.
      const object = useLabel ? scene.children.list.find(object => object.text === 'Pineshire') : { x: scene.party.x, y: scene.party.y - 100 };
      const camera = scene.cameras.main;
      return { x: rect.x + (camera.x + (object.x - camera.scrollX) * camera.zoom) * rect.width / game.scale.width,
        y: rect.y + (camera.y + (object.y - camera.scrollY) * camera.zoom) * rect.height / game.scale.height,
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

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const caption = scene.children.list.find(object => object.text === 'HOW TO PLAY');
    const button = scene.children.list.find(object => object.input?.enabled && object.x === caption.x && object.y === caption.y);
    button.emit('pointerdown');
  });

  await capture('tutorial-help');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').children.list.some(object => object.name === 'tutorial-video'))).toBe(true);
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('DelveSelectScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('DelveSelectScene').sys.isActive());
  await capture('slime-preview');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('DelveSelectScene').children.list.some(object => object.texture?.key === 'slime-cave-pixel-art'))).toBe(true);
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('FacilityScene', { facility: 'Enchanter' }));

  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').sys.isActive());
  await capture('enchanter');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').facility.choices.map(choice => choice.id))).toEqual(['buy', 'sell', 'inscribe', 'enchant', 'disenchant']);

  for (const choice of ['buy', 'sell']) {
    await page.evaluate(id => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
      scene.selection = id;
      scene.render();
    }, choice);
    await capture(`enchanter-${choice}`);
    expect(await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');

      // map builds one output entry for each input entry, in the same order. The
      // callback's return value becomes that output entry. filter keeps entries whose
      // callback returns true. It builds a new list and leaves the original list in place.
      const visibleText = scene.children.list.filter(object => typeof object.text === 'string').map(object => object.text).join('\n');
      const rows = scene.rowsFor({ id: scene.selection });

      // The condition before ? chooses the first value when true and the value after :
      // when false. some stops with true as soon as one entry passes the check; an empty
      // list gives false.
      return rows.length
        ? rows.slice(0, 3).some(row => visibleText.includes(row.name))
        : /No owned items|No gear|Nothing available|Buy or inscribe/.test(visibleText);
    })).toBe(true);
  }

  await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
    scene.init({ title: 'Alchemist' });
    scene.selection = 'brew';
    scene.render();
  });
  await capture('potion-recipes');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').children.list.some(object => /Health Potion Pack|Mana Potion Pack/.test(object.text ?? '')))).toBe(true);
  expect(errors).toEqual([]);
});
}
