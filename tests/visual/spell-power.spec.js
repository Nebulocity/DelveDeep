// Inspect unified power and its explanation at both supported landscape review sizes.
// This uses current abilities and also reloads a deliberately historical battle record.
import { test, expect } from '@playwright/test';

for (const width of [915, 1920]) {
  test(`Spell Power sheets and ability inspection at ${width}`, async ({ page }) => {
    test.setTimeout(180000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: width === 915 ? 412 : 1080 });
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const hero = qa.state.roster.find(hero => hero.className === 'Cleric of the Everbright');
      const scene = qa.game.scene.getScene('RosterScene');
      scene.heroId = hero.id;
      qa.activate('RosterScene');
    });
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').sys.isActive());
    const sheet = await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('RosterScene');
      const hero = qa.state.roster.find(hero => hero.id === scene.heroId);
      scene.openStats(hero);
      const texts = scene.children.list.filter(object => object.depth >= 2000 && typeof object.text === 'string');
      const bounds = texts.map(object => object.getBounds());
      const hit = scene.children.list.find(object => object.name === 'hall-stat-Spell Power').getBounds();
      const canvas = qa.game.canvas.getBoundingClientRect();
      return { labels: texts.map(object => object.text),
        overflow: bounds.some(rect => rect.x < 0 || rect.y < 0 || rect.right > 2400 || rect.bottom > 1080),
        point: { x: canvas.x + hit.centerX * canvas.width / 2400, y: canvas.y + hit.centerY * canvas.height / 1080 } };
    });
    expect(sheet.labels.filter(text => text === 'Spell Power')).toHaveLength(1);
    expect(sheet.labels).not.toContain('Spell Damage');
    expect(sheet.labels).not.toContain('Spell Healing');
    expect(sheet.overflow).toBe(false);
    await page.screenshot({ path: `output/qa/spell-power/hall-${width}.png` });
    await page.mouse.move(sheet.point.x, sheet.point.y);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    const explanation = await page.evaluate(() => {
      const collect = objects => objects.flatMap(object => [object.text ?? '', ...collect(object.list ?? [])]);
      return collect(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').children.list).join(' ');
    });
    expect(explanation).toContain('Strengthens damaging and healing spells');
    await page.screenshot({ path: `output/qa/spell-power/explanation-${width}.png` });
    await page.evaluate(async () => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('RosterScene');
      scene.selectionDetailsClose();
      scene.equipmentModalClose();
      const hero = qa.state.roster.find(hero => hero.id === scene.heroId);
      const ability = Object.values(hero.abilities).find(ability => ability.name === 'Holy Light');
      const { showSelectionDetails } = await import('/ui/SelectionDetails.js');
      showSelectionDetails(scene, scene.abilityDetails(hero, ability.id, ability));
    });
    await page.screenshot({ path: `output/qa/spell-power/heal-${width}.png` });
    await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      qa.state.activeParty = qa.state.roster.slice(0, 5);
      qa.activate('DungeonScene');
    });
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('DungeonScene').sys.isActive());
    await page.evaluate(async () => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('DungeonScene');
      const { showSelectionDetails } = await import('/ui/SelectionDetails.js');
      showSelectionDetails(scene, scene.adventurerDetails(qa.state.activeParty[0]));
    });
    await page.screenshot({ path: `output/qa/spell-power/delve-${width}.png` });
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyUnits?.length > 0);
    const inspected = await page.evaluate(async () => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      if (!scene.combatPaused) scene.togglePause();
      const { characterDetails, showSelectionDetails } = await import('/ui/SelectionDetails.js');
      const details = characterDetails(scene.partyUnits[0]);
      showSelectionDetails(scene, details);
      return { description: details.description, power: scene.partyUnits[0].spellPower };
    });
    expect(Number.isFinite(inspected.power)).toBe(true);
    expect(inspected.description).not.toMatch(/Spell Damage|Spell Healing|NaN|undefined/);
    await page.screenshot({ path: `output/qa/spell-power/battle-${width}.png` });
    expect(errors).toEqual([]);
  });
}

test('historical separate powers survive a real paused battle reload', async ({ page }) => {
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.state.activeBattle);
  await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('BattleScene');
    if (!scene.combatPaused) scene.togglePause();
    const unit = scene.partyUnits[0];
    delete unit.spellPower;
    unit.spellDamage = 123;
    unit.spellHealing = 45;
    const { saveProfile } = await import('/game/GameStorage.js');
    saveProfile();
  });
  await page.reload();
  await page.waitForFunction(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa?.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && !scene.restoringBattle && scene.combatPaused;
  });
  const restored = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('BattleScene');
    const unit = scene.partyUnits[0];
    const { abilityPower } = await import('/game/CharacterStats.js');
    return { unified: unit.spellPower, damage: abilityPower(unit, {}, 100), healing: abilityPower(unit, {}, 100, true),
      rosterPower: qa.state.roster.find(hero => hero.id === unit.id).spellPower };
  });
  expect(restored.unified).toBeUndefined();
  expect(restored.damage).toBe(123);
  expect(restored.healing).toBe(45);
  expect(Number.isFinite(restored.rosterPower)).toBe(true);
});


test('party selection details show shared power at both landscape sizes', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('PartySelectScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene').sys.isActive());
  await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    qa.game.scene.getScene('PartySelectScene').showAdventurerDetails(qa.state.roster.find(hero => hero.className.startsWith('Mage')));
  });
  for (const width of [915, 1920]) {
    await page.setViewportSize({ width, height: width === 915 ? 412 : 1080 });
    await page.screenshot({ path: `output/qa/spell-power/party-${width}.png` });
  }
  expect(errors).toEqual([]);
});
