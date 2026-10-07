import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`popup timers and enchant ownership at ${viewport.width}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await mkdir('tests/visual/screenshots', { recursive: true });
    const activate = async (key, options) => {
      await page.evaluate(({ key, options }) => window.__DELVE_DEEP_VISUAL_QA__.activate(key, options), { key, options });
      await page.waitForFunction(key => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(key).sys.isActive(), key);
    };
    await activate('BattleScene');
    await page.evaluate(async () => {
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      const { showSelectionDetails } = await import('/ui/SelectionDetails.js');
      showSelectionDetails(s, { title: 'Timer review', description: 'Wave countdown and combat continue while details are open.' });
      s.popupProbe = false;
      s.time.delayedCall(250, () => { s.popupProbe = true; });
    });
    await page.waitForFunction(() => {
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      return s.popupProbe && s.enemies.length > 0 && !s.waveTransitioning;
    });
    expect(await page.evaluate(() => {
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      return Boolean(s.selectionDetailsClose) && !s.combatPaused && !s.time.paused;
    })).toBe(true);
    await page.screenshot({ path: `tests/visual/screenshots/popup-timers-${viewport.width}.png` });
    for (const paused of [false, true]) {
      await page.evaluate(async paused => {
        const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        s.selectionDetailsClose?.();
        if (s.combatPaused !== paused) s.togglePause();
        const { showConfirmation } = await import('/ui/ConfirmationDialog.js');
        showConfirmation(s, { title: 'Retreat?', description: 'Timers follow the manual Pause button.', onConfirm: () => {} });
        s.confirmProbe = false;
        s.time.delayedCall(250, () => { s.confirmProbe = true; });
      }, paused);
      await page.waitForTimeout(600);
      expect(await page.evaluate(() => {
        const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        return { paused: s.combatPaused, clock: s.time.paused, fired: s.confirmProbe };
      })).toEqual({ paused, clock: paused, fired: !paused });
      await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').selectionDetailsClose());
      expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').combatPaused)).toBe(paused);
    }
    await activate('FacilityScene', { facility: 'Enchanter' });
    const owner = await page.evaluate(async () => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__, s = qa.game.scene.getScene('FacilityScene');
      qa.state.gold = 1000;
      const { grantEquipment } = await import('/game/Equipment.js');
      const { inscribeEnchantment } = await import('/game/ShopServices.js');
      qa.state.inventory.equipment = [];
      const gear = grantEquipment('field-blade');
      grantEquipment('field-blade');
      qa.state.roster[0].equipment.weapon = gear.id;
      s.testGearId = gear.id;
      s.selectedScroll = inscribeEnchantment('minor-might', qa.state, true).instance.id;
      s.testScrollId = s.selectedScroll;
      s.selection = 'enchant'; s.render();
      return qa.state.roster[0].name;
    });
    const descriptions = await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__, s = qa.game.scene.getScene('FacilityScene');
      return s.rowsFor({ id: 'enchant' }).map(row => row.description);
    });
    expect(descriptions.some(text => text.includes(`Equipped by ${owner}`))).toBe(true);
    expect(descriptions.some(text => text.startsWith('Unequipped'))).toBe(true);
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.inspect('FacilityScene').warnings)).toEqual([]);
    await page.screenshot({ path: `tests/visual/screenshots/enchant-owner-${viewport.width}.png` });
    const point = await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__, rect = qa.game.canvas.getBoundingClientRect();
      return { x: rect.x + 1990 * rect.width / qa.game.scale.width, y: rect.y + 430 * rect.height / qa.game.scale.height };
    });
    await page.mouse.click(point.x, point.y, { delay: 80 });
    expect(await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__, s = qa.game.scene.getScene('FacilityScene');
      return qa.state.inventory.equipment.find(item => item.id === s.testGearId)?.enchantmentId === 'minor-might'
        && !qa.state.inventory.equipment.some(item => item.id === s.testScrollId)
        && qa.state.roster[0].equipment.weapon === s.testGearId;
    })).toBe(true);
    await activate('ItemsScene');
    await page.screenshot({ path: `tests/visual/screenshots/item-type-${viewport.width}.png` });
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.inspect('ItemsScene').warnings)).toEqual([]);
    expect(errors).toEqual([]);
  });
}
