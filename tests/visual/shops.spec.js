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
      const choices = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').facility.choices.map(choice => choice.id));
      expect(choices).toContain('buy'); expect(choices).toContain('sell');
      if (facility === 'Enchanter') expect(choices).toEqual(['buy', 'sell', 'inscribe', 'enchant', 'disenchant']);
      for (const choice of [null, ...choices]) {
        await page.evaluate(choice => {
          const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
          scene.selection = choice; scene.category = 'all'; scene.page = 0; scene.render();
        }, choice);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.screenshot({ path: `outputs/shops/${facility.toLowerCase()}-${choice ?? 'menu'}-${viewport.width}.png` });
        const bounds = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.inspect('FacilityScene'));
        expect(bounds.warnings).toEqual([]);
      }
    }
    expect(errors).toEqual([]);
  });
}
