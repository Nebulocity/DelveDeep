// Verify both Abyss camps and the reward-cap notice at phone and desktop sizes.
import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`Abyss camps show progression and material-only caps at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'murmuring-abyss' }));
    await page.waitForFunction(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      return scene.sys.isActive() && scene.encounterStatusText && scene.waves.length === 34;
    });
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });

    for (const [nextWave, cappedCount] of [[15, 2], [33, 5]]) {
      const camp = await page.evaluate(({ nextWave, cappedCount }) => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__;
        const scene = qa.game.scene.getScene('BattleScene');

        // Remove the previous camp's drawings and countdown so each fixture is isolated.
        scene.children.list.filter(object => object.depth >= 11999).forEach(object => object.destroy());
        scene.time.removeAllEvents();
        scene.combatPaused = true;
        qa.state.world.clearedDelves = [];
        qa.state.delveCheckpoints = { 'murmuring-abyss': { nextWave, campUnlocked: true } };
        qa.state.activeParty.forEach((member, index) => {
          qa.state.roster.find(hero => hero.id === member.id).level = index < cappedCount ? 30 : 25;
        });
        scene.showDelveCamp();
        const texts = scene.children.list.filter(object => object.type === 'Text' && object.depth >= 12002);
        const notice = texts.find(object => object.y === 346);
        const frame = scene.children.list.find(object => object.name === 'delve-camp-heading-window');
        return { labels: texts.map(object => object.text), notice: notice.text,
          noticeBounds: { left: notice.getBounds().left, right: notice.getBounds().right },
          frameBounds: { left: frame.getBounds().left, right: frame.getBounds().right } };
      }, { nextWave, cappedCount });
      expect(camp.labels).toContain(`FARM WAVE ${nextWave}`);
      expect(camp.labels).toContain(nextWave === 15 ? 'CONTINUE DELVE' : 'FACE THE BOSS');
      expect(camp.notice).toMatch(cappedCount === 5 ? /materials only.*No XP, Gold or Happiness/ : /reduced Gold.*no XP/);
      expect(camp.notice).toContain('Happiness');
      expect(camp.noticeBounds.left).toBeGreaterThan(camp.frameBounds.left);
      expect(camp.noticeBounds.right).toBeLessThan(camp.frameBounds.right);
      await page.screenshot({ path: `output/qa/delve-tuning/camp-${nextWave}-${viewport.width}.png` });
    }
  });
}
