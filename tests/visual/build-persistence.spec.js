// Simulate installing a new build by changing the stored build marker before boot.
// Reload must restore real profile progression instead of treating that marker as a reset.
import { test, expect } from '@playwright/test';

test('an older build marker preserves saved profile progress on boot', async ({ page }) => {
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  const saved = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const { saveProfile } = await import('/game/GameStorage.js');
    qa.state.gold = 12345;
    qa.state.roster[0].level = 7;
    qa.state.roster[0].xp = 123;
    qa.state.delveCheckpoints['old-quarry'] = { nextWave: 12, campUnlocked: false };
    qa.state.world.clearedDelves = ['slime-cave', 'thornbriar-hollow'];
    saveProfile();
    localStorage.setItem('delveDeep.buildId.v1', 'previous-installed-build');
    return { id: qa.state.roster[0].id, raw: localStorage.getItem('delveDeep.profile.v2') };
  });
  await page.reload();
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  const restored = await page.evaluate(id => {
    const state = window.__DELVE_DEEP_VISUAL_QA__.state;
    const hero = state.roster.find(h => h.id === id);
    return { gold: state.gold, level: hero.level, xp: hero.xp,
      checkpoint: state.delveCheckpoints['old-quarry'], clears: state.world.clearedDelves,
      marker: localStorage.getItem('delveDeep.buildId.v1') };
  }, saved.id);
  expect(saved.raw).toBeTruthy();
  expect(restored.gold).toBe(12345);
  expect(restored.level).toBe(7);
  expect(restored.xp).toBe(123);
  expect(restored.checkpoint).toEqual({ nextWave: 12, campUnlocked: false });
  expect(restored.clears).toEqual(['slime-cave', 'thornbriar-hollow']);
  expect(restored.marker).not.toBe('previous-installed-build');
});
