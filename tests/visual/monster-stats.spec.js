// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';

for (const width of [915, 1920]) {
  test(`Monster stats and inspection at ${width}`, async ({ page }) => {

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    await page.setViewportSize({ width, height: width === 915 ? 412 : 1080 });
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').enemies?.length > 0);
    const result = await page.evaluate(async () => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      scene.combatPaused = true;
      const enemy = scene.enemies[0];

      // The braces pull named fields into local variables. This reads those fields without
      // copying the whole source object.
      const { characterDetails, showSelectionDetails } = await import('/ui/SelectionDetails.js');
      const { MONSTER_STAT_DEFAULTS } = await import('/game/MonsterStats.js');

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
      const missing = Object.keys(MONSTER_STAT_DEFAULTS).filter(stat => !Number.isFinite(enemy[stat]));
      const details = characterDetails(enemy);
      showSelectionDetails(scene, details);

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const body = scene.children.list.find(object => object.text === details.description);
      const bounds = body.getBounds();
      return { missing, description: details.description, bounds: { x: bounds.x, y: bounds.y, right: bounds.right, bottom: bounds.bottom },
        fontSize: body.style.fontSize, scale: body.scaleY };
    });

    expect(result.missing).toEqual([]);
    for (const label of ['Level', 'Health', 'Mana', 'Armor', 'Dodge', 'Block', 'Speed', 'Strength', 'Agility', 'Constitution',
      'Intellect', 'Wisdom', 'Hit Chance', 'Crit Chance', 'Crit Multiplier', 'Attack Power', 'Spell Damage', 'Spell Healing', 'Happiness', 'Delves Cleared']) {
      expect(result.description).toContain(`${label}:`);
    }
    expect(result.bounds.x).toBeGreaterThanOrEqual(0);
    expect(result.bounds.right).toBeLessThanOrEqual(2400);

    expect(result.bounds.bottom).toBeLessThan(1000);
    expect(parseFloat(result.fontSize) * result.scale).toBeGreaterThanOrEqual(28);
    await page.screenshot({ path: `project-backup/monster-review/stats-${width}.png` });
  });
}
