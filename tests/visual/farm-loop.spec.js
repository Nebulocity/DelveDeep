import { test, expect } from '@playwright/test';

test('Farm repeats and queues cancellation until the current wave is cleared', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyHud?.length === 5);
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    scene.time.removeAllEvents();
    scene.clearWaveAnnouncement();
    qa.state.delveCheckpoints['slime-cave'] = { nextWave: scene.bossWaveIndex, campUnlocked: true };
    scene.showDelveCamp();
  });
  expect(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const panel = scene.children.list.find(object => object.name === 'delve-camp-heading-window');
    const bounds = panel.getBounds();
    return ['DELVE CAMP', 'Rewards and checkpoint saved.'].every(label => {
      const text = scene.children.list.find(object => object.text === label).getBounds();
      return text.left >= bounds.left && text.right <= bounds.right && text.top >= bounds.top && text.bottom <= bounds.bottom;
    });
  })).toBe(true);
  await page.screenshot({ path: 'output/qa/farm-loop/camp-heading-phone.png' });
  const clickButton = async (x, y) => {
    const point = await page.evaluate(({ x, y }) => {
      const game = window.__DELVE_DEEP_VISUAL_QA__.game;
      const canvas = game.canvas.getBoundingClientRect();
      return { x: canvas.x + x * canvas.width / game.scale.width, y: canvas.y + y * canvas.height / game.scale.height };
    }, { x, y });
    await page.mouse.click(point.x, point.y);
  };
  await clickButton(1200, 583);
  await expect.poll(() => page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return scene.farmCancelButton.visible && scene.farmCancelButton.input.enabled;
  })).toBe(true);
  await page.screenshot({ path: 'output/qa/farm-loop/farming-phone.png' });
  const finishRound = () => page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    scene.time.removeAllEvents();
    scene.clearWaveAnnouncement();
    scene.combatPaused = true;
    scene.time.paused = true;
    scene.waveTransitioning = false;
    scene.completeWave();
    scene.waveReturnSettled = new Set(scene.partyUnits.map(unit => unit.id));
    scene.waveReturnReadyAt = scene.time.now;
    scene.updateWaveRetreat(scene.time.now, 0, 0);
    return { entry: qa.state.run.entry, gold: qa.state.gold, index: scene.currentWaveIndex,
      farmIndex: scene.bossWaveIndex - 1, visible: scene.farmCancelButton.visible };
  });
  const initialGold = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.gold);
  const repeat = await finishRound();
  expect(repeat.entry).toBe('farm');
  expect(repeat.index).toBe(repeat.farmIndex);
  expect(repeat.gold).toBe(initialGold + 24);
  expect(repeat.visible).toBe(true);
  await clickButton(155, 750);
  const pending = await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    return { requested: scene.farmStopRequested, entry: qa.state.run.entry, gold: qa.state.gold,
      transitioning: scene.waveTransitioning, label: scene.farmCancelText.text };
  });
  expect(pending.requested).toBe(true);
  expect(pending.entry).toBe('farm');
  expect(pending.gold).toBe(repeat.gold);
  expect(pending.label).toBe('STOPPING\nAFTER COMBAT');
  await page.screenshot({ path: 'output/qa/farm-loop/cancellation-pending-phone.png' });
  const stopped = await finishRound();
  expect(stopped.entry).toBe('camp');
  expect(stopped.gold).toBe(initialGold + 48);
  expect(stopped.visible).toBe(false);
  await clickButton(1200, 583);
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').farmStopRequested)).toBe(false);
  expect(errors).toEqual([]);
});
