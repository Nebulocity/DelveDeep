import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`shops at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await mkdir('outputs/shops', { recursive: true });
    for (const facility of ['Blacksmith', 'Alchemist', 'Enchanter']) {
      await page.evaluate(facility => window.__DELVE_DEEP_VISUAL_QA__.activate('FacilityScene', { facility }), facility);
      await page.waitForFunction(facility => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
        return scene.sys.isActive() && scene.facility.name === facility;
      }, facility);
      await page.locator('#loading-screen').waitFor({ state: 'hidden' });
      const choices = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').facility.choices.map(choice => choice.id));
      expect(choices).toContain('buy'); expect(choices).toContain('sell');
      if (facility === 'Enchanter') expect(choices).toEqual(['buy', 'sell', 'inscribe', 'enchant', 'disenchant']);
      for (const choice of [null, ...choices]) {
        await page.evaluate(choice => {
          const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
          scene.selection = choice; scene.category = 'all'; scene.itemOffset = 0; scene.render();
        }, choice);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.screenshot({ path: `outputs/shops/${facility.toLowerCase()}-${choice ?? 'menu'}-${viewport.width}.png` });
        const bounds = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.inspect('FacilityScene'));
        expect(bounds.warnings).toEqual([]);
        if (choice) {
          expect(await page.evaluate(() => {
            const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
            return scene.itemList.container.list.filter(object => object.name.startsWith('shop-item-')).length;
          })).toBe(await page.evaluate(choice => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').rowsFor({ id: choice }).length, choice));
          expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').children.list.some(object => object.name === 'facility-close' || ['PREV', 'NEXT >'].includes(object.text)))).toBe(false);
          if (facility === 'Blacksmith' && choice === 'buy') {
            await page.evaluate(() => {
              const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('FacilityScene');
              qa.state.gold = 10000; scene.render();
            });
            const canvas = await page.locator('canvas').boundingBox();
            const point = (x, y) => ({ x: canvas.x + x * canvas.width / 2400, y: canvas.y + y * canvas.height / 1080 });
            const begin = point(1209, 498), end = point(1209, 350);
            await page.mouse.move(begin.x, begin.y); await page.mouse.down();
            await page.mouse.move(end.x, end.y);
            await page.waitForTimeout(1000);
            await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').itemOffset > 0);
            await page.mouse.up();
            expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.gold)).toBe(10000);
            expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').itemOffset)).toBeGreaterThan(0);
            await page.mouse.wheel(0, 600);
            await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').itemOffset > 400);
            expect(await page.evaluate(() => {
              const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
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
}
