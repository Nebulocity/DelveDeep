// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`Renown, roster grants and walkable arenas at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await mkdir('output/qa/arenas', { recursive: true });
    const controls = await page.evaluate(async () => {

      // The braces pull named fields into local variables. This reads those fields without
      // copying the whole source object.
      const { default: state } = await import('/game/GameState.js');
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene');
      scene.showDevelopmentTools();

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
      const labels = scene.children.list.filter(o => o.depth === 4002 && o.type === 'Text');
      const row = name => labels.find(o => o.text === name).y;
      const tap = (name, y) => {

        // find returns the first matching entry, or undefined when none matches. Check for
        // that missing result before using its fields.
        const label = scene.children.list.find(o => o.text === name && o.y === y && o.depth === 4003);
        scene.children.list.find(o => o.type === 'Rectangle' && o.x === label.x && o.y === y && o.depth === 4002).emit('pointerdown');
      };

      // map builds one output entry for each input entry, in the same order. The
      // callback's return value becomes that output entry.
      const before = state.roster.map(hero => ({ level: hero.level, xp: hero.xp, skillPoints: hero.skillPoints }));
      const renown = state.leader.level;
      tap('+1', row('Renown Level'));
      tap('+5', row('Renown Level'));
      tap('+1', row('Character Level'));
      tap('+5', row('Character Level'));

      if (!state.development.showArenaBorder) tap('OFF', row('Arena Border'));

      // every requires all entries to pass the check; an empty list gives true.
      return { renown: state.leader.level - renown,
        roster: state.roster.every((hero, i) => hero.level === before[i].level + 6
          && hero.skillPoints === before[i].skillPoints + 6 && hero.xp === before[i].xp),
        border: state.development.showArenaBorder };
    });

    expect(controls).toEqual({ renown: 6, roster: true, border: true });
    await page.screenshot({ path: `output/qa/arenas/dev-tools-${viewport.width}.png` });
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').selectionDetailsClose());
    const boundaries = [];

    for (const delve of ['slime-cave', 'thornbriar-hollow', 'dolmark-den', 'murmuring-abyss', 'verdant-tear']) {
      await page.evaluate(id => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: id }), delve);
      await page.waitForFunction(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');

        // ?. only follows this link when the value exists; a missing optional value gives
        // undefined. some stops with true as soon as one entry passes the check; an empty
        // list gives false.
        return scene.sys.isActive() && scene.enemies?.some(e => e.alive && !e.landing);
      });

      await page.waitForTimeout(1500);
      const state = await page.evaluate(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        scene.togglePause();

        // every requires all entries to pass the check; an empty list gives true. filter
        // keeps entries whose callback returns true. It builds a new list and leaves the
        // original list in place. ... expands these entries into the new list or call. It
        // does not deep-copy the objects inside.
        return { boundary: scene.battlefield.boundary, grid: scene.gridCells,
          safe: [...scene.partyUnits, ...scene.enemies].filter(u => u.alive)
            .every(u => !scene.terrain.isUnitBlocked(u, u.arenaX, u.arenaY, 0)),
          cards: scene.partyHud.length };
      });

      expect(state.safe).toBe(true);
      expect(state.grid).toBeUndefined();
      expect(state.cards).toBe(5);
      expect(state.boundary.length).toBeGreaterThan(8);
      boundaries.push(JSON.stringify(state.boundary));
      await page.screenshot({ path: `output/qa/arenas/${delve}-${viewport.width}.png` });
    }

    // A Set keeps each value once. has checks membership without searching a list for
    // duplicate entries.
    expect(new Set(boundaries).size).toBe(5);
    expect(errors).toEqual([]);
  });
}
