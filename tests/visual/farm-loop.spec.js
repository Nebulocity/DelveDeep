// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';

test('Farm repeats and queues cancellation until the current wave is cleared', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  const errors = [];

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
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

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const panel = scene.children.list.find(object => object.name === 'delve-camp-heading-window');
    const bounds = panel.getBounds();

    // every requires all entries to pass the check; an empty list gives true.
    return ['DELVE CAMP', 'Rewards and checkpoint saved.'].every(label => {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
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

  await clickButton(1200, 599);
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

    // A Set keeps each value once. has checks membership without searching a list for
    // duplicate entries. map builds one output entry for each input entry, in the same
    // order. The callback's return value becomes that output entry.
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
  expect(repeat.gold).toBe(initialGold + 1);
  expect(repeat.visible).toBe(true);
  const clickModal = async (label) => {
    const point = await page.evaluate(label => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const text = scene.children.list.find(object => object.depth >= 11000 && object.text === label);
      return { x: text.x, y: text.y };
    }, label);

    await clickButton(point.x, point.y);
  };

  await clickButton(155, 750);
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').farmStopRequested)).toBe(false);
  await page.screenshot({ path: 'output/qa/farm-loop/cancel-confirmation-phone.png' });
  await clickModal('CANCEL');
  expect(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return !scene.farmStopRequested && !scene.selectionDetailsClose && scene.combatPaused && scene.time.paused;
  })).toBe(true);

  await clickButton(155, 750);
  await clickModal('STOP FARMING');
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

  expect(stopped.gold).toBe(initialGold + 2);
  expect(stopped.visible).toBe(false);
  await clickButton(1200, 599);
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').farmStopRequested)).toBe(false);
  await clickButton(2245, 796);
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').battleOver)).toBe(false);
  await page.screenshot({ path: 'output/qa/farm-loop/retreat-confirmation-phone.png' });

  await clickModal('CANCEL');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').battleOver)).toBe(false);
  await clickButton(2245, 796);
  await clickModal('RETREAT');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('EncounterSummaryScene').sys.isActive());
  expect(errors).toEqual([]);
});
