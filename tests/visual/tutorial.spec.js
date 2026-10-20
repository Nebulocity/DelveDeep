import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`Tutorial preparation notice opens and dismisses at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    const click = async label => {
      const hit = await page.evaluate(label => window.__DELVE_DEEP_VISUAL_QA__.audit('TitleScene').objects
        .find(object => object.label === label && object.enabled && object.probes?.[0]?.topmost), label);
      expect(hit, `Reachable ${label}`).toBeTruthy();
      await page.mouse.click(hit.probes[0].x, hit.probes[0].y, { delay: 70 });
    };
    const progression = () => page.evaluate(() => {
      const state = window.__DELVE_DEEP_VISUAL_QA__.state;
      return JSON.stringify([state.roster, state.gold, state.inventory, state.leader,
        state.records, state.lastPartyIds, state.world.clearedDelves]);
    });
    const before = await progression();
    await click('Tutorial');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').children.list
      .some(object => object.text?.includes('The tutorial is being prepared!')));
    expect(await progression()).toBe(before);
    await click('CLOSE');
    expect(await page.evaluate(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').selectionDetailsClose))).toBe(false);
    await click('Tutorial');
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('TownScene'));
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TownScene').sys.isActive());
    expect(await page.evaluate(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').selectionDetailsClose))).toBe(false);
    expect(await progression()).toBe(before);
    expect(errors).toEqual([]);
  });
}
