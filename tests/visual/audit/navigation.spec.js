import { test, expect } from './helpers.js';

const destinations = { heroes: 'HeroesScene', abilities: 'AbilitiesScene', equipment: 'EquipmentScene',
  tactics: 'TacticsScene', items: 'InventoryScene', quests: 'QuestJournalScene', market: 'MarketScene',
  tavern: 'TavernScene', exchange: 'ExchangeScene' };

for (const [id, scene] of Object.entries(destinations)) {
  test(`town ${id} full-card navigation and repeated return`, async ({ page, audit }) => {
    await audit.boot();
    for (let edge = 0; edge < 5; edge++) {
      await audit.activate('TownScene');
      await audit.click('TownScene', `town-${id}`, edge);
      await audit.active(scene);
      if (!edge) await audit.capture(scene, 'entered-from-town');
      await audit.click(scene, scene === 'MarketScene' ? 'facility-return' : 'Back to Town');
      await audit.active('TownScene');
    }
    await audit.capture('TownScene', `returned-from-${id}`);
  });
}

test('town settings switch both layouts, block background, dismiss and persist', async ({ page, audit }) => {
  await audit.boot();
  await audit.activate('TownScene');
  for (const layout of ['side-rails', 'compact-bar']) {
    await audit.click('TownScene', 'town-settings');
    const before = await audit.capture('TownScene', `settings-before-${layout}`);
    expect(before.objects.find(o => o.name === 'town-heroes')?.enabled).toBe(false);
    await audit.click('TownScene', `town-layout-${layout}`);
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.preferences.townNavigation)).toBe(layout);
    await audit.capture('TownScene', `settings-${layout}`);
    await audit.click('TownScene', 'town-modal-close');
    await audit.capture('TownScene', `layout-${layout}`);
    await audit.click('TownScene', 'town-heroes', 1);
    await audit.active('HeroesScene');
    await page.keyboard.press('Escape');
    await audit.active('TownScene');
  }
  await page.reload();
  await audit.active('TitleScene');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.preferences.townNavigation)).toBe('compact-bar');
});

test('town navigation cancels after dragging away', async ({ page, audit }) => {
  await audit.boot();
  await audit.activate('TownScene');
  const data = await audit.snapshot('TownScene');
  const hit = data.objects.find(o => o.name === 'town-heroes');
  const p = hit.probes[0];
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(1, page.viewportSize().height - 1, { steps: 8 });
  await page.mouse.up();
  expect((await audit.snapshot('TownScene')).active).toBe(true);
});

for (const [scene, labels] of Object.entries({ QuestJournalScene: ['Available quests', 'Active quests', 'Completed quests'],
  TavernScene: ['Speak to the innkeeper'], ExchangeScene: ['Ask about Aether'] })) {
  test(`${scene} unavailable actions replace toast and remain navigable`, async ({ page, audit }) => {
    await audit.boot();
    await audit.activate(scene);
    for (const label of labels) {
      await audit.click(scene, label);
      await audit.click(scene, label);
      const data = await audit.capture(scene, label);
      expect(data.texts.some(o => /kobold|construction/i.test(o.text))).toBe(true);
    }
    await audit.click(scene, 'Back to Town');
    await audit.active('TownScene');
  });
}

test('map settings preserves seven-tap developer gate and returns safely', async ({ page, audit }) => {
  await audit.boot();
  await audit.click('TitleScene', 'world-map-settings');
  await audit.capture('TitleScene', 'settings');
  for (let tap = 0; tap < 6; tap++) await audit.click('TitleScene', 'SETTINGS');
  expect((await audit.snapshot('TitleScene')).texts.some(o => o.text === 'DEV SETTINGS')).toBe(false);
  await audit.click('TitleScene', 'SETTINGS');
  await expect.poll(async () => (await audit.snapshot('TitleScene')).texts.some(o => o.text === 'DEV SETTINGS')).toBe(true);
  await audit.capture('TitleScene', 'developer-settings');
  const gold = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.gold);
  await audit.click('TitleScene', '+5,000');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.gold)).toBe(gold + 5000);
  await audit.click('TitleScene', 'CLOSE');
  await audit.click('TitleScene', 'CLOSE');
  await audit.click('TitleScene', 'world-map-settings');
  expect((await audit.snapshot('TitleScene')).texts.some(o => o.text === 'DEV SETTINGS')).toBe(false);
  await audit.click('TitleScene', 'CLOSE');
});

test('native touch taps navigate and a dragged touch cancels a town card', async ({ page, audit }) => {
  await audit.boot();
  await audit.activate('TownScene');
  const point = (await audit.snapshot('TownScene')).objects.find(o => o.name === 'town-heroes').probes[0];
  await page.touchscreen.tap(point.x, point.y);
  await audit.active('HeroesScene');
  await audit.capture('HeroesScene', 'touch-entry');
  const back = (await audit.snapshot('HeroesScene')).objects.find(o => o.name === 'Back to Town').probes[0];
  await page.touchscreen.tap(back.x, back.y);
  await audit.active('TownScene');
  const card = (await audit.snapshot('TownScene')).objects.find(o => o.name === 'town-heroes').probes[0];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: card.x, y: card.y }] });
  await page.waitForTimeout(120);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 1, y: page.viewportSize().height - 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(250);
  expect((await audit.snapshot('TownScene')).active).toBe(true);
  audit.interactions.push({ scene: 'TownScene', label: 'town-heroes', kind: 'native-touch-tap-and-drag-cancel' });
  await cdp.detach();
});
