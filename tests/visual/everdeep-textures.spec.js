// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 915, height: 412 }, { width: 2048, height: 922 }]) {
  test(`Everdeep renders bundled stone surfaces at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.evaluate(async () => {

      // The braces pull named fields into local variables. This reads those fields without
      // copying the whole source object.
      const { default: state } = await import('/game/GameState.js');
      state.development.unlockAll = true;
      state.everdeep = { schemaVersion: 2, runs: [], totals: { runsStarted: 0, chestsClaimed: 0 } };
      window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScenes(true)[0].scene.start('EverdeepScene');
    });

    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('EverdeepScene').content?.list.length > 10);
    const surfaces = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('EverdeepScene');
      const texture = scene.textures.get('carved-stone-panel');

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
      const panels = scene.content.list.filter(object => object.name === 'carved-stone-panel');
      const pixels = panels[0].texture.getSourceImage().getContext('2d').getImageData(30, 30, 50, 40).data;

      // A Set keeps each value once. has checks membership without searching a list for
      // duplicate entries.
      const colors = new Set();
      for (let i = 0; i < pixels.length; i += 4) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);

      // map builds one output entry for each input entry, in the same order. The
      // callback's return value becomes that output entry.
      return { source: texture.key, bundled: texture.getSourceImage().src.startsWith('data:image/png'),
        types: panels.map(panel => panel.type), colors: colors.size };
    });

    expect(surfaces.source).toBe('carved-stone-panel');
    expect(surfaces.bundled).toBe(true);
    expect(surfaces.types.length).toBeGreaterThan(5);

    // every requires all entries to pass the check; an empty list gives true.
    expect(surfaces.types.every(type => type === 'Image')).toBe(true);
    expect(surfaces.colors).toBeGreaterThan(10);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `output/qa/screenshots/everdeep-textured-${viewport.width}.png` });
  });
}

test('All five authored delves render real stone textures', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());

  for (const id of ['slime-cave', 'thornbriar-hollow', 'dolmark-den', 'murmuring-abyss', 'verdant-tear']) {
    await page.evaluate(delve => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve }), id);
    await page.waitForFunction(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      return scene.sys.isActive() && scene.partyHud?.length === 5;
    });

    const surfaces = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      if (!scene.paused) scene.togglePause();

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
      const panels = scene.children.list.filter(object => object.name === 'carved-stone-panel');

      // map builds one output entry for each input entry, in the same order. The
      // callback's return value becomes that output entry.
      return panels.map(panel => {
        const pixels = panel.texture.getSourceImage().getContext('2d').getImageData(25, 25, 30, 20).data;

        // A Set keeps each value once. has checks membership without searching a list for
        // duplicate entries.
        const colors = new Set();
        for (let index = 0; index < pixels.length; index += 4) colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
        return { type: panel.type, key: panel.texture.key, colors: colors.size };
      });
    });

    expect(surfaces.length).toBeGreaterThan(10);

    // every requires all entries to pass the check; an empty list gives true.
    expect(surfaces.every(surface => surface.type === 'Image' && surface.key.startsWith('carved-stone-surface-') && surface.colors > 10)).toBe(true);
    await page.screenshot({ path: `output/qa/screenshots/stone-fixed-${id}.png` });
  }

  expect(errors).toEqual([]);
});
