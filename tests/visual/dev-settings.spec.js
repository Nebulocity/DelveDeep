import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Exercise real canvas taps, saved grants and relocking at phone and desktop sizes.
for (const width of [915, 2048]) {
  test(`hidden Dev Settings at ${width}`, async ({ page }) => {
    test.setTimeout(180000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: Math.round(width * 1080 / 2400) });
    const ready = async () => {
      await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
      await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    };
    await page.goto('/?visualQa=1');
    await ready();

    // Text and its interactive panel share a center. Convert logical game pixels to
    // browser coordinates so the same tap works with Phaser's landscape scaling.
    const tap = async (label, occurrence = 0, headingOnly = false) => {
      const point = await page.evaluate(({ label, occurrence, headingOnly }) => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__;
        const scene = qa.game.scene.getScene('TitleScene');
        const text = scene.children.list.filter(o => o.type === 'Text' && o.text === label
          && (!headingOnly || o.depth >= 4000))[occurrence];
        const box = text.getBounds();
        const canvas = qa.game.canvas.getBoundingClientRect();
        return { x: canvas.x + box.centerX * canvas.width / qa.game.scale.width,
          y: canvas.y + box.centerY * canvas.height / qa.game.scale.height };
      }, { label, occurrence, headingOnly });
      await page.mouse.click(point.x, point.y, { delay: 70 });
    };
    const labels = () => page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene')
      .children.list.filter(o => o.type === 'Text' && o.depth >= 4000).map(o => o.text));
    const state = () => page.evaluate(() => {
      const s = window.__DELVE_DEEP_VISUAL_QA__.state;
      return { gold: s.gold, renown: s.leader.level, rp: s.leader.renownPoints,
        levels: s.roster.map(h => h.level), testing: s.development.mapTestingEnabled === true,
        unlock: s.development.unlockAll, replay: s.development.replayCleared };
    });
    const unlock = async () => {
      const point = await page.evaluate(() => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__;
        const scene = qa.game.scene.getScene('TitleScene');
        const text = scene.children.list.find(o => o.type === 'Text' && o.text === 'SETTINGS' && o.depth >= 4000);
        const canvas = qa.game.canvas.getBoundingClientRect();
        return { x: canvas.x + text.x * canvas.width / 2400, y: canvas.y + text.y * canvas.height / 1080 };
      });
      for (let i = 0; i < 6; i++) await page.mouse.click(point.x, point.y, { delay: 70 });
      expect(await labels()).not.toContain('DEV SETTINGS');
      await page.mouse.click(point.x, point.y, { delay: 70 });
      expect(await labels()).toContain('DEV SETTINGS');
    };

    await tap('SETTINGS');
    expect(await labels()).not.toContain('Gold');
    expect(await labels()).not.toContain('Arena Border');

    // A partial gesture must not survive closing and reopening normal Settings.
    for (let i = 0; i < 4; i++) await tap('SETTINGS', 0, true);
    await tap('CLOSE');
    await tap('SETTINGS');
    await unlock();
    const before = await state();
    expect(before.testing).toBe(false);
    await tap('+5,000');
    await tap('+5', 0);
    const renownGrant = await state();
    expect(renownGrant.renown).toBe(before.renown + 5);
    expect(renownGrant.rp).toBe(before.rp + 5);
    await tap('+5', 1);
    const after = await state();
    expect(after.gold).toBe(before.gold + 5000);

    // The first adventurer crossing level five also earns the normal shared milestone.
    expect(after.renown).toBe(renownGrant.renown + 1);
    expect(after.rp).toBe(renownGrant.rp + 1);
    expect(after.levels).toEqual(before.levels.map(level => level + 5));

    const fits = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
      return scene.children.list.filter(o => o.type === 'Text' && o.depth >= 4000).every(o => {
        const b = o.getBounds();
        return b.left >= 330 && b.right <= 2070 && b.top >= 80 && b.bottom <= 1000;
      });
    });
    expect(fits).toBe(true);
    await mkdir('output/qa/dev-settings', { recursive: true });
    await page.screenshot({ path: `output/qa/dev-settings/dev-${width}.png` });
    await tap('OFF');
    expect(await labels()).toContain('DEV SETTINGS');
    await tap('CLOSE');
    await tap('CLOSE');
    await ready();
    expect((await state()).unlock).toBe(true);
    await page.reload();
    await ready();
    const restored = await state();
    expect(restored).toEqual({ ...after, testing: true, unlock: true, replay: true });
    await tap('SETTINGS');
    expect(await labels()).not.toContain('DEV SETTINGS');
    await unlock();
    await tap('30');
    expect((await state()).levels.every(level => level === 30)).toBe(true);
    await tap('ON', 0);
    expect(await labels()).toContain('DEV SETTINGS');
    expect((await state()).unlock).toBe(false);
    await tap('CLOSE');
    await tap('CLOSE');
    await ready();
    await tap('SETTINGS');
    await page.screenshot({ path: `output/qa/dev-settings/settings-${width}.png` });
    expect(errors).toEqual([]);
  });
}

// Exercise the actual map destination handler in both delivery modes.
test('map testing teleports and normal mode resumes road travel', async ({ page }) => {
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  const teleported = await page.evaluate(async () => {
    const { selectPoi } = await import('/scenes/ScrollingWorldMap.js');
    const { pois } = await import('/data/worldMap.js');
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    qa.state.development.mapTestingEnabled = true;
    qa.state.development.unlockAll = true;
    const scene = qa.game.scene.getScene('TitleScene');
    selectPoi(scene, pois.find(poi => poi.id === 'slime-cave'));
    return { location: qa.state.world.currentLocation, travel: qa.state.world.travel, edge: scene.activeEdge };
  });
  expect(teleported).toEqual({ location: 'slime-cave', travel: null, edge: null });
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('DelveSelectScene').sys.isActive());
  await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    qa.state.development.mapTestingEnabled = false;
    qa.state.development.unlockAll = false;
    qa.game.scene.getScene('DelveSelectScene').scene.start('TitleScene');
  });
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').sys.isActive());
  const traveling = await page.evaluate(async () => {
    const { selectPoi } = await import('/scenes/ScrollingWorldMap.js');
    const { pois } = await import('/data/worldMap.js');
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('TitleScene');
    selectPoi(scene, pois.find(poi => poi.id === 'pineshire'));
    return { location: qa.state.world.currentLocation, travel: Boolean(qa.state.world.travel), edge: Boolean(scene.activeEdge) };
  });
  expect(traveling).toEqual({ location: 'slime-cave', travel: true, edge: true });
});
