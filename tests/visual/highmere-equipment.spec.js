// Use the live shop to verify that selling a regional drop enables its crafting card.
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('Highmere Blacksmith discovery, crafting and weapon details', async ({ page }) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 915, height: 412 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await mkdir('output/qa/highmere', { recursive: true });
  await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const { grantEquipment } = await import('/game/Equipment.js');
    const { CRAFTING_RECIPE_BY_ID } = await import('/data/items.js');
    qa.state.inventory.equipment = [];
    qa.state.inventory.knownRecipes = [];
    qa.state.inventory.materials = { ...CRAFTING_RECIPE_BY_ID.RALST01.ingredients };
    qa.state.gold = 100000;
    grantEquipment('ALST01', qa.state);
    qa.activate('FacilityScene', { facility: 'Blacksmith' });
  });
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').sys.isActive());
  const prepare = async choice => page.evaluate(choice => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
    scene.selection = choice;
    scene.category = 'weapon';
    scene.itemOffset = 0;
    scene.render();
    const rows = scene.rowsFor({ id: choice });
    return rows.filter(row => row.category === 'weapon').map(row => ({ id: row.id, enabled: row.enabled, description: row.description, category: row.category }));
  }, choice);
  const locked = (await prepare('craft')).find(row => row.id === 'RALST01');
  expect(locked.enabled).toBe(false);
  expect(locked.description).toContain('Sell this weapon');
  expect(locked.category).toBe('weapon');
  await page.screenshot({ path: 'output/qa/highmere/locked-craft.png' });
  const stock = await prepare('buy');
  expect(stock.some(row => ['ALST01', 'VMA01', 'VLS01', 'ALS01'].includes(row.id))).toBe(false);
  const selling = await prepare('sell');
  expect(selling).toHaveLength(1);
  expect(selling[0].description).toContain('learns this recipe');
  await page.screenshot({ path: 'output/qa/highmere/sell-drop.png' });

  // Convert the live Phaser control center into browser pixels for a real click.
  const clickControl = async name => {
    const point = await page.evaluate(name => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
      const object = scene.itemList.container.list.find(entry => entry.name === name);
      const bounds = object.getBounds();
      return { x: bounds.centerX, y: bounds.centerY };
    }, name);
    const rect = await page.locator('canvas').boundingBox();
    await page.mouse.click(rect.x + point.x * rect.width / 2400, rect.y + point.y * rect.height / 1080);
  };
  await clickControl(`shop-action-${selling[0].id}`);
  await expect.poll(() => page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.inventory.knownRecipes)).toContain('RALST01');
  const known = (await prepare('craft')).find(row => row.id === 'RALST01');
  expect(known.enabled).toBe(true);
  expect(known.description).toContain('4972 Gold fee');
  await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
    const { sortShopRows } = await import('/game/ShopServices.js');
    const rows = sortShopRows(scene.rowsFor({ id: 'craft' }).filter(row => row.category === 'weapon'));
    const index = rows.findIndex(row => row.id === 'RALST01');
    scene.itemOffset = Math.floor(index / 2) * 290;
    scene.render();
  });
  await page.screenshot({ path: 'output/qa/highmere/learned-craft.png' });
  await clickControl('shop-action-RALST01');
  await expect.poll(() => page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.inventory.equipment.some(item => item.itemId === 'ALST01'))).toBe(true);
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.inspect('FacilityScene').warnings)).toEqual([]);
  for (const id of ['VGST01', 'ALST01']) {
    const text = await page.evaluate(async id => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene');
      const { getEquipmentDefinition } = await import('/data/items.js');
      const { equipmentDetails } = await import('/game/EquipmentDescriptions.js');
      const { showSelectionDetails } = await import('/ui/SelectionDetails.js');
      const item = getEquipmentDefinition(id);
      showSelectionDetails(scene, equipmentDetails({ ...item, itemId: id }));
      return equipmentDetails({ ...item, itemId: id }).description;
    }, id);
    expect(text).toContain(`Minimum level: ${id === 'VGST01' ? 35 : 45}`);
    expect(text).not.toMatch(/undefined|NaN/);
    await page.screenshot({ path: `output/qa/highmere/${id}-details.png` });
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('FacilityScene').selectionDetailsClose());
  }
  await page.reload();
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.inventory.knownRecipes)).toContain('RALST01');
  expect(errors).toEqual([]);
});
