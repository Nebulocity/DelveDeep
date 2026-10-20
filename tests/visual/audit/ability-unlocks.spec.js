import { test, expect } from './helpers.js';

test('Abilities renders inspectable locked skills and disables learning and equipment', async ({ page, audit }) => {
  await audit.boot();
  await audit.activate('AbilitiesScene');
  const locked = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const { selectedCharacter } = await import('/ui/CharacterSelection.js');
    const { sortedAbilityEntries } = await import('/game/AdventurerAbilities.js');
    const hero = selectedCharacter();
    const [key, ability] = sortedAbilityEntries(hero).find(([, ability]) => ability.minimumLevel > hero.level);
    const scene = qa.game.scene.getScene('AbilitiesScene');
    scene.abilityKey = key;
    scene.render();
    return { key, name: ability.name, level: ability.minimumLevel };
  });
  const data = await audit.capture('AbilitiesScene', 'locked-skill');
  expect(data.texts.some(o => o.text.includes(`Unlocks at Level ${locked.level}`))).toBe(true);
  expect(data.texts.some(o => o.text === locked.name)).toBe(true);
  const buttons = await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('AbilitiesScene');
    return s.children.list.filter(o => o.input && ['Learn', 'Equip'].includes(o.name))
      .map(o => ({ name: o.name, sound: o.uiSound }));
  });
  expect(buttons).toHaveLength(2);
  expect(buttons.every(button => button.sound === 'failure')).toBe(true);
  await audit.click('AbilitiesScene', 'Learn');
  expect(await page.evaluate(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('AbilitiesScene').selectionDetailsClose))).toBe(false);
  // Shared gameplay rules also reject calls that bypass the disabled buttons.
  const result = await page.evaluate(async key => {
    const { selectedCharacter } = await import('/ui/CharacterSelection.js');
    const { purchaseAdventurerAbility, toggleAdventurerAbility } = await import('/game/AdventurerAbilities.js');
    const hero = selectedCharacter();
    return [purchaseAdventurerAbility(hero.id, key).ok, toggleAdventurerAbility(hero.id, key).ok];
  }, locked.key);
  expect(result).toEqual([false, false]);
});

test('Ability unlock notices batch adventurers on a safe menu and do not repeat', async ({ page, audit }) => {
  await audit.boot();
  const names = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const { grantAdventurerLevels } = await import('/game/AdventurerProgression.js');
    const heroes = qa.state.roster.slice(0, 2);
    heroes.forEach(hero => grantAdventurerLevels(hero, 4));
    return heroes.map(hero => hero.name);
  });
  expect((await audit.snapshot('TitleScene')).texts.some(o => o.text === 'New Abilities Available!')).toBe(false);
  await audit.activate('TownScene');
  const data = await audit.capture('TownScene', 'ability-unlocks');
  expect(data.texts.some(o => o.text === 'New Abilities Available!')).toBe(true);
  for (const name of names) expect(data.texts.some(o => o.text.includes(name))).toBe(true);
  const close = await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TownScene');
    const label = scene.children.list.find(object => object.text === 'CLOSE');
    return { x: label.x, y: label.y };
  });
  const point = await audit.point(close.x, close.y);
  await page.mouse.click(point.x, point.y, { delay: 70 });
  expect(await page.evaluate(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TownScene').selectionDetailsClose))).toBe(false);
  await audit.activate('AbilitiesScene');
  expect((await audit.snapshot('AbilitiesScene')).texts.some(o => o.text === 'New Abilities Available!')).toBe(false);
});
