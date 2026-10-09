// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`return rewards and compact layout at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').sys.isActive());
    const result = await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const scene = qa.game.scene.getScene('BattleScene');
      scene.idleSummary = { waves: 12, gold: 345, xp: 48, materials: {}, deaths: [], casualties: [] };
      scene.showIdleSummary();

      // map builds one output entry for each input entry, in the same order. The callback's
      // return value becomes that output entry.
      const title = scene.children.getByName('idle-summary-title');
      const body = scene.children.getByName('idle-summary-text');
      const panel = scene.children.getByName('idle-summary-panel');
      const button = scene.children.getByName('idle-summary-continue');
      return { text: body.text, names: qa.state.activeParty.map(hero => hero.name),
        titleLeft: title.getBounds().left, bodyLeft: body.getBounds().left,
        panelWidth: panel.displayWidth, bodyBottom: body.getBounds().bottom,
        buttonTop: button.getBounds().top, buttonWidth: button.width,
        button: { x: button.x, y: button.y }, warnings: qa.inspect('BattleScene').warnings };
    });

    expect(result.text).toContain('- 12 waves cleared.');
    expect(result.text).toContain('- You gained 345 Gold.');
    for (const name of result.names) expect(result.text).toContain(`- ${name} gained 48 Exp.`);
    expect(result.text).toContain('- Rewards: None.');
    expect(result.bodyLeft).toBeCloseTo(result.titleLeft, 1);
    expect(result.panelWidth).toBeLessThan(1000);
    expect(result.buttonWidth).toBeLessThan(400);
    expect(result.bodyBottom).toBeLessThan(result.buttonTop);
    expect(result.warnings).toEqual([]);
    await mkdir('output/qa/screenshots', { recursive: true });
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.screenshot({ path: `output/qa/screenshots/IdleRewards-${viewport.width}.png` });

    // Press the live control through browser input, then check that its pause is released.
    const canvas = await page.locator('canvas').boundingBox();
    await page.mouse.click(canvas.x + result.button.x * canvas.width / 2400,
      canvas.y + result.button.y * canvas.height / 1080, { delay: 70 });
    expect(await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      return { open: scene.idleSummaryOpen, summary: scene.idleSummary, paused: scene.combatPaused };
    })).toEqual({ open: false, summary: null, paused: false });
  });
}

test('long return loot scrolls above compact death controls', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').sys.isActive());
  const result = await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    scene.combatPaused = true;
    scene.idleSummary = { waves: 200, gold: 12345, xp: 890, materials: {}, deaths: ['Hero'],
      casualties: [{ name: 'Hero', wave: 5, time: 120, actor: 'Cave Slime', ability: 'Slime Slam' }],
      items: Array.from({ length: 45 }, (_, index) => ({ name: `Recovered treasure ${index + 1}`, count: 2 })) };
    scene.showIdleSummary();
    const body = scene.children.getByName('idle-summary-text')
      ?? scene.children.list.find(object => object.type === 'Container'
        && object.getByName('idle-summary-text'))?.getByName('idle-summary-text');
    const death = scene.children.getByName('idle-summary-death-details');
    const panel = scene.children.getByName('idle-summary-panel');
    return { scrollable: Boolean(body?.parentContainer?.mask), panel: panel.getBounds(),
      body: { x: body.x, y: body.y }, death: { x: death.x, y: death.y },
      warnings: qa.inspect('BattleScene').warnings };
  });
  expect(result.scrollable).toBe(true);
  expect(result.panel.y).toBeGreaterThanOrEqual(50);
  expect(result.panel.y + result.panel.height).toBeLessThanOrEqual(1030);
  expect(result.warnings).toEqual([]);
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await mkdir('output/qa/screenshots', { recursive: true });
  await page.screenshot({ path: 'output/qa/screenshots/IdleRewards-long-915.png' });
  const canvas = await page.locator('canvas').boundingBox();
  await page.mouse.move(canvas.x + (result.body.x + 200) * canvas.width / 2400,
    canvas.y + (result.body.y + 100) * canvas.height / 1080);
  await page.mouse.wheel(0, 10000);
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return scene.children.list.some(object => object.type === 'Container' && object.y < 0);
  });
  await page.screenshot({ path: 'output/qa/screenshots/IdleRewards-long-bottom-915.png' });
  await page.mouse.click(canvas.x + result.death.x * canvas.width / 2400,
    canvas.y + result.death.y * canvas.height / 1080, { delay: 70 });
  expect(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return Boolean(scene.selectionDetailsClose);
  })).toBe(true);
  await page.screenshot({ path: 'output/qa/screenshots/IdleRewards-death-details-915.png' });
  await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    scene.selectionDetailsClose();
  });
  const continuePoint = await page.evaluate(() => {
    const button = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').children.getByName('idle-summary-continue');
    return { x: button.x, y: button.y };
  });
  await page.mouse.click(canvas.x + continuePoint.x * canvas.width / 2400,
    canvas.y + continuePoint.y * canvas.height / 1080, { delay: 70 });
  expect(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return { open: scene.idleSummaryOpen, paused: scene.combatPaused };
  })).toEqual({ open: false, paused: true });
});
