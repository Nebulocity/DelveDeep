// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`character and delve UI tweaks at ${viewport.width}`, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize(viewport);
    const errors = [];

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await mkdir('output/qa/screenshots', { recursive: true });
    const capture = async name => {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: `output/qa/screenshots/tweaks-${name}-${viewport.width}.png` });
    };

    const activate = async name => {
      await page.evaluate(key => window.__DELVE_DEEP_VISUAL_QA__.activate(key), name);
      await page.waitForFunction(key => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(key).sys.isActive(), name);
    };
    const press = async (key, selector, hold = false) => {
      const point = await page.evaluate(({ key, selector }) => {
        const game = window.__DELVE_DEEP_VISUAL_QA__.game, scene = game.scene.getScene(key);

        // ?? uses the fallback only for null or undefined. A real zero or false stays
        // intact. find returns the first matching entry, or undefined when none matches.
        // Check for that missing result before using its fields. sort rearranges this
        // array in place. A negative comparator result puts a before b; positive puts it
        // after; zero keeps them tied.
        const object = scene.children.list.find(o => o.name === selector) ?? scene.children.list.filter(o => o.text === selector).sort((a, b) => b.depth - a.depth)[0];
        const rect = game.canvas.getBoundingClientRect();
        return { x: rect.x + object.x * rect.width / game.scale.width, y: rect.y + object.y * rect.height / game.scale.height };
      }, { key, selector });

      if (hold) {
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await page.waitForFunction(key => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(key).selectionDetailsClose), key);
        await page.mouse.up();
      } else await page.mouse.click(point.x, point.y, { delay: 50 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };

    await activate('RosterScene');
    await capture('hall');
    await press('RosterScene', 'hall-class-info');
    await page.waitForFunction(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').selectionDetailsClose));
    await capture('class');
    await press('RosterScene', 'CLOSE');
    await press('RosterScene', 'hall-all-stats');

    await page.waitForFunction(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').equipmentModalClose));
    await capture('stats');
    await press('RosterScene', 'hall-stat-Armor', true);
    await capture('stat-info');
    expect(await page.evaluate(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').equipmentModalClose))).toBe(true);
    await press('RosterScene', 'CLOSE');
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').children.list.some(o => o.name === 'hall-stat-Armor'))).toBe(true);

    await activate('DelveSelectScene');
    await capture('delve');
    await page.evaluate(async () => {

      // The braces pull named fields into local variables. This reads those fields without
      // copying the whole source object.
      const { showSelectionDetails, delveDetails } = await import('/ui/SelectionDetails.js');
      const bridge = window.__DELVE_DEEP_VISUAL_QA__;
      showSelectionDetails(bridge.game.scene.getScene('DelveSelectScene'), delveDetails(bridge.state.currentDelve));
    });

    await capture('delve-info');
    expect(await page.evaluate(() => {
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('DelveSelectScene');

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      return s.children.list.find(o => o.depth === 10002 && o.text?.includes('Possible Drops')).style.align;
    })).toBe('left');

    await activate('DungeonScene');
    await page.evaluate(async () => {
      const b = window.__DELVE_DEEP_VISUAL_QA__, hero = b.state.roster[0];

      // The braces pull named fields into local variables. This reads those fields without
      // copying the whole source object.
      const { grantEquipment, grantPotionPack, equipItem } = await import('/game/Equipment.js');
      for (const id of ['field-blade', 'iron-guard']) equipItem(hero.id, grantEquipment(id).id);
      equipItem(hero.id, grantPotionPack('mending-potion').id);

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const learned = Object.keys(hero.abilities).find(key => !hero.abilityLoadout.includes(key));
      hero.abilityRanks[learned] = 1;
    });

    const point = await page.evaluate(() => {
      const game = window.__DELVE_DEEP_VISUAL_QA__.game, rect = game.canvas.getBoundingClientRect();
      return { x: rect.x + game.scale.width * .28 * rect.width / game.scale.width, y: rect.y + 370 * rect.height / game.scale.height };
    });
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.waitForFunction(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('DungeonScene').selectionDetailsClose));
    await page.mouse.up();

    await capture('battle-overview-info');
    expect(await page.evaluate(() => {
      const b = window.__DELVE_DEEP_VISUAL_QA__, s = b.game.scene.getScene('DungeonScene'), h = b.state.roster[0];
      const d = s.adventurerDetails(h);

      // every requires all entries to pass the check; an empty list gives true. filter
      // keeps entries whose callback returns true. It builds a new list and leaves the
      // original list in place.
      return { gear: d.gear.length, onlyEquipped: Object.keys(h.abilities).filter(k => !h.abilityLoadout.includes(k)).every(k => !d.description.includes(h.abilities[k].name)) };
    })).toEqual({ gear: 4, onlyEquipped: true });

    await activate('BattleScene');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').enemies?.some(e => e.alive && !e.landing));
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    expect(await page.evaluate(() => {
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      s.togglePause();
      s.toggleUnitSelection(s.partyUnits[0]);

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      s.handleEnemyTap(s.enemies.find(e => e.alive && !e.landing));

      // some stops with true as soon as one entry passes the check; an empty list gives
      // false.
      return { selected: s.selectedUnitIds.size, ordered: s.attackTargets.has(s.partyUnits[0].id), editor: s.children.list.some(o => o.text === 'EDIT TERRAIN') };
    })).toEqual({ selected: 0, ordered: true, editor: false });

    await capture('battle');
    await page.evaluate(() => {
      const b = window.__DELVE_DEEP_VISUAL_QA__, s = b.game.scene.getScene('BattleScene');
      b.state.delveCheckpoints[b.state.currentDelve.id] = { nextWave: 5, campUnlocked: true };
      s.showDelveCamp();
    });
    await capture('camp');

    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').children.list.some(o => o.text?.includes('Gold + Material chances')))).toBe(true);
    expect(errors).toEqual([]);
  });
}


