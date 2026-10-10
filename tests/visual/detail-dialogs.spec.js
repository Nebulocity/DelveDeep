// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`shop details and Hall overlay cleanup at ${viewport.width}`, async ({ page }) => {
    test.setTimeout(300000);
    await page.setViewportSize(viewport);
    const errors = [];

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await mkdir('output/qa/detail-dialogs', { recursive: true });
    const activate = async (key, data) => {
      await page.evaluate(({ key, data }) => window.__DELVE_DEEP_VISUAL_QA__.activate(key, data), { key, data });
      await page.waitForFunction(key => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(key).sys.isActive(), key);
      await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    };

    const press = async (key, selector, hold = false) => {
      const point = await page.evaluate(({ key, selector }) => {
        const game = window.__DELVE_DEEP_VISUAL_QA__.game;
        const scene = game.scene.getScene(key);
        const all = [];
        const visit = objects => objects.forEach(object => {
          all.push(object);
          if (object.list) visit(object.list);
        });
        visit(scene.children.list);

        // ?? uses the fallback only for null or undefined. A real zero or false stays
        // intact. find returns the first matching entry, or undefined when none matches.
        // Check for that missing result before using its fields. sort rearranges this
        // array in place. A negative comparator result puts a before b; positive puts it
        // after; zero keeps them tied.
        const object = all.find(object => object.name === selector)
          ?? all.filter(object => object.text === selector).sort((a, b) => b.depth - a.depth)[0];
        const bounds = object.getBounds();
        const rect = game.canvas.getBoundingClientRect();

        return { x: rect.x + bounds.centerX * rect.width / game.scale.width,
          y: rect.y + bounds.centerY * rect.height / game.scale.height };
      }, { key, selector });

      if (hold) {
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await page.waitForFunction(key => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(key).selectionDetailsClose), key);
        await page.mouse.up();
      } else await page.mouse.click(point.x, point.y, { delay: 70 });
    };

    const remember = key => page.evaluate(key => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(key);

      // A Set keeps each value once. has checks membership without searching a list for
      // duplicate entries.
      window.detailBaseline = new Set(scene.children.list);
    }, key);

    const checkClosed = async key => {
      await page.waitForFunction(key => !window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(key).selectionDetailsClose, key);
      expect(await page.evaluate(key => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(key);

        // map builds one output entry for each input entry, in the same order. The
        // callback's return value becomes that output entry. filter keeps entries whose
        // callback returns true. It builds a new list and leaves the original list in
        // place.
        return scene.children.list.filter(object => !window.detailBaseline.has(object)).map(object => object.type);
      }, key)).toEqual([]);
    };

    for (const facility of ['Alchemist', 'Blacksmith', 'Enchanter']) {
      await activate('FacilityScene', { facility });
      await remember('FacilityScene');
      await page.mouse.move(1, 1);
      const action = await page.evaluate(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');

        // find returns the first matching entry, or undefined when none matches. Check for
        // that missing result before using its fields.
        const target = scene.children.list.find(object => object.input?.enabled && object.y === 1001);
        target.setName('qa-shop-choice');
        return target.name;
      });

      await press('FacilityScene', action, true);
      await page.screenshot({ path: `output/qa/detail-dialogs/${facility}-action-${viewport.width}.png` });
      await press('FacilityScene', 'shop-details-close');
      await checkClosed('FacilityScene');
      await press('FacilityScene', action);
      await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').selection === 'buy');
      await remember('FacilityScene');

      const item = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene')
        .itemList.container.list.find(object => object.name.startsWith('shop-item-')).name);
      await press('FacilityScene', item, true);
      expect(await page.evaluate(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');

        // some stops with true as soon as one entry passes the check; an empty list gives
        // false.
        return { panel: scene.children.list.some(object => object.name === 'shop-details-panel'),
          wood: scene.children.list.some(object => object.depth >= 10000 && object.texture?.key?.includes('town-')) };
      })).toEqual({ panel: true, wood: false });

      await page.screenshot({ path: `output/qa/detail-dialogs/${facility}-item-${viewport.width}.png` });
      await press('FacilityScene', 'shop-details-close');
      await checkClosed('FacilityScene');
      await press('FacilityScene', item, true);
      const canvas = await page.locator('canvas').boundingBox();
      await page.mouse.click(canvas.x + 12, canvas.y + 12);
      await checkClosed('FacilityScene');
    }

    await activate('RosterScene');
    await press('RosterScene', 'hall-tab-skills');
    const skill = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene')
      .skillList.container.list.find(object => object.name.startsWith('hall-skill-')).name);
    await remember('RosterScene');

    for (let repeat = 0; repeat < 3; repeat++) {
      await press('RosterScene', skill, true);
      if (repeat === 0) await page.screenshot({ path: `output/qa/detail-dialogs/hall-skill-${viewport.width}.png` });
      await press('RosterScene', 'CLOSE');
      await checkClosed('RosterScene');
    }
    await press('RosterScene', 'hall-class-info');

    await page.waitForFunction(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').selectionDetailsClose));
    await press('RosterScene', 'CLOSE');
    await checkClosed('RosterScene');
    await press('RosterScene', 'hall-hero-caramon-gladiator', true);
    const knownSkill = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene')
      .children.list.find(object => object.name.startsWith('known-skill-')).name);
    await press('RosterScene', knownSkill, true);

    await press('RosterScene', 'CLOSE');
    await checkClosed('RosterScene');
    await press('RosterScene', 'hall-all-stats');
    await page.waitForFunction(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').equipmentModalClose));
    await remember('RosterScene');
    await press('RosterScene', 'hall-stat-Armor', true);
    await press('RosterScene', 'CLOSE');

    await checkClosed('RosterScene');
    expect(await page.evaluate(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').equipmentModalClose))).toBe(true);
    await press('RosterScene', 'Done');
    await press('RosterScene', 'hall-tab-gear');
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').tab)).toBe('gear');
    await page.screenshot({ path: `output/qa/detail-dialogs/hall-restored-${viewport.width}.png` });
    expect(errors).toEqual([]);
  });
}
