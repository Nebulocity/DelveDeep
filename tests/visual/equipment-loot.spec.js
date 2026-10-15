// Review every named Rare item with real scrolling at phone and desktop landscape sizes.
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { AUTHORED_EQUIPMENT } from '../../data/equipmentCatalog.js';

const rareItems = AUTHORED_EQUIPMENT.filter(item => item.rarity === 'rare');
for (const width of [915, 1920]) {
  test(`Rare equipment lore, perks and scrolling at ${width}`, async ({ page }) => {
    test.setTimeout(420000);
    await page.setViewportSize({ width, height: width === 915 ? 412 : 1080 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await mkdir('output/qa/equipment-loot', { recursive: true });
    await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const scene = qa.game.scene.getScene('RosterScene');
      scene.heroId = qa.state.roster[0].id;
      scene.tab = 'gear';
      qa.activate('RosterScene');
    });
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').sys.isActive());
    for (const item of rareItems) {
      const info = await page.evaluate(async item => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');
        const { equipmentDetails } = await import('/game/EquipmentDescriptions.js');
        const { showSelectionDetails } = await import('/ui/SelectionDetails.js');
        showSelectionDetails(scene, equipmentDetails({ ...item, itemId: item.id }));
        const body = scene.children.list.flatMap(object => object.list ?? [object]).find(object => object.name === 'guild-details-body');
        const scroll = scene.children.getByName('guild-details-scroll');
        const close = scene.children.list.find(object => object.text === 'CLOSE');
        const bounds = close.getBounds();
        return { text: body.text, fontSize: body.style.fontSize, bodyWidth: body.width,
          hasMask: Boolean(scroll.mask), scrollHeight: body.height, scrollStart: scroll.y,
          closeInside: bounds.left >= 0 && bounds.top >= 0 && bounds.right <= 2400 && bounds.bottom <= 1080 };
      }, item);
      expect(info.text).toContain(item.description);
      expect(info.text).toContain(item.perk.name);
      expect(info.text).toContain('Minimum level: 15 (Rare)');
      expect(info.text).not.toMatch(/undefined|NaN|�/);
      expect(Number.parseFloat(info.fontSize)).toBeGreaterThanOrEqual(30);
      expect(info.bodyWidth).toBeLessThanOrEqual(1321);
      expect(info.hasMask).toBe(true);
      expect(info.closeInside).toBe(true);
      await page.screenshot({ path: `output/qa/equipment-loot/${item.id}-${width}-lore.png` });

      // Use actual wheel input to ensure the bottom stats and perk can be reached.
      const rect = await page.locator('canvas').boundingBox();
      await page.mouse.move(rect.x + 1200 * rect.width / 2400, rect.y + 460 * rect.height / 1080);
      await page.mouse.wheel(0, 3000);
      await expect.poll(() => page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').children.getByName('guild-details-scroll').y)).toBeLessThan(0);
      const bottom = await page.evaluate(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');
        const scroll = scene.children.getByName('guild-details-scroll');
        const body = scroll.list.find(object => object.name === 'guild-details-body');
        return body.getBounds().bottom;
      });
      expect(bottom).toBeLessThan(820);
      await page.screenshot({ path: `output/qa/equipment-loot/${item.id}-${width}-bonuses.png` });
      await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').selectionDetailsClose());
    }
    expect(errors).toEqual([]);
  });
}

test('live combat resolves weapon perks and preserves them through reload', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const { grantEquipment, equipItem } = await import('/game/Equipment.js');
    const hero = qa.state.roster.find(hero => hero.className === 'Gladiator');
    hero.level = 20;
    equipItem(hero.id, grantEquipment('R1L01').id);
    qa.state.activeParty = [hero, ...qa.state.roster.filter(other => other.id !== hero.id).slice(0, 4)];
    qa.activate('BattleScene');
  });
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyUnits?.length > 0);
  const saved = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('BattleScene');
    if (!scene.combatPaused) scene.togglePause();
    const unit = scene.partyUnits.find(unit => unit.className === 'Gladiator');
    const { equipmentPerkBonus } = await import('/game/EquipmentPerks.js');
    unit.hp = Math.floor(unit.maxHp * 0.4);
    const bonus = equipmentPerkBonus(unit, 'block');
    const { saveProfile } = await import('/game/GameStorage.js');
    saveProfile();
    return { id: unit.id, perks: unit.equipmentPerks, hp: unit.hp, bonus };
  });
  expect(saved.bonus).toBe(0.1);
  await page.reload();
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && !scene.restoringBattle && scene.combatPaused;
  });
  const restored = await page.evaluate(id => {
    const unit = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyUnits.find(unit => unit.id === id);
    return { perks: unit.equipmentPerks, hp: unit.hp };
  }, saved.id);
  expect(restored).toEqual({ perks: saved.perks, hp: saved.hp });
});
