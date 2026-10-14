// Real pointer gestures catch detached Phaser controls that still receive input.
import { test, expect } from '@playwright/test';
import { getEquipmentDefinition, getPotionDefinition } from '../../data/items.js';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`Equipment and Abilities input isolation at ${viewport.width}`, async ({ page }) => {

    // Loading the game's full art set and exercising all four pickers can exceed the
    // default timeout on a busy workstation. Assertions still wait for actual state.
    test.setTimeout(180000);
    await page.setViewportSize(viewport);
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    const fixtures = ['BLS01', 'PV01', 'UMI003', 'mending-potion'].map(itemId => {
      const definition = getEquipmentDefinition(itemId) ?? getPotionDefinition(itemId);
      return { ...definition, id: `qa-${definition.slot}`, itemId, ...(definition.slot === 'potion' ? { charges: 3 } : {}) };
    });
    await page.evaluate(fixtures => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      qa.state.inventory.equipment.push(...fixtures);
      qa.state.roster.find(hero => hero.id === 'garrick').level = 10;
      const scene = qa.game.scene.getScene('RosterScene');
      scene.heroId = 'garrick';
      scene.tab = 'gear';
      qa.activate('RosterScene');
    }, fixtures);
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').sys.isActive());
    const point = async (x, y) => {
      const rect = await page.locator('canvas').boundingBox();
      return { x: rect.x + x * rect.width / 2400, y: rect.y + y * rect.height / 1080 };
    };
    const click = async (x, y) => { const p = await point(x, y); await page.mouse.click(p.x, p.y, { delay: 70 }); };
    for (let repeat = 0; repeat < 3; repeat++) {
      await click(2032, 186);
      await expect.poll(() => page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').tab)).toBe('skills');

      // This gap used to fall through to the old weapon card and its View Stats button.
      await click(1412, 520);
      const p = await point(1412, 520);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.waitForTimeout(650);
      await page.mouse.up();
      expect(await page.evaluate(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');
        return Boolean(scene.equipmentModalClose || scene.selectionDetailsClose);
      })).toBe(false);
      await click(1414, 186);
    }

    await click(1288, 492);
    await page.waitForFunction(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').selectionDetailsClose));
    const text = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');
      const flatten = list => list.flatMap(object => [object, ...(object.list ? flatten(object.list) : [])]);
      return flatten(scene.children.list).map(object => object.text ?? '').join('\n');
    });
    expect(text).toContain('Classes:');
    expect(text).toContain('Minimum level: 1 (Common)');
    expect(text).toContain('Strength');
    await page.screenshot({ path: `output/qa/screenshots/equipment-details-${viewport.width}.png` });
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').selectionDetailsClose());
    await click(1549, 492);
    await page.waitForFunction(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').equipmentModalClose));

    // Every picker uses the same immediate equip transaction, including potion charges.
    for (const [index, slot] of ['weapon', 'armor', 'accessory', 'potion'].entries()) {
      if (index > 0) await click(1549 + index % 2 * 609, 492 + Math.floor(index / 2) * 253);
      const target = await page.evaluate(slot => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');
        if (scene.children.list.some(object => object.text === 'Compare')) throw new Error('Compare must be removed');
        const button = scene.children.getByName(`hall-equip-item-qa-${slot}`);
        if (!button) throw new Error(`Missing Equip action for ${slot}`);
        return { x: button.x, y: button.y };
      }, slot);
      await click(target.x, target.y);
      await expect.poll(() => page.evaluate(slot => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');
        const hero = window.__DELVE_DEEP_VISUAL_QA__.state.roster.find(hero => hero.id === scene.heroId);
        return hero.equipment[slot] === `qa-${slot}` && scene.tab === 'gear'
          && !scene.equipmentModalClose && !scene.selectionDetailsClose;
      }, slot)).toBe(true);
    }
    await page.screenshot({ path: `output/qa/screenshots/equipment-direct-equip-${viewport.width}.png` });
  });
}
