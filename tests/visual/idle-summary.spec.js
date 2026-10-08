import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('return rewards list waves, gold, each adventurer and combined loot', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').sys.isActive());
  const result = await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    scene.idleSummary = { waves: 12, gold: 345, xp: 48, materials: {}, deaths: [], casualties: [] };
    scene.showIdleSummary();
    return { text: scene.children.getByName('idle-summary-text').text,
      names: qa.state.activeParty.map(hero => hero.name) };
  });
  expect(result.text).toContain('- 12 waves cleared.');
  expect(result.text).toContain('- You gained 345 Gold.');
  for (const name of result.names) expect(result.text).toContain(`- ${name} gained 48 Exp.`);
  expect(result.text).toContain('- Rewards: None.');
  await mkdir('tests/visual/screenshots', { recursive: true });
  await page.screenshot({ path: 'tests/visual/screenshots/IdleRewards-phone.png' });
});
