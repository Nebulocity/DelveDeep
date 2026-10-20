import { test, expect } from './helpers.js';

test('Abilities hides locked skills and exposes automatically learned skills at their level', async ({ page, audit }) => {
  await audit.boot();
  await audit.activate('AbilitiesScene');
  const locked = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const { selectedCharacter } = await import('/ui/CharacterSelection.js');
    const { abilityEntries } = await import('/game/AdventurerAbilities.js');
    const hero = selectedCharacter();
    const [key, ability] = abilityEntries(hero).find(([, ability]) => ability.minimumLevel > hero.level);
    const scene = qa.game.scene.getScene('AbilitiesScene');
    scene.abilityKey = key;
    scene.render();
    return { key, name: ability.name, level: ability.minimumLevel };
  });
  const data = await audit.capture('AbilitiesScene', 'locked-skill');
  expect(data.texts.some(o => o.text === locked.name)).toBe(false);
  const selection = await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('AbilitiesScene');
    return { key: s.abilityKey, learn: s.children.list.some(o => o.name === 'Learn') };
  });
  expect(selection).toEqual({ key: null, learn: false });
  // Shared gameplay rules also reject calls that bypass the disabled buttons.
  const result = await page.evaluate(async key => {
    const { selectedCharacter } = await import('/ui/CharacterSelection.js');
    const { purchaseAdventurerAbility, toggleAdventurerAbility } = await import('/game/AdventurerAbilities.js');
    const hero = selectedCharacter();
    return [purchaseAdventurerAbility(hero.id, key).ok, toggleAdventurerAbility(hero.id, key).ok];
  }, locked.key);
  expect(result).toEqual([false, false]);
  const learned = await page.evaluate(async ({ key, level }) => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const { selectedCharacter } = await import('/ui/CharacterSelection.js');
    const { grantAdventurerLevels } = await import('/game/AdventurerProgression.js');
    const hero = selectedCharacter();
    const gold = qa.state.gold, points = hero.skillPoints, loadout = [...hero.abilityLoadout];
    const gained = level - hero.level;
    grantAdventurerLevels(hero, gained);
    const scene = qa.game.scene.getScene('AbilitiesScene');
    scene.abilityKey = key;
    scene.render();
    return { rank: hero.abilityRanks[key], gold: qa.state.gold - gold,
      points: hero.skillPoints - points, gained, slotsUnchanged: JSON.stringify(loadout) === JSON.stringify(hero.abilityLoadout) };
  }, locked);
  expect(learned.rank).toBe(1);
  expect(learned.gold).toBe(0);
  expect(learned.points).toBe(learned.gained);
  expect(learned.slotsUnchanged).toBe(true);
  const available = await audit.capture('AbilitiesScene', 'automatically-learned');
  expect(available.texts.some(o => o.text === locked.name)).toBe(true);
  expect(available.objects.some(o => o.name === 'Train rank')).toBe(true);
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
  expect((await audit.snapshot('TitleScene')).texts.some(o => o.text.includes('Learned a new ability!'))).toBe(false);
  await audit.activate('TownScene');
  const data = await audit.capture('TownScene', 'ability-unlocks');
  expect(data.texts.some(o => o.text === 'Level Up!')).toBe(true);
  expect(data.texts.some(o => o.text.includes('Learned a new ability!'))).toBe(true);
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
  expect((await audit.snapshot('AbilitiesScene')).texts.some(o => o.text.includes('Learned a new ability!'))).toBe(false);
});
