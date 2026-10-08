// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';

test('Carved Stone keeps live controls and authored arena floors across delves', async ({ page }) => {
  const errors = [];

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  let floor = null;

  for (const delve of ['slime-cave', 'thornbriar-hollow', 'dolmark-den']) {
    await page.evaluate(id => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: id }), delve);
    await page.waitForFunction(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined. some stops with true as soon as one entry passes the check; an empty
      // list gives false.
      return scene.sys.isActive() && scene.enemies?.some(enemy => enemy.alive && !enemy.landing);
    }, undefined, { timeout: 20000 });

    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    const state = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      scene.togglePause();

      // map builds one output entry for each input entry, in the same order. The
      // callback's return value becomes that output entry.
      return { cards: scene.partyHud.length, columns: scene.battlefield.columns, rows: scene.battlefield.rows,
        floor: scene.battlefield.boundary, stats: scene.partyHud.map(card => card.hpText.text),
        roles: scene.roleButtons.length, orders: scene.commandButtons.length, motif: scene.stoneTheme.motif };
    });

    expect(state.cards).toBe(5);
    expect(state.columns).toBeUndefined();
    expect(state.rows).toBeUndefined();
    expect(state.roles).toBe(5);
    expect(state.orders).toBe(6);

    // every requires all entries to pass the check; an empty list gives true.
    expect(state.stats.every(text => text.length > 0)).toBe(true);
    if (floor) expect(state.floor).not.toEqual(floor);
    floor = state.floor;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    expect(state.motif).toBe(delve === 'slime-cave' ? 'slime' : delve === 'thornbriar-hollow' ? 'roots' : 'water');
    await page.screenshot({ path: `output/qa/carved-stone/${delve}-battle.png` });
    if (delve === 'slime-cave') {
      const role = await page.evaluate(() => {
        const game = window.__DELVE_DEEP_VISUAL_QA__.game;
        const box = game.scene.getScene('BattleScene').roleButtons[0].box;
        const canvas = game.canvas.getBoundingClientRect();

        return { x: canvas.x + box.x * canvas.width / game.scale.width,
          y: canvas.y + box.y * canvas.height / game.scale.height };
      });

      await page.mouse.move(role.x, role.y);
      await page.mouse.down();
      await page.waitForFunction(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').selectionDetailsClose));
      await page.mouse.up();
      expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').selectedUnitIds.size)).toBe(0);
      await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').selectionDetailsClose());
      await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').showDelveCamp());

      await page.screenshot({ path: 'output/qa/carved-stone/slime-cave-camp.png' });
      const farm = await page.evaluate(() => {
        const game = window.__DELVE_DEEP_VISUAL_QA__.game;
        const scene = game.scene.getScene('BattleScene');

        // find returns the first matching entry, or undefined when none matches. Check for
        // that missing result before using its fields.
        const button = scene.children.list.find(object => object.name === 'carved-stone-button' && object.x === game.scale.width / 2 && object.y === 599);
        const canvas = game.canvas.getBoundingClientRect();
        return { x: canvas.x + button.x * canvas.width / game.scale.width,
          y: canvas.y + button.y * canvas.height / game.scale.height };
      });

      await page.mouse.click(farm.x, farm.y);
      expect(await page.evaluate(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        return scene.currentWaveIndex === scene.bossWaveIndex - 1;
      })).toBe(true);
    }
  }

  expect(errors).toEqual([]);
});
