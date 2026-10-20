import { test, expect } from './helpers.js';

for (const vendor of ['Blacksmith', 'Alchemist', 'Enchanter']) {
  test(`${vendor} purchase, insufficient Gold and sell in isolated save`, async ({ page, audit }) => {
    await audit.boot();
    await audit.activate('MarketScene', { data: { vendor } });
    const first = (await audit.snapshot('MarketScene')).objects.find(o => o.name?.startsWith('shop-item-') && o.probes?.[0]?.topmost);
    expect(first).toBeTruthy();
    await audit.click('MarketScene', first.name);
    const id = first.name.slice(10);
    await audit.click('MarketScene', `shop-action-${id}`);
    const unavailable = await audit.capture('MarketScene', `${vendor}-insufficient-gold`);
    expect(unavailable.texts.some(o => /Gold|gold/.test(o.text))).toBe(true);
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.gold)).toBe(0);
    await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      qa.state.gold = 100000;
      qa.game.scene.getScene('MarketScene').render();
    });
    await audit.click('MarketScene', first.name);
    const before = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.inventory.equipment.length);
    await audit.click('MarketScene', `shop-action-${id}`);
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.inventory.equipment.length)).toBe(before + 1);
    const gold = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.gold);
    expect(gold).toBeLessThan(100000);
    await audit.capture('MarketScene', `${vendor}-purchase-feedback`);
    await audit.click('MarketScene', 'shop-service-sell');
    const item = (await audit.snapshot('MarketScene')).objects.find(o => o.name?.startsWith('shop-item-') && o.probes?.[0]?.topmost);
    expect(item).toBeTruthy();
    await audit.click('MarketScene', item.name);
    await audit.click('MarketScene', `shop-action-${item.name.slice(10)}`);
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.gold)).toBeGreaterThan(gold);
    await audit.capture('MarketScene', `${vendor}-sell-feedback`);
  });
}

test('Enchanter cancel scroll selection, enchant and disenchant', async ({ page, audit }) => {
  await audit.boot();
  const fixture = await page.evaluate(async () => {
    const { grantEnchantmentScroll } = await import('/game/Equipment.js');
    const { ACTIVE_ENCHANTMENTS } = await import('/data/enchantments.js');
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const definition = ACTIVE_ENCHANTMENTS.find(d => d.slots.includes('weapon'));
    const scroll = grantEnchantmentScroll(definition.id);
    qa.state.gold = 100000;
    return { id: scroll.id };
  });
  await audit.activate('MarketScene', { data: { vendor: 'Enchanter', catalogAction: 'enchant' } });
  await audit.click('MarketScene', `shop-item-${fixture.id}`);
  await audit.click('MarketScene', `shop-action-${fixture.id}`);
  await audit.capture('MarketScene', 'scroll-selected');
  await audit.click('MarketScene', 'enchant-back-to-scrolls');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('MarketScene').selectedScroll)).toBeNull();
  await audit.click('MarketScene', `shop-item-${fixture.id}`);
  await audit.click('MarketScene', `shop-action-${fixture.id}`);
  const gear = (await audit.snapshot('MarketScene')).objects.find(o => o.name?.startsWith('shop-item-') && o.probes?.[0]?.topmost);
  await audit.click('MarketScene', gear.name);
  await audit.click('MarketScene', `shop-action-${gear.name.slice(10)}`);
  expect(await page.evaluate(id => !!window.__DELVE_DEEP_VISUAL_QA__.state.inventory.equipment.find(item => item.id === id)?.enchantmentId, gear.name.slice(10))).toBe(true);
  await audit.capture('MarketScene', 'enchanted');
  await audit.click('MarketScene', 'shop-service-disenchant');
  await audit.click('MarketScene', gear.name);
  await audit.click('MarketScene', `shop-action-${gear.name.slice(10)}`);
  expect(await page.evaluate(id => !!window.__DELVE_DEEP_VISUAL_QA__.state.inventory.equipment.find(item => item.id === id)?.enchantmentId, gear.name.slice(10))).toBe(false);
  await audit.capture('MarketScene', 'disenchanted');
});

for (const [scene, labels] of Object.entries({ InventoryScene: ['Equipment', 'Supplies', 'Potion packs', 'Materials', 'Recipes'],
  AbilitiesScene: ['All', 'Learned', 'Assault', 'Protect', 'Restore', 'Prepare', 'Generic'],
  TacticsScene: ['Assault', 'Protect', 'Restore', 'Prepare'] })) {
  test(`${scene} every category and empty feedback`, async ({ page, audit }) => {
    await audit.boot();
    await audit.activate(scene);
    for (const label of labels) {
      await audit.click(scene, label);
      await audit.capture(scene, `category-${label}`);
      const category = await page.evaluate(name => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(name).category, scene);
      expect(category).toBe(scene === 'InventoryScene' ? ({ Equipment: 'equipment', Supplies: 'supplies', 'Potion packs': 'potions', Materials: 'materials', Recipes: 'recipes' })[label] : label);
    }
  });
}

test('ability training confirms once, cancel preserves resources and loadout changes', async ({ page, audit }) => {
  await audit.boot();
  await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    qa.state.gold = 100000;
    qa.state.roster.forEach(hero => { hero.level = 30; hero.skillPoints = 100; });
  });
  await audit.activate('AbilitiesScene');
  const first = (await audit.snapshot('AbilitiesScene')).objects.find(o => o.name?.startsWith('ability-') && !o.name.startsWith('ability-slot-') && o.probes?.[0]?.topmost);
  await audit.click('AbilitiesScene', first.name);
  const current = () => page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('AbilitiesScene');
    return { gold: qa.state.gold, key: scene.abilityKey, ranks: qa.state.roster.map(h => h.abilityRanks), points: qa.state.roster.map(h => h.skillPoints) };
  });
  const before = await current();
  await audit.click('AbilitiesScene', 'Train rank');
  await audit.capture('AbilitiesScene', 'training-confirmation');
  await audit.click('AbilitiesScene', 'CANCEL');
  expect(await current()).toEqual(before);
  await audit.click('AbilitiesScene', 'Train rank');
  await audit.click('AbilitiesScene', 'CONFIRM');
  expect((await current()).gold).toBeLessThan(before.gold);
  await audit.capture('AbilitiesScene', 'trained-rank');
});
