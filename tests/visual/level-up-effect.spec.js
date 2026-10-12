import { test, expect } from '@playwright/test';

// Use real reward progression and sprite silhouettes at the configured viewport size.
test('Wave level-ups sparkle over characters and pause with combat', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && scene.partyUnits?.length > 0 && !scene.waveTransitioning;
  });
  const result = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    const { xpRequired } = await import('/game/AdventurerProgression.js');
    const effects = await import('/combat/LevelUpEffect.js');
    scene.combatPaused = true;
    scene.time.paused = true;
    scene.currentWaveIndex = 0;
    scene.waveTransitioning = false;
    scene.battleOver = false;
    qa.state.run.entry = 'progress';
    qa.state.delveCheckpoints = {};
    for (const unit of scene.partyUnits) {
      const hero = qa.state.roster.find(hero => hero.id === unit.id);
      hero.level = 1;
      hero.xp = xpRequired(1) - 1;
    }
    scene.completeWave();

    // The card must read the newly earned roster level while combat stats stay saved.
    for (const card of scene.partyHud) {
      const hero = qa.state.roster.find(hero => hero.id === card.unit.id);
      if (card.levelText.text !== `Lv ${hero.level}`) throw new Error('Character card kept its old level');
    }
    const count = scene.levelUpEffects.length;
    const effect = scene.levelUpEffects[0];
    if (!effect) throw new Error('Wave XP did not create a celebration');
    const x = effect.label.x;
    effect.unit.setArenaPosition(effect.unit.arenaX + 60, effect.unit.arenaY);
    effects.updateLevelUpEffects(scene);
    const follows = effect.label.x !== x;
    scene.time.now = effect.startedAt + 1800;
    effects.updateLevelUpEffects(scene);
    for (let index = 1; index < scene.levelUpEffects.length; index++) {
      const current = scene.levelUpEffects[index].label;
      const previous = scene.levelUpEffects[index - 1].label;
      if (Math.abs(current.x - previous.x) < (current.width + previous.width) / 2 + 20
        && Math.abs(current.y - previous.y) < 90) throw new Error('Neighboring level-up labels overlap');
    }
    return { count, follows, alpha: effect.label.alpha };
  });
  expect(result.count).toBeGreaterThan(0);
  expect(result.follows).toBe(true);
  expect(result.alpha).toBe(1);
  await page.screenshot({ path: `output/qa/level-up/battle-${page.viewportSize().width}.png` });
  const paused = await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return { now: scene.time.now, y: scene.levelUpEffects[0].label.y };
  });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return { now: scene.time.now, y: scene.levelUpEffects[0].label.y };
  })).toEqual(paused);
  expect(errors).toEqual([]);
});
