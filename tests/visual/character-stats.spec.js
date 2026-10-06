import { test, expect } from '@playwright/test';

for (const width of [915, 1920]) {
  test(`Character skill and stats content at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 915 ? 412 : 1080 });
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const hero = qa.state.roster.find(hero => hero.id === 'caramon-gladiator');
      hero.level = 6; hero.skillPoints = 8; qa.state.gold = 700;
      hero.abilityRanks = { roar: 2, cleave: 2, secondWind: 1 };
      hero.abilityLoadout = ['roar', 'cleave', 'secondWind'];
      const scene = qa.game.scene.getScene('RosterScene');
      scene.heroId = hero.id; scene.tab = 'skills'; scene.rosterOffset = 0; scene.skillOffset = 0;
      qa.activate('RosterScene');
    });
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').sys.isActive());
    const content = await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('RosterScene');
      const hero = qa.state.roster.find(hero => hero.id === scene.heroId);
      const costs = scene.skillList.container.list.filter(object => object.text?.startsWith('Next rank costs')).map(object => object.text);
      const details = scene.abilityDetails(hero, 'cleave', hero.abilities.cleave);
      const buttons = scene.children.list.filter(object => object.input?.enabled).map(object => object.name);
      scene.openStats(hero);
      const labels = scene.children.list.filter(object => object.depth >= 2000 && [581, 1215].includes(object.x)).map(object => object.text);
      return { costs, details, buttons, labels };
    });
    expect(content.costs.length).toBe(10);
    expect(content.costs.every(text => /^Next rank costs \d+ SP and \d+ Gold to train$/.test(text))).toBe(true);
    expect(content.details.description).toMatch(/Damage: \d+-\d+/);
    expect(content.details.description).not.toMatch(/Cooldown:|Range:|Assault/);
    expect(content.buttons.some(label => label?.includes('<'))).toBe(false);
    expect(content.labels).toEqual(['Level', 'Health', 'Mana', 'Armor', 'Dodge', 'Block', 'Speed', 'Strength', 'Agility', 'Constitution', 'Intellect', 'Wisdom', 'Hit Chance', 'Crit Chance', 'Crit Multiplier', 'Attack Power', 'Spell Damage', 'Spell Healing', 'Happiness', 'Delves Cleared']);
    await page.screenshot({ path: `project-backup/character-review/stats-${width}.png` });
    const blockPoint = await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('RosterScene');
      const bounds = scene.children.list.find(object => object.name === 'hall-stat-Block').getBounds();
      const canvas = qa.game.canvas.getBoundingClientRect();
      return { x: canvas.x + (bounds.x + bounds.width / 2) * canvas.width / 2400, y: canvas.y + (bounds.y + bounds.height / 2) * canvas.height / 1080 };
    });
    await page.mouse.move(blockPoint.x, blockPoint.y); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
    const explanation = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').children.list.filter(object => object.depth >= 11000).map(object => object.text).join(' '));
    expect(explanation).toContain('40% total');
    await page.screenshot({ path: `project-backup/character-review/block-explanation-${width}.png` });
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').selectionDetailsClose());

    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').equipmentModalClose());
    await page.screenshot({ path: `project-backup/character-review/skills-${width}.png` });
    const rect = await page.locator('canvas').boundingBox();
    await page.mouse.move(rect.x + 273 * rect.width / 2400, rect.y + 513 * rect.height / 1080);
    await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
    const registry = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').children.list.filter(object => object.depth >= 11000).map(object => object.text));
    expect(registry).toContain('Known Skills'); expect(registry).toContain('Roar (Rank 2)');
    expect(registry).not.toContain('Throw Net');
    await page.screenshot({ path: `project-backup/character-review/known-skills-${width}.png` });
  });
}
