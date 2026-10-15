// Check class rows and tactic rarity/equipped states inside the existing landscape UI.
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const width of [915, 1920]) {
  test(`Item classes and tactic rarity at ${width}`, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width, height: width === 915 ? 412 : 1080 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await mkdir('output/qa/item-tactic-identity', { recursive: true });
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('FacilityScene', { facility: 'Blacksmith' }));
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').sys.isActive());
    const classes = await page.evaluate(async () => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
      scene.selection = 'buy';
      scene.category = 'armor';
      scene.itemOffset = 0;
      scene.render();
      const objects = scene.itemList.container.list;
      const cards = objects.filter(entry => entry.name.startsWith('shop-item-'));
      return cards.map(card => {
        const bounds = card.getBounds();
        const icons = objects.filter(entry => entry.name.startsWith('item-class-')
          && entry.x > card.x - 436 && entry.x < card.x + 436 && entry.y > card.y - 136 && entry.y < card.y - 40);
        return { icons: icons.length, inside: icons.every(icon => icon.getBounds().right <= bounds.right - 12) };
      });
    });
    expect(classes.length).toBeGreaterThan(0);
    expect(classes.every(card => card.icons > 0 && card.inside)).toBe(true);
    await page.screenshot({ path: `output/qa/item-tactic-identity/armor-shop-${width}.png` });
    await page.evaluate(async () => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const { grantEquipment } = await import('/game/Equipment.js');
      qa.state.inventory.equipment = [];
      for (const id of ['SM01', 'VMA01', 'ALST01', 'VGBR01']) grantEquipment(id, qa.state);
      qa.activate('ItemsScene');
    });
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('ItemsScene').sys.isActive());
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('ItemsScene').children.list.filter(entry => entry.name.startsWith('item-class-')).length)).toBeGreaterThan(8);
    await page.screenshot({ path: `output/qa/item-tactic-identity/inventory-${width}.png` });
    await page.evaluate(async () => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const { leaderAbilities } = await import('/game/LeaderProgression.js');
      qa.state.leader.level = 50;
      qa.state.leader.renownPoints = 1000;
      qa.state.leader.unlockedAbilities = leaderAbilities.map(ability => ability.id);
      qa.state.leader.battleLoadout = ['fightOn'];
      qa.activate('PartyLeaderScene');
    });
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartyLeaderScene').sys.isActive());
    const tactics = await page.evaluate(async () => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const scene = qa.game.scene.getScene('PartyLeaderScene');
      const { leaderAbilities } = await import('/game/LeaderProgression.js');
      const { ITEM_RARITIES } = await import('/data/items.js');
      const objects = scene.children.list.flatMap(entry => entry.list ?? [entry]);
      return leaderAbilities.map(ability => {
        const frame = objects.find(entry => entry.name === `tactic-rarity-${ability.id}`);
        const name = objects.find(entry => entry.name === `tactic-name-${ability.id}`);
        return { id: ability.id, category: ability.category, y: name.y, rarity: ability.rarity,
          expected: ITEM_RARITIES[ability.rarity].color, actual: name.style.color,
          expectedBorder: Number.parseInt(ITEM_RARITIES[ability.rarity].color.slice(1), 16), actualBorder: frame.strokeColor };
      });
    });
    expect(tactics.every(tactic => tactic.expected === tactic.actual && tactic.expectedBorder === tactic.actualBorder)).toBe(true);
    expect(tactics.find(tactic => tactic.id === 'fightOn').y).toBe(Math.min(...tactics.filter(tactic => tactic.category === 'Assault').map(tactic => tactic.y)));
    await page.screenshot({ path: `output/qa/item-tactic-identity/tactics-equipped-${width}.png` });

    // Click the equipped first row to unequip it, then verify its ordinary frame returns.
    const point = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartyLeaderScene');
      const objects = scene.children.list.flatMap(entry => entry.list ?? [entry]);
      const bounds = objects.find(entry => entry.name === 'hall-tactic-fightOn').getBounds();
      return { x: bounds.centerX, y: bounds.centerY };
    });
    const rect = await page.locator('canvas').boundingBox();
    await page.mouse.click(rect.x + point.x * rect.width / 2400, rect.y + point.y * rect.height / 1080, { delay: 70 });
    await expect.poll(() => page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.leader.battleLoadout.includes('fightOn'))).toBe(false);
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.inspect('PartyLeaderScene').warnings)).toEqual([]);
    expect(errors).toEqual([]);
  });
}
