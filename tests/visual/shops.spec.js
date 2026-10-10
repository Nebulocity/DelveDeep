// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Explicit screenshots cover the layouts below. Automatic trace screenshots can slow
// a pressed mouse enough to open held details before the intended drag is delivered.
test.use({ trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false } });

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`shops at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await mkdir('output/qa/shops', { recursive: true });

    for (const facility of ['Blacksmith', 'Alchemist', 'Enchanter']) {
      await page.evaluate(facility => window.__DELVE_DEEP_VISUAL_QA__.activate('FacilityScene', { facility }), facility);
      await page.waitForFunction(facility => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
        return scene.sys.isActive() && scene.facility.name === facility;
      }, facility);
      await page.locator('#loading-screen').waitFor({ state: 'hidden' });
      const choices = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').facility.choices.map(choice => choice.id));

      expect(choices).toContain('buy');
      expect(choices).toContain('sell');
      if (facility === 'Enchanter') expect(choices).toEqual(['buy', 'sell', 'inscribe', 'enchant', 'disenchant']);

      // ... expands these entries into the new list or call. It does not deep-copy the
      // objects inside.
      for (const choice of [null, ...choices]) {
        await page.evaluate(choice => {
          const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
          scene.selection = choice;
          scene.category = 'all';
          scene.itemOffset = 0;
          scene.render();
        }, choice);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

        // ?? uses the fallback only for null or undefined. A real zero or false stays
        // intact.
        await page.screenshot({ path: `output/qa/shops/${facility.toLowerCase()}-${choice ?? 'menu'}-${viewport.width}.png` });
        const bounds = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.inspect('FacilityScene'));
        expect(bounds.warnings).toEqual([]);

        if (choice) {
          expect(await page.evaluate(() => {
            const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');

            // filter keeps entries whose callback returns true. It builds a new list and
            // leaves the original list in place.
            return scene.itemList.container.list.filter(object => object.name.startsWith('shop-item-')).length;
          })).toBe(await page.evaluate(choice => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').rowsFor({ id: choice }).length, choice));

          expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').children.list.some(object => object.name === 'facility-close' || ['PREV', 'NEXT >'].includes(object.text)))).toBe(false);
          if (facility === 'Blacksmith' && choice === 'buy') {
            await page.evaluate(() => {
              const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('FacilityScene');
              qa.state.gold = 10000;
              scene.render();
            });
            const canvas = await page.locator('canvas').boundingBox();
            const point = (x, y) => ({ x: canvas.x + x * canvas.width / 2400, y: canvas.y + y * canvas.height / 1080 });
            const begin = point(1209, 498), end = point(1209, 350);

            await page.mouse.move(begin.x, begin.y);
            await page.mouse.down();

            // Cross the 24-logical-pixel drag threshold on the first move. Tiny steps
            // can become a 550 ms hold when software-rendered phone frames are slow.
            await page.mouse.move(end.x, end.y);
            await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').itemOffset > 0,
              null, { timeout: 10000 });
            await page.mouse.up();
            expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.gold)).toBe(10000);
            expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').itemOffset)).toBeGreaterThan(0);

            await page.mouse.wheel(0, 600);
            await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').itemOffset > 400,
              null, { timeout: 10000 });
            expect(await page.evaluate(() => {
              const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');

              // find returns the first matching entry, or undefined when none matches.
              // Check for that missing result before using its fields.
              const hidden = scene.itemList.container.list.find(object => object.name.startsWith('shop-action-') && object.getBounds().bottom < 291);
              return hidden && !hidden.input.hitAreaCallback(hidden.input.hitArea, hidden.displayOriginX, hidden.displayOriginY, hidden);
            })).toBe(true);

            await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').itemList.set(0));
            await page.mouse.click(begin.x, begin.y, { delay: 70 });
            expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.gold)).toBeLessThan(10000);
          }
        }
      }
    }

    expect(errors).toEqual([]);
  });

  test(`single and bulk selling in every shop at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await mkdir('output/qa/shops', { recursive: true });

    // Click the actual card control after translating Phaser coordinates to browser pixels.
    const clickAction = async name => {
      const point = await page.evaluate(name => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
        const button = scene.itemList.container.getByName(name);
        return { x: button.x, y: button.y + scene.itemList.container.y };
      }, name);
      const canvas = await page.locator('canvas').boundingBox();
      await page.mouse.click(canvas.x + point.x * canvas.width / 2400,
        canvas.y + point.y * canvas.height / 1080, { delay: 70 });
    };

    for (const facility of ['Blacksmith', 'Alchemist', 'Enchanter']) {
      await page.evaluate(facility => window.__DELVE_DEEP_VISUAL_QA__.activate('FacilityScene', { facility }), facility);
      await page.waitForFunction(facility => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
        return scene.sys.isActive() && scene.facility.name === facility;
      }, facility);
      const seed = await page.evaluate(async () => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__;
        const { grantEquipment } = await import('/game/Equipment.js');
        const { getEquipmentDefinition, getMaterialDefinition } = await import('/data/items.js');
        qa.state.gold = 1000;
        qa.state.inventory.equipment = [];
        qa.state.inventory.materials = { MAT002: 4 };
        qa.state.roster.forEach(hero => { hero.equipment = {}; });
        const copies = [grantEquipment('BLS01'), grantEquipment('BLS01')];
        const equipped = grantEquipment('BLS01');
        qa.state.roster[0].equipment.weapon = equipped.id;
        const scene = qa.game.scene.getScene('FacilityScene');
        scene.selection = 'sell';
        scene.category = 'all';
        scene.itemOffset = 0;
        scene.render();
        const row = scene.rowsFor({ id: 'sell' }).find(row => row.id === copies[0].id);
        const disabled = scene.itemList.container.getByName(`shop-sell-all-${equipped.id}`);
        return { id: copies[0].id, equippedId: equipped.id, price: getEquipmentDefinition('BLS01').sellPrice,
          materialPrice: getMaterialDefinition('MAT002').sellPrice, label: row.allAction,
          disabled: !disabled.input?.enabled, warnings: qa.inspect('FacilityScene').warnings };
      });
      expect(seed.label).toBe(`SELL ALL: ${2 * seed.price}g`);
      expect(seed.disabled).toBe(true);
      expect(seed.warnings).toEqual([]);
      await page.screenshot({ path: `output/qa/shops/${facility.toLowerCase()}-bulk-${viewport.width}.png` });
      await clickAction(`shop-sell-all-${seed.id}`);
      expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.inventory.equipment.map(item => item.id)))
        .toEqual([seed.equippedId]);
      await page.evaluate(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
        scene.category = 'material';
        scene.render();
      });
      await clickAction('shop-action-MAT002');
      expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.inventory.materials.MAT002)).toBe(3);
      await clickAction('shop-sell-all-MAT002');
      expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.gold))
        .toBe(1000 + 2 * seed.price + 4 * seed.materialPrice);
      expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.inventory.materials.MAT002)).toBeUndefined();
    }
  });
}
