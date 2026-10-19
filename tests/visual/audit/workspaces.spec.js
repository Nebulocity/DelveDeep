import { test, expect } from './helpers.js';

for (const scene of ['HeroesScene', 'AbilitiesScene', 'EquipmentScene', 'TacticsScene', 'InventoryScene']) {
  test(`${scene} selections, scrolling and detail states`, async ({ page, audit }) => {
    test.setTimeout(300000);
    await audit.boot();
    await audit.activate(scene);
    const original = await audit.snapshot(scene);
    // Character changes rebuild skill/item identities. Finish roster coverage first,
    // then discover the selected character's current workspace rather than stale rows.
    const roster = original.objects.filter(o => o.name?.startsWith('character-') && o.enabled);
    for (const hit of roster) {
      await audit.reach(scene, hit.name);
      await audit.click(scene, hit.name);
      expect(await page.evaluate(async () => (await import('/ui/CharacterSelection.js')).selectedCharacter()?.id)).toBe(hit.name.slice(10));
    }
    const selection = (await audit.snapshot(scene)).objects.filter(o => /^(ability-|equipment-slot-|tactic-|inventory-)/.test(o.name) && o.enabled);
    if (!selection.length && roster.length) selection.push(await audit.reach(scene, roster[0].name));
    expect(selection.length, 'Visible selection surfaces').toBeGreaterThan(0);
    for (const hit of selection) {
      await audit.reach(scene, hit.name);
      await audit.click(scene, hit.name, hit.probes[1]?.topmost ? 1 : 0);
      const after = await audit.capture(scene, hit.name);
      expect(after.active).toBe(true);
      expect(after.texts.length).toBeGreaterThan(0);
      const selected = await page.evaluate(async ({ scene, name }) => {
        const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(scene);
        if (name.startsWith('character-')) return (await import('/ui/CharacterSelection.js')).selectedCharacter()?.id;
        if (name.startsWith('equipment-slot-')) return s.slot;
        if (name.startsWith('ability-slot-')) return s.abilityKey;
        return s.abilityKey ?? s.tacticId ?? s.entryId;
      }, { scene, name: hit.name });
      if (!hit.name.startsWith('ability-slot-')) expect(selected).toBe(hit.name.replace(/^(character-|equipment-slot-|ability-|tactic-|inventory-)/, ''));
      else {
        const expected = await page.evaluate(async name => (await import('/ui/CharacterSelection.js')).selectedCharacter().abilityLoadout[Number(name.slice(13))], hit.name);
        if (expected) expect(selected).toBe(expected);
        else expect(after.texts.some(t => /slot is empty/i.test(t.text))).toBe(true);
      }
    }
    const character = (await audit.snapshot(scene)).objects.find(o => o.name?.startsWith('character-') && o.probes?.[0]?.topmost);
    if (character) {
      await page.mouse.move(character.probes[0].x, character.probes[0].y);
      await page.mouse.down();
      await page.waitForTimeout(650);
      await audit.capture(scene, 'held-character-details');
      expect(await page.evaluate(name => !!window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(name).selectionDetailsClose, scene)).toBe(true);
      await page.mouse.up();
      await page.keyboard.press('Escape');
      expect(await page.evaluate(name => !!window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(name).selectionDetailsClose, scene)).toBe(false);
      const p = character.probes[0];
      await page.mouse.move(p.x, p.y);
      await page.mouse.wheel(0, 1600);
      await page.waitForTimeout(250);
      await audit.capture(scene, 'scrolled-roster');
    }
  });
}

for (const vendor of ['Blacksmith', 'Alchemist', 'Enchanter']) {
  test(`Market ${vendor} services, filters, selection and transaction feedback`, async ({ page, audit }) => {
    await audit.boot();
    await audit.activate('MarketScene', { data: { vendor } });
    const services = (await audit.snapshot('MarketScene')).objects.filter(o => o.name?.startsWith('shop-service-'));
    for (const service of services) {
      await audit.click('MarketScene', service.name);
      await audit.capture('MarketScene', `${vendor}-${service.name}`);
      const data = await audit.snapshot('MarketScene');
      for (const category of data.objects.filter(o => o.name?.startsWith('shop-category-'))) {
        await audit.click('MarketScene', category.name);
        expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('MarketScene').category)).toBe(category.name.slice(14));
      }
      await audit.click('MarketScene', 'shop-category-all');
      const items = (await audit.snapshot('MarketScene')).objects.filter(o => o.name?.startsWith('shop-item-') && o.probes?.[0]?.topmost && o.inViewport);
      for (const hit of items) {
        await audit.click('MarketScene', hit.name, hit.probes[1]?.topmost ? 1 : 0);
        expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('MarketScene').selectedItemId)).toBe(hit.name.slice(10));
      }
      if (items.length) {
        await audit.capture('MarketScene', `${vendor}-${service.name}-selected`);
        const p = items[0].probes[0];
        await page.mouse.move(p.x, p.y);
        await page.mouse.wheel(0, 1300);
        await page.waitForTimeout(250);
        await audit.capture('MarketScene', `${vendor}-${service.name}-scrolled`);
      }
    }
    await audit.click('MarketScene', 'facility-return');
    await audit.active('TownScene');
  });
}

test('repeated scene lifecycle keeps input listener counts bounded', async ({ page, audit }) => {
  await audit.boot();
  for (const scene of ['TownScene', 'HeroesScene', 'AbilitiesScene', 'EquipmentScene', 'MarketScene', 'TitleScene']) {
    await audit.activate(scene);
    const first = await audit.snapshot(scene);
    for (let cycle = 0; cycle < 3; cycle++) {
      await audit.activate(scene === 'TownScene' ? 'TitleScene' : 'TownScene');
      await audit.activate(scene);
    }
    const final = await audit.capture(scene, 'lifecycle-final');
    expect(final.lifecycle.inputListeners).toEqual(first.lifecycle.inputListeners);
    expect(final.lifecycle.objects).toBeLessThanOrEqual(first.lifecycle.objects + 12);
  }
});

test('Inventory Manage equipment opens the selected armor and owner', async ({ page, audit }) => {
  await audit.boot();
  await audit.activate('InventoryScene');
  const item = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.inventory.equipment.find(item => item.slot === 'armor'));
  let reachable = false;
  for (let scroll = 0; scroll < 30; scroll++) {
    const data = await audit.snapshot('InventoryScene');
    if (data.objects.some(o => o.name === `inventory-${item.id}` && o.probes?.[0]?.topmost && o.inViewport)) { reachable = true; break; }
    const p = await audit.point(800, 600);
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(0, 350);
    await page.waitForTimeout(100);
  }
  expect(reachable).toBe(true);
  await audit.click('InventoryScene', `inventory-${item.id}`);
  await audit.capture('InventoryScene', 'armor-selected-for-management');
  await audit.click('InventoryScene', 'Manage equipment');
  await audit.active('EquipmentScene');
  await audit.capture('EquipmentScene', 'armor-management-destination');
  expect(await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('EquipmentScene');
    return { slot: s.slot, itemId: s.itemId };
  })).toEqual({ slot: 'armor', itemId: item.id });
});
