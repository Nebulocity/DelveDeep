// Check the live service and bundled audio rather than assuming a track key can play.
import { test, expect } from '@playwright/test';

test('all Delves use the ordinary theme and every boss wave uses the boss theme', async ({ page }) => {
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').sys.isActive());
  const rows = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    const { getDelveById } = await import('/data/delves.js');
    scene.togglePause();
    const originalDelve = qa.state.currentDelve;
    const originalWaves = scene.waves;
    const originalIndex = scene.currentWaveIndex;
    const rows = [];
    for (const id of ['slime-cave', 'thornbriar-hollow', 'dolmark-den', 'march-west-delves', 'verge-delves', 'murmuring-abyss']) {
      qa.state.currentDelve = getDelveById(id);
      scene.waves = [{ boss: false }, { boss: true }];
      scene.currentWaveIndex = 0;
      const ordinary = qa.game.music.desiredTrack();
      scene.currentWaveIndex = 1;
      rows.push({ id, ordinary, boss: qa.game.music.desiredTrack() });
    }
    qa.state.currentDelve = originalDelve;
    scene.waves = originalWaves;
    scene.currentWaveIndex = originalIndex;
    return rows;
  });
  expect(rows).toHaveLength(6);
  for (const row of rows) {
    expect(row.ordinary).toBe('music-slime-cave');
    expect(row.boss).toBe('music-boss');
  }
  const audio = await page.evaluate(() => {
    const game = window.__DELVE_DEEP_VISUAL_QA__.game;
    return ['music-slime-cave', 'music-boss'].every(key => game.cache.audio.exists(key));
  });
  expect(audio).toBe(true);
});
