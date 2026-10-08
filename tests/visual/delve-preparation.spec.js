// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';

// Explicit screenshots cover layout; automatic trace captures can turn taps into holds.
test.use({ trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false } });

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`delve preparation themes and party interactions at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    const activate = async (name, delve) => {
      await page.evaluate(({ name, delve }) => window.__DELVE_DEEP_VISUAL_QA__.activate(name, { delve }), { name, delve });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.waitForFunction(name => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(name).sys.isActive(), name);
    };

    const capture = async name => {
      await page.waitForTimeout(50);
      await page.screenshot({ path: `output/qa/delve-preparation/${name}-${viewport.width}.png` });
    };

    for (const [delve, motif] of [['slime-cave', 'slime'], ['thornbriar-hollow', 'roots'], ['dolmark-den', 'water'], ['murmuring-abyss', 'runes']]) {
      for (const name of ['DelveSelectScene', 'PartySelectScene', 'DungeonScene']) {
        await activate(name, delve);
        const state = await page.evaluate(name => {
          const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(name);

          // filter keeps entries whose callback returns true. It builds a new list and
          // leaves the original list in place. find returns the first matching entry, or
          // undefined when none matches. Check for that missing result before using its
          // fields.
          return { motif: scene.stoneTheme.motif, wooden: scene.children.list.filter(object => object.name === 'wooden-panel').length,
            bannerTop: scene.children.list.find(object => object.name === 'carved-stone-panel').getBounds().top,
            warnings: window.__DELVE_DEEP_VISUAL_QA__.inspect(name).warnings };
        }, name);

        expect(state.motif).toBe(motif);
        expect(state.wooden).toBe(0);
        expect(state.bannerTop).toBe(0);
        expect(state.warnings).toEqual([]);
        await capture(`${delve}-${name}`);
      }
    }

    await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      qa.state.activeParty = [];
      qa.state.lastPartyIds = [];
    });
    await activate('PartySelectScene', 'slime-cave');
    await page.waitForTimeout(150);

    const dragPoint = await page.evaluate(() => {
      const game = window.__DELVE_DEEP_VISUAL_QA__.game;
      const column = game.scene.getScene('PartySelectScene').columns[2];
      const canvas = game.canvas.getBoundingClientRect();

      return { x: canvas.x + column.bounds.centerX * canvas.width / game.scale.width,
        y: canvas.y + (column.bounds.y + 70) * canvas.height / game.scale.height };
    });

    await page.mouse.move(dragPoint.x, dragPoint.y);
    await page.mouse.down();
    await page.mouse.move(dragPoint.x, dragPoint.y - 45, { steps: 8 });
    await page.mouse.up();
    const dragState = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene');
      return { offset: scene.columns[2].offset, selected: scene.selectedIds.size, details: Boolean(scene.selectionDetailsClose) };
    });

    expect(dragState).toMatchObject({ selected: 0, details: false });
    expect(dragState.offset).toBeGreaterThan(0);
    const point = async (id) => page.evaluate(id => {
      const game = window.__DELVE_DEEP_VISUAL_QA__.game;
      const scene = game.scene.getScene('PartySelectScene');
      const card = scene.cards.get(id).card;
      const canvas = game.canvas.getBoundingClientRect();

      return { x: canvas.x + card.x * canvas.width / game.scale.width, y: canvas.y + card.y * canvas.height / game.scale.height };
    }, id);

    const id = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.roster.find(hero => hero.role === 'Tank').id);
    const card = await point(id);
    await page.mouse.move(card.x, card.y);
    await page.mouse.down();
    await page.waitForFunction(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene').selectionDetailsClose));
    await page.mouse.up();
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene').selectedIds.size)).toBe(0);

    await capture('adventurer-details');
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene').children.list.some(object => object.name === 'wooden-panel'))).toBe(false);
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene').selectionDetailsClose());
    await page.mouse.click(card.x, card.y);
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene').selectedIds.size)).toBe(1);
    await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene');

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
      const secondTank = window.__DELVE_DEEP_VISUAL_QA__.state.roster.filter(hero => hero.role === 'Tank')[1];
      scene.toggleAdventurer(secondTank.id);
    });

    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene').selectedIds.size)).toBe(1);
    await capture('role-limit');
    await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene');
      for (const hero of window.__DELVE_DEEP_VISUAL_QA__.state.roster) {
        if (!scene.selectedIds.has(hero.id) && scene.canAddToSelection(hero)) scene.toggleAdventurer(hero.id);
      }
    });

    await capture('party-ready');
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene').selectedIds.size)).toBe(5);
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene').begin());
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('DungeonScene').sys.isActive());
    await activate('PartySelectScene', 'slime-cave');
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene').selectedIds.size)).toBe(5);
    expect(errors).toEqual([]);
  });
}
