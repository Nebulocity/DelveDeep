import { test, expect } from './helpers.js';

test('Equipment comparison, full details, equip and unequip update the selected hero', async ({ page, audit }) => {
  await audit.boot();
  const fixture = await page.evaluate(async () => {
    const { selectedCharacter } = await import('/ui/CharacterSelection.js');
    const { equippedItem, grantEquipment } = await import('/game/Equipment.js');
    const hero = selectedCharacter(), current = equippedItem(hero, 'weapon');
    const item = grantEquipment(current.itemId);
    return { hero: hero.id, item: item.id };
  });
  await audit.activate('EquipmentScene', { data: { slot: 'weapon' } });
  await audit.reach('EquipmentScene', `equipment-item-${fixture.item}`);
  await audit.click('EquipmentScene', `equipment-item-${fixture.item}`);
  await audit.capture('EquipmentScene', 'owned-item-comparison');
  await audit.click('EquipmentScene', 'Full item details');
  await audit.capture('EquipmentScene', 'full-item-details');
  await audit.click('EquipmentScene', 'CLOSE');
  await audit.click('EquipmentScene', 'Equip this item');
  const equipped = () => page.evaluate(id => window.__DELVE_DEEP_VISUAL_QA__.state.roster.find(h => h.id === id).equipment.weapon, fixture.hero);
  expect(await equipped()).toBe(fixture.item);
  await audit.capture('EquipmentScene', 'item-equipped');
  await audit.click('EquipmentScene', 'Unequip selected slot');
  expect(await equipped()).toBeNull();
  await audit.capture('EquipmentScene', 'item-unequipped');
});

test('learned ability loadout toggles through visible Equip and Unequip actions', async ({ page, audit }) => {
  await audit.boot();
  const fixture = await page.evaluate(async () => {
    const { selectedCharacter } = await import('/ui/CharacterSelection.js');
    const hero = selectedCharacter();
    return { hero: hero.id, key: hero.abilityLoadout.find(key => !hero.abilities[key].innate) };
  });
  expect(fixture.key).toBeTruthy();
  await audit.activate('AbilitiesScene');
  await audit.reach('AbilitiesScene', `ability-${fixture.key}`);
  await audit.click('AbilitiesScene', `ability-${fixture.key}`);
  const loadout = () => page.evaluate(id => window.__DELVE_DEEP_VISUAL_QA__.state.roster.find(h => h.id === id).abilityLoadout, fixture.hero);
  await audit.click('AbilitiesScene', 'Unequip');
  expect(await loadout()).not.toContain(fixture.key);
  await audit.capture('AbilitiesScene', 'ability-unequipped');
  await audit.click('AbilitiesScene', 'Equip');
  expect(await loadout()).toContain(fixture.key);
  await audit.capture('AbilitiesScene', 'ability-equipped');
});

test('Tactics loadout and RP unlock confirmation preserve cancel and spend once', async ({ page, audit }) => {
  await audit.boot();
  const fixture = await page.evaluate(async () => {
    const { leaderAbilities, leadershipRequirements } = await import('/game/LeaderProgression.js');
    const leader = window.__DELVE_DEEP_VISUAL_QA__.state.leader;
    const abilities = leaderAbilities.filter(a => a.category === 'Assault' && !leadershipRequirements(a).questOnly);
    leader.level = 30; leader.renownPoints = 1000;
    leader.unlockedAbilities = [abilities[0].id]; leader.battleLoadout = [abilities[0].id];
    return { equipped: abilities[0].id, candidate: abilities[1].id, cost: abilities[1].cost };
  });
  await audit.activate('TacticsScene');
  await audit.reach('TacticsScene', `tactic-${fixture.equipped}`);
  await audit.click('TacticsScene', `tactic-${fixture.equipped}`);
  await audit.click('TacticsScene', 'Unequip tactic');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.leader.battleLoadout)).toEqual([]);
  await audit.click('TacticsScene', 'Equip tactic');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.leader.battleLoadout)).toEqual([fixture.equipped]);
  await audit.reach('TacticsScene', `tactic-${fixture.candidate}`);
  await audit.click('TacticsScene', `tactic-${fixture.candidate}`);
  const label = `Unlock · ${fixture.cost} RP`;
  await audit.click('TacticsScene', label);
  await audit.capture('TacticsScene', 'unlock-confirmation');
  await audit.click('TacticsScene', 'CANCEL');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.leader.renownPoints)).toBe(1000);
  await audit.click('TacticsScene', label);
  await audit.click('TacticsScene', 'CONFIRM');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.leader.renownPoints)).toBe(1000 - fixture.cost);
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.leader.unlockedAbilities)).toContain(fixture.candidate);
  await audit.capture('TacticsScene', 'tactic-unlocked');
});

for (const [vendor, service] of [['Alchemist', 'brew'], ['Blacksmith', 'craft'], ['Enchanter', 'inscribe']]) {
  test(`${vendor} ${service} consumes isolated materials and reports success`, async ({ page, audit }) => {
    await audit.boot();
    await page.evaluate(async () => {
      const { CRAFTING_RECIPES, CRAFTING_MATERIALS } = await import('/data/items.js');
      const state = window.__DELVE_DEEP_VISUAL_QA__.state;
      state.gold = 100000; state.inventory.knownRecipes = CRAFTING_RECIPES.map(r => r.id);
      state.inventory.materials = Object.fromEntries(Object.keys(CRAFTING_MATERIALS).map(id => [id, 999]));
    });
    await audit.activate('MarketScene', { data: { vendor, catalogAction: service } });
    const control = (await audit.snapshot('MarketScene')).objects.find(o => o.name?.startsWith('shop-item-') && o.probes?.[0]?.topmost);
    expect(control).toBeTruthy();
    await audit.click('MarketScene', control.name);
    const before = await page.evaluate(() => JSON.stringify(window.__DELVE_DEEP_VISUAL_QA__.state.inventory));
    await audit.click('MarketScene', `shop-action-${control.name.slice(10)}`);
    expect(await page.evaluate(() => JSON.stringify(window.__DELVE_DEEP_VISUAL_QA__.state.inventory))).not.toBe(before);
    await audit.capture('MarketScene', `${vendor}-${service}-success`);
  });
}
